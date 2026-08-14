import { Injectable } from "@nestjs/common";
import { Effect, Schema } from "effect";
import { ValidationError } from "../common/effect/errors";

const EnvSchema = Schema.Struct({
  PORT: Schema.NumberFromString.pipe(Schema.int(), Schema.positive()),
  NODE_ENV: Schema.optionalWith(Schema.Literal("development", "test", "production"), {
    default: () => "development" as const,
  }),
  DATABASE_URL: Schema.String.pipe(Schema.minLength(1)),
});

export type AppConfig = Schema.Schema.Type<typeof EnvSchema>;

@Injectable()
export class ConfigService {
  load(env: NodeJS.ProcessEnv = process.env): Effect.Effect<AppConfig, ValidationError> {
    return Schema.decodeUnknown(EnvSchema)({
      PORT: env.PORT ?? "3001",
      NODE_ENV: env.NODE_ENV,
      DATABASE_URL:
        env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/experiment_hub",
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
