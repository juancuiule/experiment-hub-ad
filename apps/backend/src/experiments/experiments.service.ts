import { Inject, Injectable } from "@nestjs/common";
import { Effect, Schema } from "effect";
import { validateExperiment } from "@experiment-hub/engine/experiment-validation";
import { ExperimentFlow } from "@experiment-hub/engine/types";
import { NotFoundError, UnavailableError, ValidationError } from "../common/effect/errors";
import { EXPERIMENTS_REPOSITORY, ExperimentRecord, ExperimentsRepository } from "./experiments.repository";

// Lowercase, alphanumeric-and-hyphen, must start alphanumeric — matches the
// slugs this backend actually accepts as URL path segments and Postgres index
// keys. Rejects things like "  ../weird slug" that would otherwise round-trip
// through the URL and land in the unique index verbatim.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const SlugSchema = Schema.String.pipe(Schema.pattern(SLUG_PATTERN));

// Only the envelope is schema-checked here (nodes/edges are arrays, options
// keyed by string). The graph's actual shape — node/edge wiring, references,
// reachability — is `validateExperiment()`'s job (packages/engine, unchanged
// per docs/experiment-schema-storage.md §6/§8), not reimplemented here.
// `slug` is optional and not part of `ExperimentFlow` — it's only read here to
// cross-check against the URL param below, catching operator typos like
// publishing to "ocaen" instead of "ocean".
const ExperimentFlowPayloadSchema = Schema.Struct({
  nodes: Schema.Array(Schema.Unknown),
  edges: Schema.Array(Schema.Unknown),
  screens: Schema.optional(Schema.Array(Schema.Unknown)),
  options: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  dictionary: Schema.optional(Schema.Unknown),
  defaultLocale: Schema.optional(Schema.String),
  slug: Schema.optional(Schema.String),
});

export interface ExperimentWriteResponse {
  readonly experimentSlug: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

@Injectable()
export class ExperimentsService {
  constructor(
    @Inject(EXPERIMENTS_REPOSITORY) private readonly repository: ExperimentsRepository,
  ) {}

  put(
    slug: string,
    payload: unknown,
  ): Effect.Effect<ExperimentWriteResponse, ValidationError | UnavailableError> {
    return Schema.decodeUnknown(SlugSchema)(slug).pipe(
      Effect.mapError(
        () =>
          new ValidationError({
            message: "Invalid experiment slug",
            issues: [`slug must match ${SLUG_PATTERN.source}`],
          }),
      ),
      Effect.flatMap(() =>
        Schema.decodeUnknown(ExperimentFlowPayloadSchema)(payload).pipe(
          Effect.mapError(
            (parseError) =>
              new ValidationError({
                message: "Invalid experiment payload",
                issues: [parseError.message],
              }),
          ),
        ),
      ),
      Effect.flatMap(
        (decoded): Effect.Effect<ExperimentRecord, ValidationError | UnavailableError> => {
          if (decoded.slug !== undefined && decoded.slug !== slug) {
            return Effect.fail(
              new ValidationError({
                message: "Payload slug does not match URL slug",
                issues: [`payload slug "${decoded.slug}" does not match URL slug "${slug}"`],
              }),
            );
          }
          // Persist the original `payload`, not `decoded`: Schema.Struct drops
          // properties it doesn't declare, so persisting `decoded` would
          // silently discard the next field added to ExperimentFlow in
          // packages/engine/types.ts that this envelope hasn't caught up to.
          const flow = payload as ExperimentFlow;
          const graphErrors = validateExperiment(flow);
          if (graphErrors.length > 0) {
            return Effect.fail(
              new ValidationError({
                message: "Experiment failed graph validation",
                issues: graphErrors.map((error) => `[${error.code}] ${error.message}`),
              }),
            );
          }
          return this.repository.upsert(slug, flow);
        },
      ),
      Effect.map((record) => ({
        experimentSlug: record.experimentSlug,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      })),
    );
  }

  get(slug: string): Effect.Effect<ExperimentFlow, NotFoundError | UnavailableError> {
    return this.repository.findBySlug(slug).pipe(
      Effect.flatMap((record) =>
        record
          ? Effect.succeed(record.flow as ExperimentFlow)
          : Effect.fail(new NotFoundError({ resource: "experiment", id: slug })),
      ),
    );
  }
}
