import { Test } from "@nestjs/testing";
import { HttpException } from "@nestjs/common";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "../common/effect/errors";
import { ExperimentsController } from "./experiments.controller";
import { ExperimentsService } from "./experiments.service";

describe("ExperimentsController", () => {
  it("returns the slug and createdAt on a successful write", async () => {
    const fakeService = {
      put: () => Effect.succeed({ experimentSlug: "ocean", createdAt: "2026-08-14T00:00:00.000Z" }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ExperimentsController],
      providers: [{ provide: ExperimentsService, useValue: fakeService }],
    }).compile();

    const controller = moduleRef.get(ExperimentsController);
    const result = await controller.put("ocean", {});

    expect(result).toEqual({ experimentSlug: "ocean", createdAt: "2026-08-14T00:00:00.000Z" });
  });

  it("maps a ValidationError to a 400 HttpException on write", async () => {
    const fakeService = {
      put: () => Effect.fail(new ValidationError({ message: "bad payload" })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ExperimentsController],
      providers: [{ provide: ExperimentsService, useValue: fakeService }],
    }).compile();

    const controller = moduleRef.get(ExperimentsController);

    await expect(controller.put("ocean", {})).rejects.toBeInstanceOf(HttpException);
    try {
      await controller.put("ocean", {});
      throw new Error("expected controller.put to reject");
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(400);
    }
  });

  it("returns the stored flow on a successful read", async () => {
    const flow = { nodes: [], edges: [] };
    const fakeService = {
      get: () => Effect.succeed(flow),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ExperimentsController],
      providers: [{ provide: ExperimentsService, useValue: fakeService }],
    }).compile();

    const controller = moduleRef.get(ExperimentsController);
    const result = await controller.get("ocean");

    expect(result).toEqual(flow);
  });

  it("maps a NotFoundError to a 404 HttpException on read", async () => {
    const fakeService = {
      get: () => Effect.fail(new NotFoundError({ resource: "experiment", id: "missing" })),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ExperimentsController],
      providers: [{ provide: ExperimentsService, useValue: fakeService }],
    }).compile();

    const controller = moduleRef.get(ExperimentsController);

    try {
      await controller.get("missing");
      throw new Error("expected controller.get to reject");
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(404);
    }
  });
});
