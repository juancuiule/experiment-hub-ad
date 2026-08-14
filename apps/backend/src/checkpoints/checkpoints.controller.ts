import { Body, Controller, Post } from "@nestjs/common";
import { runController } from "../common/effect/run";
import { CheckpointsService } from "./checkpoints.service";

@Controller("checkpoints")
export class CheckpointsController {
  constructor(private readonly checkpointsService: CheckpointsService) {}

  @Post()
  create(@Body() body: unknown) {
    return runController(this.checkpointsService.record(body));
  }
}
