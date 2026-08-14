import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { NotFoundError, UnavailableError, ValidationError } from "./errors";
import { runController } from "./run";

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected the promise to reject");
}

describe("runController", () => {
  it("resolves the value on success", async () => {
    const result = await runController(Effect.succeed(42));
    expect(result).toBe(42);
  });

  it("translates a domain error into the matching HttpException", async () => {
    const effect = Effect.fail(new NotFoundError({ resource: "checkpoint", id: "abc" }));
    await expect(runController(effect)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("logs and preserves the underlying cause of an UnavailableError", async () => {
    const logSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const cause = new Error("connection refused");
    const effect = Effect.fail(new UnavailableError({ message: "db down", cause }));

    const error = await runController(effect).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect((error as Error).cause).toBe(cause);
    expect(logSpy).toHaveBeenCalledWith("db down", cause.stack);
    logSpy.mockRestore();
  });

  it("logs a defect before rethrowing it", async () => {
    const logSpy = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const defect = new Error("driver exploded");

    await expect(runController(Effect.die(defect))).rejects.toBe(defect);
    expect(logSpy).toHaveBeenCalledWith(
      "Unexpected defect while running controller effect",
      defect.stack,
    );
    logSpy.mockRestore();
  });

  it("includes the id in the NotFoundError message when present", async () => {
    const error = await rejection(
      runController(Effect.fail(new NotFoundError({ resource: "checkpoint", id: "abc" }))),
    );
    expect((error as HttpException).getResponse()).toMatchObject({
      message: "checkpoint not found: abc",
    });
  });

  it("omits the id from the NotFoundError message when absent", async () => {
    const error = await rejection(
      runController(Effect.fail(new NotFoundError({ resource: "checkpoint" }))),
    );
    expect((error as HttpException).getResponse()).toMatchObject({
      message: "checkpoint not found",
    });
  });

  it("maps a ValidationError to a 400 carrying its issues", async () => {
    const error = await rejection(
      runController(
        Effect.fail(new ValidationError({ message: "bad payload", issues: ["sessionId is empty"] })),
      ),
    );
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as HttpException).getResponse()).toMatchObject({
      message: ["sessionId is empty"],
    });
  });

  it("falls back to the ValidationError message when it carries no issues", async () => {
    const error = await rejection(
      runController(Effect.fail(new ValidationError({ message: "bad payload" }))),
    );
    expect((error as HttpException).getResponse()).toMatchObject({ message: "bad payload" });
  });

  it("maps an UnavailableError to a 500", async () => {
    const error = await rejection(
      runController(Effect.fail(new UnavailableError({ message: "db unavailable" }))),
    );
    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect((error as HttpException).getStatus()).toBe(500);
  });

  it("rethrows a defect as-is instead of squashing it into a 500", async () => {
    const defect = new Error("driver blew up");
    const error = await rejection(runController(Effect.die(defect)));
    expect(error).toBe(defect);
    expect(error).not.toBeInstanceOf(HttpException);
  });
});
