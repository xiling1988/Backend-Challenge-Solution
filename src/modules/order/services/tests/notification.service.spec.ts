import { Test, TestingModule } from "@nestjs/testing";
import { NotificationService } from "../notification.service";
import { Logger } from "@nestjs/common";
import { BadRequestException } from "@nestjs/common";
import { NotificationType } from "../../interfaces";

describe("NotificationService", () => {
  let service: NotificationService;
  let logger: Logger;

  beforeEach(async () => {
    logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationService, { provide: Logger, useValue: logger }],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  describe("sendNotification", () => {
    const validData = { email: "test@example.com", orderId: "order-uuid-1" };

    describe("success scenarios", () => {
      it("sends ORDER_CONFIRMATION notification and logs success", async () => {
        await service.sendNotification(
          NotificationType.ORDER_CONFIRMATION,
          validData,
        );
        expect(logger.log).toHaveBeenCalledWith(
          `Your order has been placed successfully! Order ID: ${validData.orderId}. Confirmation sent to ${validData.email}`,
        );
        expect(logger.error).not.toHaveBeenCalled();
      });

      it("sends SHIPPING notification and logs success", async () => {
        const shippingData = { email: "test@example.com", orderId: "uuid-1" };
        await service.sendNotification(NotificationType.SHIPPING, shippingData);
        expect(logger.log).toHaveBeenCalledWith(
          `Your order ${shippingData.orderId} has been shipped! Notification sent to ${shippingData.email}`,
        );
        expect(logger.error).not.toHaveBeenCalled();
      });

      it("logs warning for unknown notification type", async () => {
        await service.sendNotification(
          "UNKNOWN" as NotificationType,
          validData,
        );
        expect(logger.warn).toHaveBeenCalledWith(
          "Unknown notification type: UNKNOWN",
        );
        expect(logger.log).not.toHaveBeenCalled();
      });
    });

    describe("failure scenarios", () => {
      it("throws BadRequestException for missing email", async () => {
        await expect(
          service.sendNotification(NotificationType.ORDER_CONFIRMATION, {
            orderId: "uuid-1",
            email: "", // empty email
          }),
        ).rejects.toThrow(BadRequestException);
        expect(logger.error).toHaveBeenCalledWith(
          "Missing required fields: email and orderId",
        );
      });

      it("throws BadRequestException for missing orderId", async () => {
        await expect(
          service.sendNotification(NotificationType.ORDER_CONFIRMATION, {
            orderId: "", // empty orderId
            email: "test@example.com",
          }),
        ).rejects.toThrow(BadRequestException);
        expect(logger.error).toHaveBeenCalledWith(
          "Missing required fields: email and orderId",
        );
      });
    });
  });

  describe("sendOrderConfirmation", () => {
    it("logs success for valid email and orderId", async () => {
      await service.sendOrderConfirmation("test@example.com", "uuid-1");
      expect(logger.log).toHaveBeenCalledWith(
        "Your order has been placed successfully! Order ID: uuid-1. Confirmation sent to test@example.com",
      );
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe("sendShippingNotification", () => {
    it("logs success for valid email and orderId", async () => {
      await service.sendShippingNotification("test@example.com", "uuid-1");
      expect(logger.log).toHaveBeenCalledWith(
        "Your order uuid-1 has been shipped! Notification sent to test@example.com",
      );
      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
