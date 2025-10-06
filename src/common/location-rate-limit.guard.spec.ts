import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, NotFoundException } from "@nestjs/common";
import { seconds, ThrottlerModule } from "@nestjs/throttler";
import { LocationRateLimitGuard } from "./location-rate-limit.guard";

// the generateKey is marked as protected, so exposing it here via a subclass for testing
class TestableLocationRateLimitGuard extends LocationRateLimitGuard {
  public exposeGenerateKey(context: ExecutionContext, suffix: string) {
    return this.generateKey(context, suffix);
  }
}

describe("LocationRateLimitGuard", () => {
  let guard: TestableLocationRateLimitGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            {
              ttl: seconds(60),
              limit: 10,
            },
          ],
        }),
      ],
      providers: [
        {
          provide: LocationRateLimitGuard,
          useClass: TestableLocationRateLimitGuard,
        },
      ],
    }).compile();

    guard = module.get<LocationRateLimitGuard>(
      LocationRateLimitGuard,
    ) as TestableLocationRateLimitGuard;
  });

  // Helper to create mock ExecutionContext
  function createMockContext(body: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ body }),
      }),
    } as unknown as ExecutionContext;
  }
  it("should generate key for valid locationId", () => {
    const context = createMockContext({ locationId: "loc-1" });
    const key = guard.exposeGenerateKey(context, "");
    expect(key).toBe("location:loc-1");
  });

  it("should throw NotFoundException for missing locationId", () => {
    const context = createMockContext({});
    expect(() => guard.exposeGenerateKey(context, "")).toThrow(
      new NotFoundException("Invalid or missing locationId"),
    );
  });

  it("should throw NotFoundException for undefined locationId", () => {
    const context = createMockContext({ locationId: undefined });
    expect(() => guard.exposeGenerateKey(context, "")).toThrow(
      new NotFoundException("Invalid or missing locationId"),
    );
  });

  it("should throw NotFoundException for non-string locationId (number)", () => {
    const context = createMockContext({ locationId: 123 });
    expect(() => guard.exposeGenerateKey(context, "")).toThrow(
      new NotFoundException("Invalid or missing locationId"),
    );
  });

  it("should throw NotFoundException for non-string locationId (object)", () => {
    const context = createMockContext({ locationId: {} });
    expect(() => guard.exposeGenerateKey(context, "")).toThrow(
      new NotFoundException("Invalid or missing locationId"),
    );
  });

  it("should throw NotFoundException for null locationId", () => {
    const context = createMockContext({ locationId: null });
    expect(() => guard.exposeGenerateKey(context, "")).toThrow(
      new NotFoundException("Invalid or missing locationId"),
    );
  });
});
