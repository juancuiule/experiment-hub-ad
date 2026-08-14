import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  await app.listen(process.env.PORT ?? 3001);
}

bootstrap().catch((error) => {
  // Nest's logger isn't available when bootstrap itself fails (bad config,
  // port in use), so log to stderr and exit non-zero instead of dying as an
  // unhandled rejection with no diagnostics.
  console.error("Failed to bootstrap the backend:", error);
  process.exit(1);
});
