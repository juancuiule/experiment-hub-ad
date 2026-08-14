import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { runController } from "../common/effect/run";
import { ExperimentsService } from "./experiments.service";

@Controller("experiments")
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  @Put(":slug")
  put(@Param("slug") slug: string, @Body() body: unknown) {
    return runController(this.experimentsService.put(slug, body));
  }

  @Get(":slug")
  get(@Param("slug") slug: string) {
    return runController(this.experimentsService.get(slug));
  }
}
