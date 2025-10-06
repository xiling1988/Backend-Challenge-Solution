import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { CustomerModule } from "./modules/customer/customer.module";
import { ProductModule } from "./modules/product/product.module";
import { LocationModule } from "./modules/location/location.module";

import { OrderModule } from "./modules/order/order.module";
import { Order, OrderItem } from "./modules/order/entities";
import { Customer } from "./modules/customer/entities/customer.entity";
import { Product } from "./modules/product/entities/product.entity";
import { Location } from "./modules/location/entities/location.entity";
import { seconds, ThrottlerModule } from "@nestjs/throttler";

@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || "challenge_user",
      password: process.env.DB_PASSWORD || "challenge_pass",
      database: process.env.DB_DATABASE || "fs_challenge",
      entities: [Order, Customer, Product, OrderItem, Location],
      synchronize: true, // Only for development
      logging: true,
    }),
    OrderModule,
    CustomerModule,
    ProductModule,
    LocationModule,
  ],
})
export class AppModule {}
