export interface IPricingService {
  calculateFinalPrice(subtotal: number, country: string): number;
}
