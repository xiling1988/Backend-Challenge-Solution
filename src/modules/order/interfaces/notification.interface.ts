export enum NotificationType {
  ORDER_CONFIRMATION = "ORDER_CONFIRMATION",
  SHIPPING = "SHIPPING",
  RESTOCK = "RESTOCK", // Example for future use
}
export interface NotificationData {
  email: string;
  orderId: string;
}

export interface INotification {
  sendNotification(
    type: NotificationType,
    data: NotificationData,
  ): Promise<void>;
}
