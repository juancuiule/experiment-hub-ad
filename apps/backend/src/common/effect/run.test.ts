import { InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { NotFoundError, UnavailableError } from "./errors";
import { runController } from "./run";

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
});
