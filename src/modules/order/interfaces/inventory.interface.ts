import { EntityManager } from "typeorm";

export interface IInventoryService {
  validateAndUpdateStock(
    items: { productId: string; quantity: number }[],
    manager?: EntityManager, // Optional manager for transaction
  ): Promise<void>;
}
