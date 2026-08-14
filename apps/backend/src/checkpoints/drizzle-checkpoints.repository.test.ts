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

// Minimal stand-in for the Drizzle query builder chains used by insert():
// the insert().values().onConflictDoNothing().returning() chain, and the
// select().from().where().limit() fallback used when a conflict means
// returning() comes back empty.
function fakeDbService(
  returning: () => Promise<unknown[]>,
  select: () => Promise<unknown[]> = async () => [],
): DbService {
  return {
    db: {
      insert: () => ({ values: () => ({ onConflictDoNothing: () => ({ returning }) }) }),
      select: () => ({ from: () => ({ where: () => ({ limit: select }) }) }),
    },
  } as unknown as DbService;
}

describe("DrizzleCheckpointsRepository", () => {
  it("returns the inserted row", async () => {
    const row = { ...input, id: "id-1", createdAt: "2026-08-14T00:00:00.000Z" };
    const repository = new DrizzleCheckpointsRepository(fakeDbService(async () => [row]));

    await expect(Effect.runPromise(repository.insert(input))).resolves.toEqual(row);
  });

  it("falls back to the existing row when a retried POST conflicts on the unique index", async () => {
    const row = { ...input, id: "id-1", createdAt: "2026-08-14T00:00:00.000Z" };
    const repository = new DrizzleCheckpointsRepository(
      fakeDbService(
        async () => [],
        async () => [row],
      ),
    );

    await expect(Effect.runPromise(repository.insert(input))).resolves.toEqual(row);
  });

  it("fails with an UnavailableError when the insert conflicts and no existing row is found", async () => {
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
