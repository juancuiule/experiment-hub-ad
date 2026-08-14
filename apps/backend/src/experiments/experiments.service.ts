import { Inject, Injectable } from "@nestjs/common";
import { Effect, Schema } from "effect";
import { validateExperiment } from "@experiment-hub/engine/experiment-validation";
import { ExperimentFlow } from "@experiment-hub/engine/types";
import { NotFoundError, UnavailableError, ValidationError } from "../common/effect/errors";
import { EXPERIMENTS_REPOSITORY, ExperimentRecord, ExperimentsRepository } from "./experiments.repository";

// Only the envelope is schema-checked here (nodes/edges are arrays, options
// keyed by string). The graph's actual shape — node/edge wiring, references,
// reachability — is `validateExperiment()`'s job (packages/engine, unchanged
// per docs/experiment-schema-storage.md §6/§8), not reimplemented here.
const ExperimentFlowPayloadSchema = Schema.Struct({
  nodes: Schema.Array(Schema.Unknown),
  edges: Schema.Array(Schema.Unknown),
  screens: Schema.optional(Schema.Array(Schema.Unknown)),
  options: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  dictionary: Schema.optional(Schema.Unknown),
  defaultLocale: Schema.optional(Schema.String),
});

export interface ExperimentWriteResponse {
  readonly experimentSlug: string;
  readonly createdAt: string;
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
    return Schema.decodeUnknown(ExperimentFlowPayloadSchema)(payload).pipe(
      Effect.mapError(
        (parseError) =>
          new ValidationError({
            message: "Invalid experiment payload",
            issues: [parseError.message],
          }),
      ),
      Effect.flatMap(
        (decoded): Effect.Effect<ExperimentRecord, ValidationError | UnavailableError> => {
          const flow = decoded as unknown as ExperimentFlow;
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
