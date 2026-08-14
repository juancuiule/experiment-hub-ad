import { Injectable } from "@nestjs/common";
import { Effect } from "effect";
import { ConfigService } from "../config/config.service";
import { ValidationError } from "../common/effect/errors";

export interface HealthStatus {
  readonly status: "ok";
  readonly env: string;
  readonly uptimeSeconds: number;
}

@Injectable()
export class HealthService {
  constructor(private readonly config: ConfigService) {}

  check(): Effect.Effect<HealthStatus, ValidationError> {
    return this.config.load().pipe(
      Effect.map((config) => ({
        status: "ok" as const,
        env: config.NODE_ENV,
        uptimeSeconds: Math.floor(process.uptime()),
      })),
    );
  }
}
