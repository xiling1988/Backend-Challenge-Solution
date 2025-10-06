import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Order } from "../entities/order.entity";
import { Location } from "../../location/entities/location.entity";
import { OrderReport } from "../interfaces/order-report.interface";

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Location)
    private locationRepository: Repository<Location>,
    private readonly logger: Logger,
  ) {}

  async generateOrderReport(locationId: string): Promise<OrderReport> {
    const location = await this.locationRepository.findOne({
      where: { id: locationId },
    });
    if (!location) {
      this.logger.error(`Location with ID ${locationId} not found`);
      throw new NotFoundException("Location not found");
    }

    const orders = await this.orderRepository.find({
      where: { locationId },
      relations: ["items", "items.product"],
    });

    let totalRevenue = 0;
    const productSales: { [key: string]: number } = {};

    for (const order of orders) {
      totalRevenue += order.totalAmount;

      for (const item of order.items) {
        if (!productSales[item.product.name]) {
          productSales[item.product.name] = 0;
        }
        productSales[item.product.name] += item.quantity;
      }
    }

    return {
      locationId,
      totalOrders: orders.length,
      totalRevenue,
      productSales,
      generatedAt: new Date(),
    };
  }
}
