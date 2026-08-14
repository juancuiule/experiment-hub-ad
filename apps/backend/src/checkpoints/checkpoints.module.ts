import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module";
import { CheckpointsController } from "./checkpoints.controller";
import { CheckpointsService } from "./checkpoints.service";
import { CHECKPOINTS_REPOSITORY } from "./checkpoints.repository";
import { DrizzleCheckpointsRepository } from "./drizzle-checkpoints.repository";

@Module({
  imports: [DbModule],
  controllers: [CheckpointsController],
  providers: [
    CheckpointsService,
    { provide: CHECKPOINTS_REPOSITORY, useClass: DrizzleCheckpointsRepository },
  ],
})
export class CheckpointsModule {}
