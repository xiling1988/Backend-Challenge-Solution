import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager, In, Not } from "typeorm";
import { Product } from "../../product/entities/product.entity";
import { IInventoryService } from "../interfaces";

@Injectable()
export class InventoryService implements IInventoryService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
  ) {}

  async validateAndUpdateStock(
    items: { productId: string; quantity: number }[],
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(Product)
      : this.productRepository;

    const productIds = items.map((item) => item.productId);

    // Performance issue: we do a batch fetch here, instead of looping through the items and fetching individually.
    // This way we do only one (heavier) database call. (N-1) queries avoided.

    // Will not throw in case of missing products, we check that below
    const products = await repo.find({ where: { id: In(productIds) } });

    // little hashmap that lets us quickly lookup products by ids in the next step
    const productMap: { [key: string]: Product } = {};
    for (const product of products) {
      productMap[product.id] = product;
    }

    for (const item of items) {
      const product = productMap[item.productId];

      // The batch fetch above does not throw if some products are missing,
      // so we check here if the product is in the list.
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      // No negative or zero quantities
      if (item.quantity <= 0) {
        throw new BadRequestException(
          `Quantity must be positive for product ${product.name}`,
        );
      }

      // thinking of a better exception type here...
      if (product.stockQuantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for product ${product.name}`,
        );
      }

      // Individual stock update
      product.stockQuantity -= item.quantity;
    }

    // Update stock for all products at once
    await repo.save(products);
  }
}
