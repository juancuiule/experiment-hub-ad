import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module";
import { ExperimentsController } from "./experiments.controller";
import { ExperimentsService } from "./experiments.service";
import { EXPERIMENTS_REPOSITORY } from "./experiments.repository";
import { DrizzleExperimentsRepository } from "./drizzle-experiments.repository";

@Module({
  imports: [DbModule],
  controllers: [ExperimentsController],
  providers: [
    ExperimentsService,
    { provide: EXPERIMENTS_REPOSITORY, useClass: DrizzleExperimentsRepository },
  ],
})
export class ExperimentsModule {}
