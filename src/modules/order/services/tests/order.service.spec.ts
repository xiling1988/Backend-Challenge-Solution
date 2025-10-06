import { Test } from "@nestjs/testing";
import { DataSource, EntityManager } from "typeorm";

import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { Logger } from "@nestjs/common";
import { CreateOrderDto, CreateOrderItemDto, UpdateOrderDto } from "../../dto";
import { OrderService } from "../order.service";

import { InventoryService } from "../inventory.service";
import { PricingService } from "../pricing.service";
import { NotificationService } from "../notification.service";
import { Order, OrderItem, OrderStatus } from "../../entities";
import { NotificationType } from "../../interfaces";
import { Product } from "../../../product/entities/product.entity";
describe("OrderService", () => {
  let service: OrderService;
  let orderRepository: any;
  let customerRepository: any;
  let orderItemRepository: any;
  let locationRepository: any;
  let productRepository: any;
  let inventoryService: InventoryService;
  let pricingService: PricingService;
  let notificationService: NotificationService;
  let dataSource: DataSource;
  let queryRunner: any;
  let manager: EntityManager;

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        save: jest.fn(),
        findOne: jest.fn(),
      } as any,
    };

    orderRepository = {
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
        getOne: jest.fn(),
      }),
    };

    customerRepository = {
      findOne: jest.fn(),
    };

    orderItemRepository = {
      save: jest.fn(),
    };

    locationRepository = {
      findOne: jest.fn(),
    };

    productRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: "OrderRepository",
          useValue: orderRepository,
        },
        {
          provide: "CustomerRepository",
          useValue: customerRepository,
        },
        {
          provide: "OrderItemRepository",
          useValue: orderItemRepository,
        },
        {
          provide: "LocationRepository",
          useValue: locationRepository,
        },
        {
          provide: "ProductRepository",
          useValue: productRepository,
        },
        {
          provide: InventoryService,
          useValue: {
            validateAndUpdateStock: jest.fn(),
          },
        },
        {
          provide: PricingService,
          useValue: {
            calculateFinalPrice: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendNotification: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    inventoryService = module.get(InventoryService);
    pricingService = module.get(PricingService);
    notificationService = module.get(NotificationService);
    dataSource = module.get(DataSource);
    manager = queryRunner.manager;
  });

  describe("createOrder", () => {
    const createOrderDto: CreateOrderDto = {
      customerId: "2da53448-ec09-44e8-a862-912f95fbca68",
      locationId: "9be9cf89-6fe0-457f-936f-e7c1f656481e",
      items: [
        { productId: "0d759aa0-e5f0-420d-913d-1b8f0a917e5d", quantity: 2 },
      ],
      notes: "Test order",
    };

    it("should create an order successfully", async () => {
      const customer = {
        id: createOrderDto.customerId,
        email: "john.doe@email.com",
      };
      const location = {
        id: createOrderDto.locationId,
        name: "Downtown Store",
        country: "US",
      };
      const product = {
        id: createOrderDto.items[0].productId,
        price: 129.99,
        name: "Running Shoes",
        stockQuantity: 200,
      };
      const order = {
        id: "order-1",
        ...createOrderDto,
        totalAmount: 259.98,
        status: OrderStatus.PENDING,
      };
      const orderItem = {
        productId: product.id,
        quantity: 2,
        unitPrice: 129.99,
        totalPrice: 259.98,
        orderId: "order-1",
      };

      jest
        .spyOn(customerRepository, "findOne")
        .mockResolvedValue(customer as any);
      jest
        .spyOn(locationRepository, "findOne")
        .mockResolvedValue(location as any);
      jest
        .spyOn(inventoryService, "validateAndUpdateStock")
        .mockResolvedValue(undefined);
      jest.spyOn(manager, "findOne").mockResolvedValue(product as any);
      jest.spyOn(pricingService, "calculateFinalPrice").mockReturnValue(259.98);
      jest.spyOn(orderRepository, "create").mockReturnValue(order as any);
      jest
        .spyOn(manager, "save")
        .mockImplementation((entity) =>
          Promise.resolve(entity === Order ? order : orderItem),
        );
      jest
        .spyOn(notificationService, "sendNotification")
        .mockResolvedValue(undefined);

      const result = await service.createOrder(createOrderDto);

      expect(customerRepository.findOne).toHaveBeenCalledWith({
        where: { id: createOrderDto.customerId },
      });
      expect(locationRepository.findOne).toHaveBeenCalledWith({
        where: { id: createOrderDto.locationId },
      });
      expect(inventoryService.validateAndUpdateStock).toHaveBeenCalledWith(
        createOrderDto.items,
        manager,
      );
      expect(pricingService.calculateFinalPrice).toHaveBeenCalledWith(
        259.98,
        "US",
      );
      expect(manager.save).toHaveBeenCalledWith(Order, expect.any(Object));
      expect(manager.save).toHaveBeenCalledWith(
        OrderItem,
        expect.objectContaining({ orderId: "order-1" }),
      );
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        NotificationType.ORDER_CONFIRMATION,
        { email: customer.email, orderId: "order-1" },
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      expect(result).toEqual(order);
    });

    it("should throw NotFoundException if customer not found", async () => {
      jest.spyOn(customerRepository, "findOne").mockResolvedValue(null);
      await expect(service.createOrder(createOrderDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException if location not found", async () => {
      jest
        .spyOn(customerRepository, "findOne")
        .mockResolvedValue({ id: createOrderDto.customerId } as any);
      jest.spyOn(locationRepository, "findOne").mockResolvedValue(null);
      await expect(service.createOrder(createOrderDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it("should handle notification failure without throwing", async () => {
      const customer = {
        id: createOrderDto.customerId,
        email: "john.doe@email.com",
      };
      const location = {
        id: createOrderDto.locationId,
        name: "Downtown Store",
        country: "US",
      };
      const product = {
        id: createOrderDto.items[0].productId,
        price: 129.99,
        stockQuantity: 200,
      };
      const order = {
        id: "order-1",
        ...createOrderDto,
        totalAmount: 259.98,
        status: OrderStatus.PENDING,
      };
      const orderItem = {
        productId: product.id,
        quantity: 2,
        unitPrice: 129.99,
        totalPrice: 259.98,
        orderId: "order-1",
      };

      jest
        .spyOn(customerRepository, "findOne")
        .mockResolvedValue(customer as any);
      jest
        .spyOn(locationRepository, "findOne")
        .mockResolvedValue(location as any);
      jest
        .spyOn(inventoryService, "validateAndUpdateStock")
        .mockResolvedValue(undefined);
      jest.spyOn(manager, "findOne").mockResolvedValue(product as any);
      jest.spyOn(pricingService, "calculateFinalPrice").mockReturnValue(259.98);
      jest.spyOn(orderRepository, "create").mockReturnValue(order as any);
      jest
        .spyOn(manager, "save")
        .mockImplementation((entity) =>
          Promise.resolve(entity === Order ? order : orderItem),
        );
      jest
        .spyOn(notificationService, "sendNotification")
        .mockRejectedValue(new Error("Email service down"));
      jest.spyOn(service["logger"], "error").mockImplementation(() => {});

      const result = await service.createOrder(createOrderDto);

      expect(notificationService.sendNotification).toHaveBeenCalled();
      expect(service["logger"].error).toHaveBeenCalledWith(
        `Failed to send confirmation email for order ${order.id}: Email service down`,
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toEqual(order);
    });

    it("should rollback transaction on stock validation error", async () => {
      jest
        .spyOn(customerRepository, "findOne")
        .mockResolvedValue({ id: createOrderDto.customerId } as any);
      jest.spyOn(locationRepository, "findOne").mockResolvedValue({
        id: createOrderDto.locationId,
        country: "US",
      } as any);
      jest
        .spyOn(inventoryService, "validateAndUpdateStock")
        .mockRejectedValue(new Error("Insufficient stock"));

      await expect(service.createOrder(createOrderDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      expect(service["logger"].error).toHaveBeenCalledWith(
        "Failed to create order: Insufficient stock",
      );
    });
  });

  describe("calculateSubtotalAndItems", () => {
    const items: CreateOrderItemDto[] = [
      { productId: "0d759aa0-e5f0-420d-913d-1b8f0a917e5d", quantity: 2 },
    ];

    it("should calculate subtotal and create order items", async () => {
      const product = {
        id: items[0].productId,
        price: 129.99,
        name: "Running Shoes",
      };
      jest.spyOn(manager, "findOne").mockResolvedValue(product as any);

      const result = await service["calculateSubtotalAndItems"](items, manager);

      expect(result.subtotal).toBe(259.98);
      expect(result.orderItems).toHaveLength(1);
      expect(result.orderItems[0]).toEqual(
        expect.objectContaining({
          productId: items[0].productId,
          quantity: 2,
          unitPrice: 129.99,
          totalPrice: 259.98,
        }),
      );
      expect(manager.findOne).toHaveBeenCalledWith(Product, {
        where: { id: items[0].productId },
      });
    });

    it("should throw BadRequestException if product not found", async () => {
      jest.spyOn(manager, "findOne").mockResolvedValue(null);
      await expect(
        service["calculateSubtotalAndItems"](items, manager),
      ).rejects.toThrow(`Product ${items[0].productId} not found`);
    });
  });

  describe("findAll", () => {
    it("should return all orders with relations", async () => {
      const orders = [{ id: "order-1", status: OrderStatus.PENDING }];
      orderRepository.createQueryBuilder().getMany.mockResolvedValue(orders);

      const result = await service.findAll();
      expect(result).toEqual(orders);
      expect(orderRepository.createQueryBuilder).toHaveBeenCalledWith("order");
    });
  });

  describe("findOne", () => {
    it("should return a single order with relations", async () => {
      const order = { id: "order-1", status: OrderStatus.PENDING };
      orderRepository.createQueryBuilder().getOne.mockResolvedValue(order);

      const result = await service.findOne("order-1");
      expect(result).toEqual(order);
      expect(orderRepository.createQueryBuilder).toHaveBeenCalledWith("order");
    });

    it("should throw NotFoundException if order not found", async () => {
      orderRepository.createQueryBuilder().getOne.mockResolvedValue(null);
      await expect(service.findOne("order-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("updateOrder", () => {
    const order = {
      id: "order-1",
      status: OrderStatus.PENDING,
      customer: { email: "john.doe@email.com" },
    };
    const updateOrderDto: UpdateOrderDto = {
      status: OrderStatus.SHIPPED,
      notes: "Updated notes",
    };

    beforeEach(() => {
      jest.spyOn(service, "findOne").mockResolvedValue(order as any);
      jest
        .spyOn(manager, "save")
        .mockResolvedValue({ ...order, ...updateOrderDto });
    });

    it("should update order status and notes", async () => {
      const result = await service.updateOrder("order-1", updateOrderDto);
      expect(result).toEqual(expect.objectContaining(updateOrderDto));
      expect(service.findOne).toHaveBeenCalledWith("order-1");
      expect(manager.save).toHaveBeenCalledWith(Order, expect.any(Object));
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        NotificationType.SHIPPING,
        { email: order.customer.email, orderId: "order-1" },
      );
    });

    it("should handle notification failure without throwing", async () => {
      jest
        .spyOn(notificationService, "sendNotification")
        .mockRejectedValue(new Error("Email service down"));
      jest.spyOn(service["logger"], "error").mockImplementation(() => {});

      const result = await service.updateOrder("order-1", updateOrderDto);
      expect(result).toEqual(expect.objectContaining(updateOrderDto));
      expect(service["logger"].error).toHaveBeenCalledWith(
        `Failed to send shipping notification for order ${order.id}: Email service down`,
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it("should throw ForbiddenException for invalid status update", async () => {
      jest
        .spyOn(service, "findOne")
        .mockResolvedValue({ ...order, status: OrderStatus.DELIVERED } as any);
      await expect(
        service.updateOrder("order-1", { status: OrderStatus.PENDING }),
      ).rejects.toThrow(ForbiddenException);
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe("validateOrderStatusUpdate", () => {
    it("should allow valid status transitions", async () => {
      const order = { status: OrderStatus.PENDING };
      await expect(
        service["validateOrderStatusUpdate"](order as any, OrderStatus.SHIPPED),
      ).resolves.toBeUndefined();
    });

    it("should throw ForbiddenException for delivered order status change", async () => {
      const order = { status: OrderStatus.DELIVERED };
      await expect(
        service["validateOrderStatusUpdate"](order as any, OrderStatus.PENDING),
      ).rejects.toThrow("Cannot change status of delivered order");
    });

    it("should throw ForbiddenException for cancelled order update", async () => {
      const order = { status: OrderStatus.CANCELLED };
      await expect(
        service["validateOrderStatusUpdate"](order as any, OrderStatus.SHIPPED),
      ).rejects.toThrow("Cannot update cancelled order");
    });
  });

  describe("deleteOrder", () => {
    it("should delete a pending order", async () => {
      const order = { id: "order-1", status: OrderStatus.PENDING };
      jest.spyOn(service, "findOne").mockResolvedValue(order as any);
      jest.spyOn(orderRepository, "remove").mockResolvedValue(undefined);

      await service.deleteOrder("order-1");
      expect(service.findOne).toHaveBeenCalledWith("order-1");
      expect(orderRepository.remove).toHaveBeenCalledWith(order);
    });

    it("should throw BadRequestException for shipped order", async () => {
      jest.spyOn(service, "findOne").mockResolvedValue({
        id: "order-1",
        status: OrderStatus.SHIPPED,
      } as any);
      await expect(service.deleteOrder("order-1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("getOrdersByCustomer", () => {
    it("should return orders for a customer", async () => {
      const orders = [
        { id: "order-1", customerId: "2da53448-ec09-44e8-a862-912f95fbca68" },
      ];
      orderRepository.createQueryBuilder().getMany.mockResolvedValue(orders);

      const result = await service.getOrdersByCustomer(
        "2da53448-ec09-44e8-a862-912f95fbca68",
      );
      expect(result).toEqual(orders);
      expect(orderRepository.createQueryBuilder).toHaveBeenCalledWith("order");
    });
  });
});
