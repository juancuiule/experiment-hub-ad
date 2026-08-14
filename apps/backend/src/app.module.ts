import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "./config/config.module";
import { LoggingModule } from "./logging/logging.module";
import { HealthModule } from "./health/health.module";
import { CheckpointsModule } from "./checkpoints/checkpoints.module";
import { ExperimentsModule } from "./experiments/experiments.module";
import { SharedSecretGuard } from "./common/auth/shared-secret.guard";

@Module({
  imports: [ConfigModule, LoggingModule, HealthModule, CheckpointsModule, ExperimentsModule],
  providers: [{ provide: APP_GUARD, useClass: SharedSecretGuard }],
})
export class AppModule {}
