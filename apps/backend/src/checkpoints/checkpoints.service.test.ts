import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { UnavailableError } from "../common/effect/errors";
import { CheckpointsService } from "./checkpoints.service";
import { CheckpointInput, CheckpointRecord, CheckpointsRepository } from "./checkpoints.repository";

class FakeRepository implements CheckpointsRepository {
  public inserted: CheckpointInput[] = [];
  constructor(private readonly fail = false) {}

  insert(input: CheckpointInput): Effect.Effect<CheckpointRecord, UnavailableError> {
    if (this.fail) {
      return Effect.fail(new UnavailableError({ message: "db unavailable" }));
    }
    this.inserted.push(input);
    return Effect.succeed({
      ...input,
      id: "00000000-0000-0000-0000-000000000000",
      createdAt: "2026-08-14T00:00:00.000Z",
    });
  }
}

const validPayload = {
  experimentSlug: "ocean",
  sessionId: "session-1",
  checkpointName: "intro-complete",
  context: { data: { age: 30 } },
};

describe("CheckpointsService", () => {
  it("persists a valid payload and returns id + createdAt", async () => {
    const repository = new FakeRepository();
    const service = new CheckpointsService(repository);

    const result = await Effect.runPromise(service.record(validPayload));

    expect(result).toEqual({
      id: "00000000-0000-0000-0000-000000000000",
      createdAt: "2026-08-14T00:00:00.000Z",
    });
    expect(repository.inserted).toHaveLength(1);
  });

  it("defaults stepId to null when omitted", async () => {
    const repository = new FakeRepository();
    const service = new CheckpointsService(repository);

    await Effect.runPromise(service.record(validPayload));

    expect(repository.inserted[0].stepId).toBeNull();
  });

  it("passes through an explicit stepId", async () => {
    const repository = new FakeRepository();
    const service = new CheckpointsService(repository);

    await Effect.runPromise(service.record({ ...validPayload, stepId: "screen-3" }));

    expect(repository.inserted[0].stepId).toBe("screen-3");
  });

  it("fails with a ValidationError when experimentSlug is missing", async () => {
    const repository = new FakeRepository();
    const service = new CheckpointsService(repository);

    const exit = await Effect.runPromiseExit(
      service.record({ ...validPayload, experimentSlug: undefined }),
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("fails with a ValidationError for an empty sessionId", async () => {
    const repository = new FakeRepository();
    const service = new CheckpointsService(repository);

    const exit = await Effect.runPromiseExit(service.record({ ...validPayload, sessionId: "" }));

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("propagates an UnavailableError from the repository", async () => {
    const repository = new FakeRepository(true);
    const service = new CheckpointsService(repository);

    const exit = await Effect.runPromiseExit(service.record(validPayload));

    expect(Exit.isFailure(exit)).toBe(true);
  });
});
