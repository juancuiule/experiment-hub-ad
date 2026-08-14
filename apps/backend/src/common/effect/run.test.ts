import { NotFoundException } from "@nestjs/common";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { NotFoundError } from "./errors";
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
});
