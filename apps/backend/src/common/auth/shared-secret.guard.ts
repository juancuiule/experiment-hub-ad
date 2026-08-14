import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Effect } from "effect";
import { ConfigService } from "../../config/config.service";

interface RequestLike {
  method: string;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Gates every non-GET request behind a static bearer secret (`API_SHARED_SECRET`).
 * No-op when the secret is unset, so local dev/test and CI need no configuration.
 * This is the stopgap ahead of real participant/researcher auth (docs/backend-service.md §3) —
 * closes both known write-endpoint gaps (POST /checkpoints, PUT /experiments/:slug) via one
 * globally-registered guard, so the latter is covered automatically once its controller merges.
 */
@Injectable()
export class SharedSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestLike>();
    if (request.method === "GET") {
      return true;
    }

    const { API_SHARED_SECRET } = Effect.runSync(this.config.load());
    if (!API_SHARED_SECRET) {
      return true;
    }

    const header = request.headers["authorization"];
    const provided = typeof header === "string" ? header.match(/^Bearer\s+(.+)$/i)?.[1] : undefined;
    if (provided !== API_SHARED_SECRET) {
      throw new UnauthorizedException("Missing or invalid credentials");
    }
    return true;
  }
}
