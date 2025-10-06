import { Test, TestingModule } from "@nestjs/testing";
import { PricingService } from "../pricing.service";
import { BadRequestException } from "@nestjs/common";
import { DEFAULT_TAX_RATES, TaxRates } from "../../tax.config";

describe("PricingService", () => {
  let service: PricingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PricingService],
    }).compile();

    service = module.get<PricingService>(PricingService);
  });

  describe("calculateFinalPrice", () => {
    describe("success scenarios", () => {
      it("applies 10% discount and 8% US tax for subtotal > 100", () => {
        const subtotal = 200;
        const country = "US";
        const result = service.calculateFinalPrice(subtotal, country);
        // 200 * 0.9 (discount) * 1.08 (tax) = 194.4
        expect(result).toBeCloseTo(194.4, 2);
      });
      it("applies only CA tax (13%) for subtotal <= 100", () => {
        const subtotal = 50;
        const country = "CA";
        const result = service.calculateFinalPrice(subtotal, country);
        // 50 * 1.13 (tax) = 56.5
        expect(result).toBeCloseTo(56.5, 2);
      });
      it("applies no discount or tax for subtotal <= 100 and non-US/CA country", () => {
        const subtotal = 50;
        const country = "UK";
        const result = service.calculateFinalPrice(subtotal, country);
        // No discount, no tax
        expect(result).toBe(50);
      });
      it("handles zero subtotal with no discount or tax", () => {
        const subtotal = 0;
        const country = "US";
        const result = service.calculateFinalPrice(subtotal, country);
        // 0 * 1.08 = 0
        expect(result).toBe(0);
      });
    });
    describe("failure scenarios", () => {
      it("throws BadRequestException for negative subtotal", () => {
        const subtotal = -10;
        const country = "CA";
        expect(() => service.calculateFinalPrice(subtotal, country)).toThrow(
          BadRequestException,
        );
      });
      it("throws BadRequestException for empty country", () => {
        const subtotal = 100;
        const country = "";
        expect(() => service.calculateFinalPrice(subtotal, country)).toThrow(
          BadRequestException,
        );
      });
      it("throws BadRequestException for non-string country", () => {
        const subtotal = 100;
        const country = 123 as any;
        expect(() => service.calculateFinalPrice(subtotal, country)).toThrow(
          BadRequestException,
        );
        expect(() => service.calculateFinalPrice(subtotal, country)).toThrow(
          "Country must be a non-empty string",
        );
      });
    });
    describe("extensibility with custom tax rates", () => {
      let originalTaxRates: TaxRates;

      beforeEach(() => {
        // Store original rates
        originalTaxRates = { ...DEFAULT_TAX_RATES };
        // Add UK tax rate for testing
        (DEFAULT_TAX_RATES as any).UK = 0.2;
      });

      afterEach(() => {
        // Restore original rates
        Object.keys(DEFAULT_TAX_RATES).forEach(
          (key) => delete (DEFAULT_TAX_RATES as any)[key],
        );
        Object.assign(DEFAULT_TAX_RATES, originalTaxRates);
      });

      it("applies custom 20% UK tax for subtotal > 100", () => {
        const subtotal = 200;
        const country = "UK";
        const result = service.calculateFinalPrice(subtotal, country);
        // 200 * 0.9 (discount) * 1.20 (tax) = 216
        expect(result).toBeCloseTo(216, 2);
      });
    });
  });
});
