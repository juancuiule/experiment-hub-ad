import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { NotFoundError, UnavailableError } from "../common/effect/errors";
import { ExperimentsService } from "./experiments.service";
import { ExperimentRecord, ExperimentsRepository } from "./experiments.repository";

class FakeRepository implements ExperimentsRepository {
  public upserted: { slug: string; flow: unknown }[] = [];
  private stored = new Map<string, unknown>();

  constructor(private readonly fail = false) {}

  upsert(slug: string, flow: unknown): Effect.Effect<ExperimentRecord, UnavailableError> {
    if (this.fail) {
      return Effect.fail(new UnavailableError({ message: "db unavailable" }));
    }
    this.upserted.push({ slug, flow });
    this.stored.set(slug, flow);
    return Effect.succeed({
      id: "00000000-0000-0000-0000-000000000000",
      experimentSlug: slug,
      flow,
      createdAt: "2026-08-14T00:00:00.000Z",
    });
  }

  findBySlug(slug: string): Effect.Effect<ExperimentRecord | null, UnavailableError> {
    if (this.fail) {
      return Effect.fail(new UnavailableError({ message: "db unavailable" }));
    }
    const flow = this.stored.get(slug);
    if (flow === undefined) {
      return Effect.succeed(null);
    }
    return Effect.succeed({
      id: "00000000-0000-0000-0000-000000000000",
      experimentSlug: slug,
      flow,
      createdAt: "2026-08-14T00:00:00.000Z",
    });
  }
}

const start = { id: "start", type: "start" as const };
const screen = { id: "s1", type: "screen" as const, props: { slug: "welcome" } };
const end = { id: "end", type: "end" as const };

const validFlow = {
  nodes: [start, screen, end],
  edges: [
    { type: "sequential", from: "start", to: "s1" },
    { type: "sequential", from: "s1", to: "end" },
  ],
  screens: [{ slug: "welcome", components: [] }],
};

// Missing edges entirely — checkNodes/checkEdgeWiring will report real
// validateExperiment() errors, not just an envelope/schema failure.
const malformedFlow = {
  nodes: [start, screen, end],
  edges: [],
  screens: [{ slug: "welcome", components: [] }],
};

describe("ExperimentsService", () => {
  describe("put", () => {
    it("accepts a valid ExperimentFlow and persists it", async () => {
      const repository = new FakeRepository();
      const service = new ExperimentsService(repository);

      const result = await Effect.runPromise(service.put("ocean", validFlow));

      expect(result).toEqual({ experimentSlug: "ocean", createdAt: "2026-08-14T00:00:00.000Z" });
      expect(repository.upserted).toHaveLength(1);
      expect(repository.upserted[0].slug).toBe("ocean");
    });

    it("rejects a flow that fails validateExperiment() and does not persist it", async () => {
      const repository = new FakeRepository();
      const service = new ExperimentsService(repository);

      const exit = await Effect.runPromiseExit(service.put("ocean", malformedFlow));

      expect(Exit.isFailure(exit)).toBe(true);
      expect(repository.upserted).toHaveLength(0);
    });

    it("rejects a payload missing nodes/edges entirely", async () => {
      const repository = new FakeRepository();
      const service = new ExperimentsService(repository);

      const exit = await Effect.runPromiseExit(service.put("ocean", { foo: "bar" }));

      expect(Exit.isFailure(exit)).toBe(true);
      expect(repository.upserted).toHaveLength(0);
    });

    it("propagates an UnavailableError from the repository", async () => {
      const repository = new FakeRepository(true);
      const service = new ExperimentsService(repository);

      const exit = await Effect.runPromiseExit(service.put("ocean", validFlow));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("get", () => {
    it("returns the stored flow for a known slug", async () => {
      const repository = new FakeRepository();
      const service = new ExperimentsService(repository);
      await Effect.runPromise(service.put("ocean", validFlow));

      const result = await Effect.runPromise(service.get("ocean"));

      expect(result).toEqual(validFlow);
    });

    it("fails with a NotFoundError for an unknown slug", async () => {
      const repository = new FakeRepository();
      const service = new ExperimentsService(repository);

      const exit = await Effect.runPromiseExit(service.get("missing"));

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = exit.cause._tag === "Fail" ? exit.cause.error : undefined;
        expect(failure).toBeInstanceOf(NotFoundError);
      }
    });
  });
});
