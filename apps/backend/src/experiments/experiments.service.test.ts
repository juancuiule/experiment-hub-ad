import { Cause, Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { NotFoundError, UnavailableError, ValidationError } from "../common/effect/errors";
import { ExperimentsService } from "./experiments.service";
import { ExperimentRecord, ExperimentsRepository } from "./experiments.repository";

function failureOf(exit: Exit.Exit<unknown, unknown>) {
  if (Exit.isSuccess(exit)) {
    throw new Error("expected a failure exit");
  }
  const failure = Cause.failureOption(exit.cause);
  if (failure._tag !== "Some") {
    throw new Error("expected a Fail cause, got a defect/interruption");
  }
  return failure.value;
}

// Mimics onConflictDoUpdate semantics for a real Postgres unique index on
// experimentSlug: first write for a slug sets createdAt/updatedAt together,
// a repeat write to the same slug keeps the original createdAt and only
// advances updatedAt — the same contract DrizzleExperimentsRepository's
// `.onConflictDoUpdate({ set: { flow, updatedAt: sql\`now()\` } })` provides.
// Real onConflictDoUpdate SQL behavior against Postgres is verified manually
// (docs/backend-service.md's convention for this backend — no Postgres
// service is wired into CI, see .github/workflows/tests.yml).
class FakeRepository implements ExperimentsRepository {
  public upserted: { slug: string; flow: unknown }[] = [];
  private stored = new Map<string, { flow: unknown; createdAt: string; updatedAt: string }>();
  private clock = 0;

  constructor(private readonly fail = false) {}

  private now(): string {
    this.clock += 1;
    return `2026-08-14T00:00:0${this.clock}.000Z`;
  }

  upsert(slug: string, flow: unknown): Effect.Effect<ExperimentRecord, UnavailableError> {
    if (this.fail) {
      return Effect.fail(new UnavailableError({ message: "db unavailable" }));
    }
    this.upserted.push({ slug, flow });
    const existing = this.stored.get(slug);
    const createdAt = existing?.createdAt ?? this.now();
    const updatedAt = this.now();
    this.stored.set(slug, { flow, createdAt, updatedAt });
    return Effect.succeed({
      id: "00000000-0000-0000-0000-000000000000",
      experimentSlug: slug,
      flow,
      createdAt,
      updatedAt,
    });
  }

  findBySlug(slug: string): Effect.Effect<ExperimentRecord | null, UnavailableError> {
    if (this.fail) {
      return Effect.fail(new UnavailableError({ message: "db unavailable" }));
    }
    const row = this.stored.get(slug);
    if (!row) {
      return Effect.succeed(null);
    }
    return Effect.succeed({
      id: "00000000-0000-0000-0000-000000000000",
      experimentSlug: slug,
      flow: row.flow,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
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

const validFlowV2 = {
  ...validFlow,
  screens: [{ slug: "welcome", components: [], title: "v2" }],
};

// Missing edges entirely — checkNodes/checkEdgeWiring will report real
// validateExperiment() errors, not just an envelope/schema failure.
const malformedFlow = {
  nodes: [start, screen, end],
  edges: [],
  screens: [{ slug: "welcome", components: [] }],
};

// Reads the domain-error tag off a failed Exit, defaulting to undefined for
// a defect (Die) so `expect(tag).toBe("ValidationError")` fails loudly on a
// 500-shaped failure instead of just passing on any Exit.isFailure().
function failureTag(exit: Exit.Exit<unknown, { readonly _tag: string }>): string | undefined {
  if (!Exit.isFailure(exit)) return undefined;
  const failure = Cause.failureOption(exit.cause);
  return failure._tag === "Some" ? failure.value._tag : undefined;
}

describe("ExperimentsService", () => {
  describe("put", () => {
    it("accepts a valid ExperimentFlow and persists it", async () => {
      const repository = new FakeRepository();
      const service = new ExperimentsService(repository);

      const result = await Effect.runPromise(service.put("ocean", validFlow));

      expect(result).toEqual({
        experimentSlug: "ocean",
        createdAt: "2026-08-14T00:00:01.000Z",
        updatedAt: "2026-08-14T00:00:02.000Z",
      });
      expect(repository.upserted).toHaveLength(1);
      expect(repository.upserted[0].slug).toBe("ocean");
    });

    it("persists the original payload verbatim, not a schema-decoded copy", async () => {
      // Guards against #20: Schema.decodeUnknown(ExperimentFlowPayloadSchema)
      // strips properties the envelope doesn't declare, so if the service ever
      // starts persisting the decoded value again, a field the engine adds to
      // ExperimentFlow later would silently vanish here without failing.
      const repository = new FakeRepository();
      const service = new ExperimentsService(repository);
      const payloadWithExtraField = { ...validFlow, futureEngineField: { nested: true } };

      await Effect.runPromise(service.put("ocean", payloadWithExtraField));

      expect(repository.upserted[0].flow).toEqual(payloadWithExtraField);
      expect((repository.upserted[0].flow as Record<string, unknown>).futureEngineField).toEqual({
        nested: true,
      });
    });

    it("republishing the same slug preserves createdAt and advances updatedAt", async () => {
      const repository = new FakeRepository();
      const service = new ExperimentsService(repository);

      const first = await Effect.runPromise(service.put("ocean", validFlow));
      const second = await Effect.runPromise(service.put("ocean", validFlowV2));

      expect(repository.upserted).toHaveLength(2);
      expect(second.createdAt).toBe(first.createdAt);
      expect(second.updatedAt).not.toBe(first.updatedAt);
    });

    it("rejects a flow that fails validateExperiment() and does not persist it", async () => {
      const repository = new FakeRepository();
      const service = new ExperimentsService(repository);

      const exit = await Effect.runPromiseExit(service.put("ocean", malformedFlow));

      expect(failureTag(exit)).toBe("ValidationError");
      expect(repository.upserted).toHaveLength(0);
    });

    it("rejects a payload missing nodes/edges entirely", async () => {
      const repository = new FakeRepository();
      const service = new ExperimentsService(repository);

      const exit = await Effect.runPromiseExit(service.put("ocean", { foo: "bar" }));

      expect(failureTag(exit)).toBe("ValidationError");
      expect(repository.upserted).toHaveLength(0);
    });

    // GH #19: nodes: [null] and nodes: [{ type: 'screen' }] pass the envelope
    // schema (nodes is just Schema.Array(Schema.Unknown)) but crash
    // validateExperiment() itself — e.g. "Cannot read properties of null
    // (reading 'id')". Without Effect.try around the call, that throw became
    // an unhandled defect and runController (common/effect/run.ts) rethrew it
    // as-is, producing a 500 instead of a 400 for a client input error.
    it.each([
      ["a null node entry", { nodes: [null], edges: [] }],
      ["a node missing required props", { nodes: [{ type: "screen" }], edges: [] }],
    ])("rejects a structurally malformed graph (%s) as a ValidationError, not a defect", async (_case, flow) => {
      const repository = new FakeRepository();
      const service = new ExperimentsService(repository);

      const exit = await Effect.runPromiseExit(service.put("ocean", flow));

      expect(failureTag(exit)).toBe("ValidationError");
      expect(repository.upserted).toHaveLength(0);
    });

    it("rejects a slug that doesn't match the allowed pattern", async () => {
      const repository = new FakeRepository();
      const service = new ExperimentsService(repository);

      const exit = await Effect.runPromiseExit(service.put("  ../weird slug", validFlow));

      expect(Exit.isFailure(exit)).toBe(true);
      expect(failureOf(exit)).toBeInstanceOf(ValidationError);
      expect(repository.upserted).toHaveLength(0);
    });

    it("rejects a payload slug that doesn't match the URL slug", async () => {
      const repository = new FakeRepository();
      const service = new ExperimentsService(repository);

      const exit = await Effect.runPromiseExit(
        service.put("ocean", { ...validFlow, slug: "ocaen" }),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      expect(failureOf(exit)).toBeInstanceOf(ValidationError);
      expect(repository.upserted).toHaveLength(0);
    });

    it("accepts a payload slug that matches the URL slug", async () => {
      const repository = new FakeRepository();
      const service = new ExperimentsService(repository);

      const result = await Effect.runPromise(
        service.put("ocean", { ...validFlow, slug: "ocean" }),
      );

      expect(result.experimentSlug).toBe("ocean");
      expect(repository.upserted).toHaveLength(1);
    });

    it("propagates an UnavailableError from the repository", async () => {
      const repository = new FakeRepository(true);
      const service = new ExperimentsService(repository);

      const exit = await Effect.runPromiseExit(service.put("ocean", validFlow));

      expect(Exit.isFailure(exit)).toBe(true);
      expect(failureOf(exit)).toBeInstanceOf(UnavailableError);
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
      expect(failureOf(exit)).toBeInstanceOf(NotFoundError);
    });

    it("fails with an UnavailableError when the repository is unavailable", async () => {
      const repository = new FakeRepository(true);
      const service = new ExperimentsService(repository);

      const exit = await Effect.runPromiseExit(service.get("ocean"));

      expect(Exit.isFailure(exit)).toBe(true);
      expect(failureOf(exit)).toBeInstanceOf(UnavailableError);
    });
  });
});
