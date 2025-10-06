import { Logger, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OrderService } from "./services/order.service";
import { OrderController } from "./order.controller";
import { Order } from "./entities/order.entity";
import { OrderItem } from "./entities/order-item.entity";
import { NotificationService } from "./services/notification.service";
import { Customer } from "../customer/entities/customer.entity";
import { Product } from "../product/entities/product.entity";
import { PricingService } from "./services/pricing.service";
import { ReportService } from "./services/report.service";
import { Location } from "../location/entities/location.entity";
import { seconds, ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LocationRateLimitGuard } from "src/common/location-rate-limit.guard";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis/src";
import Redis from "ioredis";
import { InventoryService } from "./services/inventory.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Customer, Product, OrderItem, Location]),
    // https://innosufiyan.hashnode.dev/implementing-redis-based-throttling-in-nestjs
    // https://github.com/jmcdo29/nest-lab/tree/main/packages/throttler-storage-redis
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: seconds(60),
          limit: 10,
        },
      ],
      storage: new ThrottlerStorageRedisService(
        new Redis(process.env.REDIS_URL || "redis://localhost:6379"),
      ),
    }),
  ],
  controllers: [OrderController],
  providers: [
    Logger,
    OrderService,
    NotificationService,
    PricingService,
    ReportService,
    InventoryService,
    LocationRateLimitGuard,
    {
      provide: ThrottlerGuard, // the guard by nestjs/throttler
      useClass: LocationRateLimitGuard, // our own guard class
    },
  ],
  exports: [OrderService],
})
export class OrderModule {}
