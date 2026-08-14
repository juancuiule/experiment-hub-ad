import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";

const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT ?? "5mb";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useBodyParser("json", { limit: JSON_BODY_LIMIT });
  app.useLogger(app.get(Logger));
  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();
