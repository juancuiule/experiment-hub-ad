import { Test } from "@nestjs/testing";
import { HttpException } from "@nestjs/common";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { NotFoundError, UnavailableError, ValidationError } from "../common/effect/errors";
import { ExperimentsController } from "./experiments.controller";
import { ExperimentsService } from "./experiments.service";

async function buildController(fakeService: Partial<ExperimentsService>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [ExperimentsController],
    providers: [{ provide: ExperimentsService, useValue: fakeService }],
  }).compile();
  return moduleRef.get(ExperimentsController);
}

describe("ExperimentsController", () => {
  it("returns the slug, createdAt, and updatedAt on a successful write", async () => {
    const controller = await buildController({
      put: () =>
        Effect.succeed({
          experimentSlug: "ocean",
          createdAt: "2026-08-14T00:00:00.000Z",
          updatedAt: "2026-08-14T00:00:00.000Z",
        }),
    });

    const result = await controller.put("ocean", {});

    expect(result).toEqual({
      experimentSlug: "ocean",
      createdAt: "2026-08-14T00:00:00.000Z",
      updatedAt: "2026-08-14T00:00:00.000Z",
    });
  });

  it("maps a ValidationError to a 400 HttpException on write", async () => {
    const controller = await buildController({
      put: () => Effect.fail(new ValidationError({ message: "bad payload" })),
    });

    try {
      await controller.put("ocean", {});
      throw new Error("expected controller.put to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(400);
    }
  });

  it("maps an UnavailableError to a 500 HttpException on write", async () => {
    const controller = await buildController({
      put: () => Effect.fail(new UnavailableError({ message: "db unavailable" })),
    });

    try {
      await controller.put("ocean", {});
      throw new Error("expected controller.put to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(500);
    }
  });

  it("returns the stored flow on a successful read", async () => {
    const flow = { nodes: [], edges: [] };
    const controller = await buildController({
      get: () => Effect.succeed(flow),
    });

    const result = await controller.get("ocean");

    expect(result).toEqual(flow);
  });

  it("maps a NotFoundError to a 404 HttpException on read", async () => {
    const controller = await buildController({
      get: () => Effect.fail(new NotFoundError({ resource: "experiment", id: "missing" })),
    });

    try {
      await controller.get("missing");
      throw new Error("expected controller.get to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(404);
    }
  });

  it("maps an UnavailableError to a 500 HttpException on read", async () => {
    const controller = await buildController({
      get: () => Effect.fail(new UnavailableError({ message: "db unavailable" })),
    });

    try {
      await controller.get("ocean");
      throw new Error("expected controller.get to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(500);
    }
  });
});
