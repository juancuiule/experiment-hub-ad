import { Controller, Get } from "@nestjs/common";
import { runController } from "../common/effect/run";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check() {
    return runController(this.healthService.check());
  }
}
