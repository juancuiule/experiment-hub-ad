import { Injectable } from "@nestjs/common";
import { Effect, Schema } from "effect";
import { ValidationError } from "../common/effect/errors";

// Matches docker-compose.yml. Only ever used outside production: production
// must supply DATABASE_URL, so a shipped default can't silently become the
// credentials a deployment runs on.
const LOCAL_DEV_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/experiment_hub";
const LOCAL_DEV_CORS_ORIGINS = "http://localhost:3000";

// Comma-separated origin allowlist, e.g. "https://app.example.com,https://admin.example.com".
const OriginList = Schema.transform(Schema.String, Schema.Array(Schema.String), {
  strict: true,
  decode: (raw) =>
    raw
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  encode: (origins) => origins.join(","),
});

const EnvSchema = Schema.Struct({
  PORT: Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
  NODE_ENV: Schema.optionalWith(Schema.Literal("development", "test", "production"), {
    default: () => "development" as const,
  }),
  DATABASE_URL: Schema.String.pipe(Schema.minLength(1)),
  CORS_ORIGINS: OriginList,
});

export type AppConfig = Schema.Schema.Type<typeof EnvSchema>;

@Injectable()
export class ConfigService {
  load(env: NodeJS.ProcessEnv = process.env): Effect.Effect<AppConfig, ValidationError> {
    const isProduction = env.NODE_ENV === "production";
    return Schema.decodeUnknown(EnvSchema)({
      PORT: env.PORT ?? "3001",
      NODE_ENV: env.NODE_ENV,
      DATABASE_URL: env.DATABASE_URL ?? (isProduction ? undefined : LOCAL_DEV_DATABASE_URL),
      // An empty allowlist in production means no cross-origin browser caller
      // is trusted until CORS_ORIGINS is set explicitly.
      CORS_ORIGINS: env.CORS_ORIGINS ?? (isProduction ? "" : LOCAL_DEV_CORS_ORIGINS),
    }).pipe(
      Effect.mapError(
        (parseError) =>
          new ValidationError({
            message: "Invalid environment configuration",
            issues: [parseError.message],
          }),
      ),
    );
  }
}
