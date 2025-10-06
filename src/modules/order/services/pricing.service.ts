import { BadRequestException, Injectable } from "@nestjs/common";
import { IPricingService } from "../interfaces/pricing.interface";
import { DEFAULT_TAX_RATES } from "../tax.config";

@Injectable()
export class PricingService implements IPricingService {
  calculateFinalPrice(subtotal: number, country: string): number {
    if (subtotal < 0) {
      throw new BadRequestException("Subtotal cannot be negative");
    }
    if (!country || typeof country !== "string") {
      throw new BadRequestException("Country must be a non-empty string");
    }
    // Apply discount (original logic: 10% if order over 100 money units)
    let total = subtotal;
    if (total > 100) {
      total *= 0.9; // This could be made configurable or strategy-based for OCP
    }

    // Apply tax based on country --> this violates OCP less than the original..
    // Not sure if the intention here is to default to 0 or to throw if the country is not found...
    // I'll assume a 0% tax for non-US and non-CA countries for this.
    // Might make sense to include tax rates in a database (relation to country).
    const taxRate = DEFAULT_TAX_RATES[country] || 0;
    total *= 1 + taxRate;

    return total;
  }
}
