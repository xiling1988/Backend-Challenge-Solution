import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { Order, OrderStatus } from "./entities/order.entity";

import { CreateOrderDto, CreateOrderItemDto, UpdateOrderDto } from "./dto";
import { Customer } from "../customer/entities/customer.entity";
import { Product } from "../product/entities/product.entity";
import { OrderItem } from "./entities";
import { Location } from "../location/entities/location.entity";
import { InventoryService } from "./services/inventory.service";
import { NotificationService } from "./services/notification.service";
import { NotificationType } from "./interfaces";
import { PricingService } from "./services/pricing.service";

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    private inventoryService: InventoryService,
    private pricingService: PricingService,
    private notificationService: NotificationService,
    private readonly logger: Logger,
    private dataSource: DataSource,
  ) {}

  async createOrder(createOrderDto: CreateOrderDto): Promise<Order> {
    const { customerId, locationId, items, notes } = createOrderDto;

    // Task 3: Could potentially do these in parallel as well,
    // but I dont think these were meant with 'performance issues' here.
    const customer = await this.customerRepository.findOne({
      where: { id: customerId },
    });
    const location = await this.locationRepository.findOne({
      where: { id: locationId },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    if (!location) {
      throw new NotFoundException("Location not found");
    }

    this.logger.log(
      `Customer and Location found. Creating order for customer ${customer.email} at location ${location.name}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.inventoryService.validateAndUpdateStock(
        items,
        queryRunner.manager,
      );
      const { subtotal, orderItems } = await this.calculateSubtotalAndItems(
        items,
        queryRunner.manager,
      );

      const totalAmount = this.pricingService.calculateFinalPrice(
        subtotal,
        location.country,
      );

      const order = new Order();
      order.customerId = customerId;
      order.locationId = locationId;
      order.status = OrderStatus.PENDING;
      order.totalAmount = totalAmount;
      order.notes = notes;

      const savedOrder = await queryRunner.manager.save(Order, order);

      for (const item of orderItems) {
        item.orderId = savedOrder.id;
        await queryRunner.manager.save(OrderItem, item);
      }

      // commiting transaction here: a failed email notification should not roll back the order creation
      await queryRunner.commitTransaction();
      this.logger.log(`Order ${savedOrder.id} created successfully`);

      // Again, a failed email notification should not fail/throw. (log here can be replaced by retries or proper some alerting system)
      try {
        await this.notificationService.sendNotification(
          NotificationType.ORDER_CONFIRMATION,
          {
            email: customer.email,
            orderId: savedOrder.id,
          },
        );
        this.logger.log(
          `Order confirmation sent to customer ${customer.email} for order ${savedOrder.id}`,
        );
      } catch (notificationError) {
        this.logger.error(
          `Failed to send confirmation email for order ${savedOrder.id}: ${notificationError.message}`,
        );
      }

      return savedOrder;
    } catch (error) {
      this.logger.log("Error validating stock, rolling back transaction");
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create order: ${error.message}`);
      throw new BadRequestException(
        "An error occurred while creating the order: " + error.message,
      );
    } finally {
      await queryRunner.release();
    }
  }

  private async calculateSubtotalAndItems(
    items: CreateOrderItemDto[],
    manager: EntityManager,
  ): Promise<{ subtotal: number; orderItems: OrderItem[] }> {
    let subtotal = 0;
    const orderItems: OrderItem[] = [];

    for (const item of items) {
      const product = await manager.findOne(Product, {
        where: { id: item.productId },
      });
      if (!product) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }
      const itemTotal = product.price * item.quantity;

      const orderItem = new OrderItem();
      orderItem.productId = product.id;
      orderItem.quantity = item.quantity;
      orderItem.unitPrice = product.price;
      orderItem.totalPrice = itemTotal;
      orderItems.push(orderItem);

      subtotal += itemTotal;
    }

    return { subtotal, orderItems };
  }

  async findAll(): Promise<Order[]> {
    return this.orderRepository
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.customer", "customer")
      .leftJoinAndSelect("order.location", "location")
      .leftJoinAndSelect("order.items", "items")
      .leftJoinAndSelect("items.product", "product")
      .orderBy("order.createdAt", "DESC")
      .getMany();
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.customer", "customer")
      .leftJoinAndSelect("order.location", "location")
      .leftJoinAndSelect("order.items", "items")
      .leftJoinAndSelect("items.product", "product")
      .where("order.id = :id", { id })
      .getOne();

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  async updateOrder(
    id: string,
    updateOrderDto: UpdateOrderDto,
  ): Promise<Order> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = await this.findOne(id);

      if (updateOrderDto.status) {
        await this.validateOrderStatusUpdate(order, updateOrderDto.status);
        order.status = updateOrderDto.status;
      }

      if (updateOrderDto.notes) {
        order.notes = updateOrderDto.notes;
      }

      const updatedOrder = await queryRunner.manager.save(Order, order);
      await queryRunner.commitTransaction();
      this.logger.log(`Order ${updatedOrder.id} updated successfully`);

      // Just for consistency with createOrder, I moved the notification outside the transaction.
      // Even though it wouldn't make the transaction fail, it seemed cleaner to me.
      if (updateOrderDto.status === OrderStatus.SHIPPED) {
        try {
          await this.notificationService.sendNotification(
            NotificationType.SHIPPING,
            { email: order.customer.email, orderId: order.id },
          );
          this.logger.log(
            `Shipping notification sent to ${order.customer.email} for order ${order.id}`,
          );
        } catch (notificationError) {
          this.logger.error(
            `Failed to send shipping notification for order ${order.id}: ${notificationError.message}`,
          );
        }
      }
      return updatedOrder;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to update order: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async validateOrderStatusUpdate(
    order: Order,
    newStatus: OrderStatus,
  ): Promise<void> {
    if (
      order.status === OrderStatus.DELIVERED &&
      newStatus !== OrderStatus.DELIVERED
    ) {
      throw new ForbiddenException("Cannot change status of delivered order");
    }
    if (order.status === OrderStatus.CANCELLED) {
      throw new ForbiddenException("Cannot update cancelled order");
    }
  }

  async deleteOrder(id: string): Promise<void> {
    const order = await this.findOne(id);

    if (
      order.status === OrderStatus.SHIPPED ||
      order.status === OrderStatus.DELIVERED
    ) {
      throw new BadRequestException(
        "Cannot delete shipped or delivered orders",
      );
    }

    await this.orderRepository.remove(order);
  }

  async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    return this.orderRepository
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.items", "items")
      .leftJoinAndSelect("items.product", "product")
      .leftJoinAndSelect("order.location", "location")
      .where("order.customerId = :customerId", { customerId })
      .orderBy("order.createdAt", "DESC")
      .getMany();
  }
}
