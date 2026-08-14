import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { DbService } from "../db/db.service";
import { checkpoints } from "../db/schema";
import { UnavailableError } from "../common/effect/errors";
import { CheckpointInput } from "./checkpoints.repository";
import { DrizzleCheckpointsRepository } from "./drizzle-checkpoints.repository";

const input: CheckpointInput = {
  experimentSlug: "ocean",
  sessionId: "session-1",
  checkpointName: "intro-complete",
  stepId: null,
  context: { data: { age: 30 } },
};

const row = {
  id: "00000000-0000-0000-0000-000000000000",
  experimentSlug: "ocean",
  sessionId: "session-1",
  checkpointName: "intro-complete",
  stepId: null,
  context: { data: { age: 30 } },
  createdAt: "2026-08-14T00:00:00.000Z",
  // An extra column the repository is expected to drop from its result.
  internalNote: "not part of CheckpointRecord",
};

type InsertCall = { table: unknown; values: unknown };

// Minimal stand-in for the Drizzle query builder chains used by insert():
// the insert().values().onConflictDoNothing().returning() chain (recording
// the table/values passed to `insert()`/`values()`, for the column-mapping
// tests below), and the select().from().where().limit() fallback used when
// a conflict means returning() comes back empty.
function fakeDbService(options: {
  returning: () => Promise<unknown[]>;
  select?: () => Promise<unknown[]>;
  calls?: InsertCall[];
}): DbService {
  const { returning, select = async () => [], calls } = options;
  return {
    db: {
      insert: (table: unknown) => ({
        values: (values: unknown) => {
          calls?.push({ table, values });
          return { onConflictDoNothing: () => ({ returning }) };
        },
      }),
      select: () => ({ from: () => ({ where: () => ({ limit: select }) }) }),
    },
  } as unknown as DbService;
}

describe("DrizzleCheckpointsRepository", () => {
  it("inserts the checkpoint columns into the checkpoints table", async () => {
    const calls: InsertCall[] = [];
    const repository = new DrizzleCheckpointsRepository(
      fakeDbService({ returning: async () => [row], calls }),
    );

    await Effect.runPromise(repository.insert(input));

    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe(checkpoints);
    expect(calls[0].values).toEqual({
      experimentSlug: "ocean",
      sessionId: "session-1",
      checkpointName: "intro-complete",
      stepId: null,
      context: { data: { age: 30 } },
    });
  });

  it("maps the returned row to a CheckpointRecord without extra columns", async () => {
    const repository = new DrizzleCheckpointsRepository(
      fakeDbService({ returning: async () => [row] }),
    );

    const record = await Effect.runPromise(repository.insert(input));

    expect(record).toEqual({
      id: "00000000-0000-0000-0000-000000000000",
      experimentSlug: "ocean",
      sessionId: "session-1",
      checkpointName: "intro-complete",
      stepId: null,
      context: { data: { age: 30 } },
      createdAt: "2026-08-14T00:00:00.000Z",
    });
  });

  it("passes an explicit stepId through to the insert", async () => {
    const calls: InsertCall[] = [];
    const repository = new DrizzleCheckpointsRepository(
      fakeDbService({ returning: async () => [{ ...row, stepId: "screen-3" }], calls }),
    );

    const record = await Effect.runPromise(repository.insert({ ...input, stepId: "screen-3" }));

    expect((calls[0].values as { stepId: string | null }).stepId).toBe("screen-3");
    expect(record.stepId).toBe("screen-3");
  });

  it("falls back to the existing row when a retried POST conflicts on the unique index", async () => {
    const repository = new DrizzleCheckpointsRepository(
      fakeDbService({
        returning: async () => [],
        select: async () => [row],
      }),
    );

    await expect(Effect.runPromise(repository.insert(input))).resolves.toEqual({
      id: "00000000-0000-0000-0000-000000000000",
      experimentSlug: "ocean",
      sessionId: "session-1",
      checkpointName: "intro-complete",
      stepId: null,
      context: { data: { age: 30 } },
      createdAt: "2026-08-14T00:00:00.000Z",
    });
  });

  it("fails with an UnavailableError when the insert conflicts and no existing row is found", async () => {
    const repository = new DrizzleCheckpointsRepository(
      fakeDbService({ returning: async () => [] }),
    );

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
      fakeDbService({
        returning: () => Promise.reject(cause),
      }),
    );

    const error = await Effect.runPromise(Effect.flip(repository.insert(input)));

    expect(error).toBeInstanceOf(UnavailableError);
    expect(error.cause).toBe(cause);
  });
});
