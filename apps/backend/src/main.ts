import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Effect } from "effect";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { ConfigService } from "./config/config.service";

// Explicit cap on what an unauthenticated caller can push into Postgres per
// request. Checkpoint contexts are one experiment run's answers, so this is
// well above any legitimate payload.
const MAX_BODY_SIZE = "100kb";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const { PORT, CORS_ORIGINS } = Effect.runSync(app.get(ConfigService).load());

  app.useBodyParser("json", { limit: MAX_BODY_SIZE });
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
