import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { DbService } from "../db/db.service";
import { UnavailableError } from "../common/effect/errors";
import { DrizzleCheckpointsRepository } from "./drizzle-checkpoints.repository";

const input = {
  experimentSlug: "ocean",
  sessionId: "session-1",
  checkpointName: "intro-complete",
  stepId: null,
  context: { data: {} },
};

// Minimal stand-in for the Drizzle query builder chain used by insert().
function fakeDbService(returning: () => Promise<unknown[]>): DbService {
  return {
    db: {
      insert: () => ({ values: () => ({ returning }) }),
    },
  } as unknown as DbService;
}

describe("DrizzleCheckpointsRepository", () => {
  it("returns the inserted row", async () => {
    const row = { ...input, id: "id-1", createdAt: "2026-08-14T00:00:00.000Z" };
    const repository = new DrizzleCheckpointsRepository(fakeDbService(async () => [row]));

    await expect(Effect.runPromise(repository.insert(input))).resolves.toEqual(row);
  });

  it("fails with an UnavailableError when the insert returns no row", async () => {
    const repository = new DrizzleCheckpointsRepository(fakeDbService(async () => []));

    const exit = await Effect.runPromiseExit(repository.insert(input));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const error = exit.cause.toJSON();
      expect(JSON.stringify(error)).toContain("Failed to persist checkpoint");
    }
  });

  it("wraps a driver failure in an UnavailableError carrying the cause", async () => {
    const cause = new Error("connection refused");
    const repository = new DrizzleCheckpointsRepository(
      fakeDbService(() => Promise.reject(cause)),
    );

    const error = await Effect.runPromise(Effect.flip(repository.insert(input)));

    expect(error).toBeInstanceOf(UnavailableError);
    expect(error.cause).toBe(cause);
  });
});
