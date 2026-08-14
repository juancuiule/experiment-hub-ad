import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Effect } from "effect";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";

const DEFAULT_JSON_BODY_LIMIT = "5mb";
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT ?? DEFAULT_JSON_BODY_LIMIT;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useBodyParser("json", { limit: JSON_BODY_LIMIT });
  app.useLogger(app.get(Logger));
  // Nest only invokes OnModuleDestroy hooks (e.g. DbService closing the pg
  // client) on SIGTERM/SIGINT when shutdown hooks are explicitly enabled.
  app.enableShutdownHooks();

  const { PORT, CORS_ORIGINS } = Effect.runSync(app.get(ConfigService).load());
  app.enableCors({
    origin: [...CORS_ORIGINS],
    methods: ["GET", "POST"],
    credentials: false,
    maxAge: 86400,
  });

  await app.listen(PORT);
}

bootstrap().catch((error) => {
  // Nest's logger isn't available when bootstrap itself fails (bad config,
  // port in use), so log to stderr and exit non-zero instead of dying as an
  // unhandled rejection with no diagnostics.
  console.error("Failed to bootstrap the backend:", error);
  process.exit(1);
});
