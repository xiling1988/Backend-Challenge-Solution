// Unlike the case of notifications, only one type of report was provided here
// so creating a parent Report interface/class felt like overkill for the challenge.
// In a real-world scenario, we'd consider a more extensible design.

export interface OrderReport {
  locationId: string;
  totalOrders: number;
  totalRevenue: number;
  productSales: { [key: string]: number };
  generatedAt: Date;
}
