import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

@Injectable()
// ThrottlerGuard already implements CanActivate internally
export class LocationRateLimitGuard extends ThrottlerGuard {
  protected generateKey(context: ExecutionContext, _suffix: string): string {
    const request = context.switchToHttp().getRequest();
    const locationId = request.body?.locationId;

    // Validate locationId
    if (!locationId || typeof locationId !== "string") {
      throw new NotFoundException("Invalid or missing locationId");
    }

    // Generate key: 'location:<locationId>'
    return `location:${locationId}`;
  }
}
