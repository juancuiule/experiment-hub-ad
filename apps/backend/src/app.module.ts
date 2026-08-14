import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { LoggingModule } from "./logging/logging.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [ConfigModule, LoggingModule, HealthModule],
})
export class AppModule {}
