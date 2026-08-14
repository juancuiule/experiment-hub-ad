import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { LoggingModule } from "./logging/logging.module";
import { HealthModule } from "./health/health.module";
import { CheckpointsModule } from "./checkpoints/checkpoints.module";
import { ExperimentsModule } from "./experiments/experiments.module";

@Module({
  imports: [ConfigModule, LoggingModule, HealthModule, CheckpointsModule, ExperimentsModule],
})
export class AppModule {}
