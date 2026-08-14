import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import { ConfigService } from "../config/config.service";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

describe("HealthController", () => {
  it("reports ok status with the resolved environment", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService, ConfigService],
    }).compile();

    const controller = moduleRef.get(HealthController);
    const result = await controller.check();

    expect(result).toMatchObject({ status: "ok" });
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
