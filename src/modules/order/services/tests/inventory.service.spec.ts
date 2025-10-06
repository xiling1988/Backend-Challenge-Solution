import { Test, TestingModule } from "@nestjs/testing";
import { Repository, EntityManager } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { InventoryService } from "../inventory.service";
import { Product } from "../../../product/entities/product.entity";
import { BadRequestException, NotFoundException } from "@nestjs/common";

describe("InventoryService", () => {
  let service: InventoryService;
  let productRepository: jest.Mocked<Repository<Product>>;
  let entityManager: jest.Mocked<EntityManager>;

  // Create fresh mockProducts for each test
  const createMockProducts = (): Product[] => [
    {
      id: "prod-1",
      name: "Product 1",
      description: "Description 1",
      price: 10.99,
      stockQuantity: 10,
      category: "Electronics",
      orderItems: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "prod-2",
      name: "Product 2",
      description: "Description 2",
      price: 20.49,
      stockQuantity: 5,
      category: "Books",
      orderItems: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    // Mock Repository<Product>
    productRepository = {
      find: jest.fn(),
      save: jest.fn(),
    } as any;

    // Mock EntityManager
    entityManager = {
      getRepository: jest.fn().mockReturnValue(productRepository),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: getRepositoryToken(Product),
          useValue: productRepository,
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe("validateAndUpdateStock", () => {
    const validItems = [
      { productId: "prod-1", quantity: 2 },
      { productId: "prod-2", quantity: 3 },
    ];

    it("should validate and update stock successfully with default repository", async () => {
      const mockProducts = createMockProducts();
      productRepository.find.mockResolvedValue(mockProducts);
      productRepository.save.mockResolvedValue(mockProducts as any);

      await service.validateAndUpdateStock(validItems);

      expect(productRepository.find).toHaveBeenCalledWith({
        where: {
          id: expect.objectContaining({ _value: ["prod-1", "prod-2"] }),
        },
      });
      expect(productRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({ id: "prod-1", stockQuantity: 8 }),
        expect.objectContaining({ id: "prod-2", stockQuantity: 2 }),
      ]);
    });

    it("should validate and update stock successfully with EntityManager", async () => {
      const mockProducts = createMockProducts();
      productRepository.find.mockResolvedValue(mockProducts);
      productRepository.save.mockResolvedValue(mockProducts as any);
      entityManager.getRepository.mockReturnValue(productRepository);

      await service.validateAndUpdateStock(validItems, entityManager);

      expect(entityManager.getRepository).toHaveBeenCalledWith(Product);
      expect(productRepository.find).toHaveBeenCalledWith({
        where: {
          id: expect.objectContaining({ _value: ["prod-1", "prod-2"] }),
        },
      });
      expect(productRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({ id: "prod-1", stockQuantity: 8 }),
        expect.objectContaining({ id: "prod-2", stockQuantity: 2 }),
      ]);
    });

    it("should handle empty items array gracefully", async () => {
      productRepository.find.mockResolvedValue([]);
      productRepository.save.mockResolvedValue([] as any);

      await expect(service.validateAndUpdateStock([])).resolves.toBeUndefined();
      expect(productRepository.find).toHaveBeenCalledWith({
        where: { id: expect.objectContaining({ _value: [] }) },
      });
      expect(productRepository.save).toHaveBeenCalledWith([]);
    });

    it("should throw NotFoundException if product is missing", async () => {
      const mockProducts = createMockProducts();
      productRepository.find.mockResolvedValue([mockProducts[0]]); // Only prod-1 found

      await expect(service.validateAndUpdateStock(validItems)).rejects.toThrow(
        new NotFoundException("Product prod-2 not found"),
      );
      expect(productRepository.find).toHaveBeenCalled();
      expect(productRepository.save).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException if stock is insufficient", async () => {
      const lowStockProducts = [
        {
          ...createMockProducts()[0],
          stockQuantity: 1, // Not enough stock
        },
        createMockProducts()[1],
      ];
      productRepository.find.mockResolvedValue(lowStockProducts);

      await expect(service.validateAndUpdateStock(validItems)).rejects.toThrow(
        new BadRequestException("Insufficient stock for product Product 1"),
      );
      expect(productRepository.find).toHaveBeenCalled();
      expect(productRepository.save).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException for negative quantity", async () => {
      const mockProducts = createMockProducts();
      productRepository.find.mockResolvedValue(mockProducts);

      const invalidItems = [{ productId: "prod-1", quantity: -1 }];

      await expect(
        service.validateAndUpdateStock(invalidItems),
      ).rejects.toThrow(
        new BadRequestException(
          "Quantity must be positive for product Product 1",
        ),
      );
      expect(productRepository.find).toHaveBeenCalled();
      expect(productRepository.save).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException for zero quantity", async () => {
      const mockProducts = createMockProducts();
      productRepository.find.mockResolvedValue(mockProducts);

      const invalidItems = [{ productId: "prod-1", quantity: 0 }];

      await expect(
        service.validateAndUpdateStock(invalidItems),
      ).rejects.toThrow(
        new BadRequestException(
          "Quantity must be positive for product Product 1",
        ),
      );
      expect(productRepository.find).toHaveBeenCalled();
      expect(productRepository.save).not.toHaveBeenCalled();
    });
  });
});
