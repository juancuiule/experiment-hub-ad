import { Test } from "@nestjs/testing";
import { HttpException } from "@nestjs/common";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { UnavailableError, ValidationError } from "../common/effect/errors";
import { CheckpointsController } from "./checkpoints.controller";
import { CheckpointsService } from "./checkpoints.service";

describe("CheckpointsController", () => {
  it("returns the persisted id and createdAt on success", async () => {
    const fakeService = {
      record: () => Effect.succeed({ id: "abc", createdAt: "2026-08-14T00:00:00.000Z" }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [CheckpointsController],
      providers: [{ provide: CheckpointsService, useValue: fakeService }],
    }).compile();

    const controller = moduleRef.get(CheckpointsController);
    const result = await controller.create({});

    expect(result).toEqual({ id: "abc", createdAt: "2026-08-14T00:00:00.000Z" });
  });

  it("maps a ValidationError to a 400 HttpException", async () => {
    const fakeService = {
      record: () => Effect.fail(new ValidationError({ message: "bad payload" })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [CheckpointsController],
      providers: [{ provide: CheckpointsService, useValue: fakeService }],
    }).compile();

    const controller = moduleRef.get(CheckpointsController);

    await expect(controller.create({})).rejects.toBeInstanceOf(HttpException);
    try {
      await controller.create({});
      throw new Error("expected controller.create to reject");
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(400);
    }
  });

  it("maps an UnavailableError to a 500 HttpException", async () => {
    const fakeService = {
      record: () => Effect.fail(new UnavailableError({ message: "db unavailable" })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [CheckpointsController],
      providers: [{ provide: CheckpointsService, useValue: fakeService }],
    }).compile();

    const controller = moduleRef.get(CheckpointsController);

    try {
      await controller.create({});
      throw new Error("expected controller.create to reject");
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(500);
    }
  });
});
