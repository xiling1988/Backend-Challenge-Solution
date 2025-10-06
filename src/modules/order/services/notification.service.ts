import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  INotification,
  NotificationData,
  NotificationType,
} from "../interfaces";

@Injectable()
export class NotificationService implements INotification {
  constructor(
    private readonly logger: Logger = new Logger(NotificationService.name),
  ) {}

  // Dont really like the data: any type here but its the easiest way to keep it flexible for now..
  // solved. Changed to NotificationData
  async sendNotification(
    type: NotificationType,
    data: { email?: string; orderId?: string },
  ) {
    if (!data?.email || !data?.orderId) {
      this.logger.error("Missing required fields: email and orderId"); // Line ~40
      throw new BadRequestException(
        "Missing required fields: email and orderId",
      ); // Line ~41-43
    }

    switch (type) {
      case NotificationType.ORDER_CONFIRMATION:
        await this.sendOrderConfirmation(data.email, data.orderId);
        break;
      case NotificationType.SHIPPING:
        await this.sendShippingNotification(data.email, data.orderId);
        break;
      default:
        this.logger.warn(`Unknown notification type: ${type}`);
    }
  }

  async sendOrderConfirmation(email: string, orderId: string) {
    // Mock: Log the notification instead of sending email
    this.logger.log(
      `Your order has been placed successfully! Order ID: ${orderId}. Confirmation sent to ${email}`,
    );
  }

  async sendShippingNotification(email: string, orderId: string) {
    // Mock: Log the notification instead of sending email
    this.logger.log(
      `Your order ${orderId} has been shipped! Notification sent to ${email}`,
    );
  }
}
