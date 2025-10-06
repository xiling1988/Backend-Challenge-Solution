import { Test, TestingModule } from "@nestjs/testing";
import { Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ReportService } from "../report.service";
import { Logger, NotFoundException } from "@nestjs/common";
import { Order } from "../../entities";
import { Location } from "../../../location/entities/location.entity";
import { OrderStatus } from "../../entities/order.entity";

describe("ReportService", () => {
  let service: ReportService;
  let orderRepository: jest.Mocked<Repository<Order>>;
  let locationRepository: jest.Mocked<Repository<Location>>;
  let logger: jest.Mocked<Logger>;

  // Add mockLocation and mockOrders declarations
  const createdAt = new Date();
  const updatedAt = new Date();

  const mockLocation: Location = {
    id: "loc-1",
    name: "Test Location",
    address: "123 Main St",
    city: "Test City",
    country: "Test Country",
    zipCode: "12345",
    latitude: 40.7128,
    longitude: -74.006,
    orders: [],
    createdAt,
    updatedAt,
  };

  beforeEach(async () => {
    orderRepository = {
      find: jest.fn(),
    } as any;

    locationRepository = {
      findOne: jest.fn(),
    } as any;

    logger = {
      error: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        {
          provide: getRepositoryToken(Order),
          useValue: orderRepository,
        },
        {
          provide: getRepositoryToken(Location),
          useValue: locationRepository,
        },
        {
          provide: Logger,
          useValue: logger,
        },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  describe("generateOrderReport", () => {
    const mockLocation: Location = {
      id: "loc-1",
      name: "Test Location",
      address: "123 Main St",
      city: "Test City",
      country: "Test Country",
      zipCode: "12345",
      latitude: 40.7128,
      longitude: -74.006,
      orders: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockOrders: Order[] = [
      {
        id: "order-1",
        status: OrderStatus.PENDING,
        totalAmount: 100.5,
        notes: "Test order 1",
        customerId: "cust-1",
        customer: {} as any,
        locationId: "loc-1",
        location: mockLocation,
        items: [
          {
            id: "item-1",
            quantity: 2,
            unitPrice: 10,
            totalPrice: 20,
            orderId: "order-1",
            productId: "prod-1",
            product: { name: "Product 1" } as any,
            order: {} as any,
          },
          {
            id: "item-2",
            quantity: 3,
            unitPrice: 15,
            totalPrice: 45,
            orderId: "order-1",
            productId: "prod-2",
            product: { name: "Product 2" } as any,
            order: {} as any,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "order-2",
        status: OrderStatus.PENDING,
        totalAmount: 50.25,
        notes: "Test order 2",
        customerId: "cust-2",
        customer: {} as any,
        locationId: "loc-1",
        location: mockLocation,
        items: [
          {
            id: "item-3",
            quantity: 1,
            unitPrice: 10,
            totalPrice: 10,
            orderId: "order-2",
            productId: "prod-1",
            product: { name: "Product 1" } as any,
            order: {} as any,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it("should generate a report successfully", async () => {
      locationRepository.findOne.mockResolvedValue(mockLocation);
      orderRepository.find.mockResolvedValue(mockOrders);

      const result = await service.generateOrderReport("loc-1");

      expect(locationRepository.findOne).toHaveBeenCalledWith({
        where: { id: "loc-1" },
      });
      expect(orderRepository.find).toHaveBeenCalledWith({
        where: { locationId: "loc-1" },
        relations: ["items", "items.product"],
      });
      expect(logger.error).not.toHaveBeenCalled();
      expect(result).toEqual({
        locationId: "loc-1",
        totalOrders: 2,
        totalRevenue: 150.75, // 100.50 + 50.25
        productSales: {
          "Product 1": 3, // 2 + 1
          "Product 2": 3,
        },
        generatedAt: expect.any(Date),
      });
    });

    it("should throw NotFoundException if location is not found", async () => {
      locationRepository.findOne.mockResolvedValue(null);

      await expect(service.generateOrderReport("loc-1")).rejects.toThrow(
        new NotFoundException("Location not found"),
      );
      expect(locationRepository.findOne).toHaveBeenCalledWith({
        where: { id: "loc-1" },
      });
      expect(logger.error).toHaveBeenCalledWith(
        "Location with ID loc-1 not found",
      );
      expect(orderRepository.find).not.toHaveBeenCalled();
    });

    it("should handle empty orders array", async () => {
      locationRepository.findOne.mockResolvedValue(mockLocation);
      orderRepository.find.mockResolvedValue([]);

      const result = await service.generateOrderReport("loc-1");

      expect(locationRepository.findOne).toHaveBeenCalledWith({
        where: { id: "loc-1" },
      });
      expect(orderRepository.find).toHaveBeenCalledWith({
        where: { locationId: "loc-1" },
        relations: ["items", "items.product"],
      });
      expect(logger.error).not.toHaveBeenCalled();
      expect(result).toEqual({
        locationId: "loc-1",
        totalOrders: 0,
        totalRevenue: 0,
        productSales: {},
        generatedAt: expect.any(Date),
      });
    });

    it("should handle orders with no items", async () => {
      const emptyOrder: Order[] = [
        {
          id: "order-1",
          status: OrderStatus.PENDING,
          totalAmount: 100.5,
          notes: "Test order 1",
          customerId: "cust-1",
          customer: {} as any,
          locationId: "loc-1",
          location: mockLocation,
          items: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      locationRepository.findOne.mockResolvedValue(mockLocation);
      orderRepository.find.mockResolvedValue(emptyOrder);

      const result = await service.generateOrderReport("loc-1");

      expect(locationRepository.findOne).toHaveBeenCalledWith({
        where: { id: "loc-1" },
      });
      expect(orderRepository.find).toHaveBeenCalledWith({
        where: { locationId: "loc-1" },
        relations: ["items", "items.product"],
      });
      expect(logger.error).not.toHaveBeenCalled();
      expect(result).toEqual({
        locationId: "loc-1",
        totalOrders: 1,
        totalRevenue: 100.5,
        productSales: {},
        generatedAt: expect.any(Date),
      });
    });

    it("should handle orders with multiple items for the same product", async () => {
      const singleProductOrder: Order[] = [
        {
          id: "order-1",
          status: OrderStatus.PENDING,
          totalAmount: 100.5,
          notes: "Test order 1",
          customerId: "cust-1",
          customer: {} as any,
          locationId: "loc-1",
          location: mockLocation,
          items: [
            {
              id: "item-1",
              quantity: 2,
              unitPrice: 10,
              totalPrice: 20,
              orderId: "order-1",
              productId: "prod-1",
              product: { name: "Product 1" } as any,
              order: {} as any,
            },
            {
              id: "item-2",
              quantity: 3,
              unitPrice: 10,
              totalPrice: 30,
              orderId: "order-1",
              productId: "prod-1",
              product: { name: "Product 1" } as any,
              order: {} as any,
            },
          ],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      locationRepository.findOne.mockResolvedValue(mockLocation);
      orderRepository.find.mockResolvedValue(singleProductOrder);

      const result = await service.generateOrderReport("loc-1");

      expect(result.productSales).toEqual({
        "Product 1": 5, // 2 + 3
      });
      expect(result.totalRevenue).toBe(100.5);
      expect(result.totalOrders).toBe(1);
    });
  });
});
