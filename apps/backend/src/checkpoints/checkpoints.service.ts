import { Inject, Injectable } from "@nestjs/common";
import { Effect, Schema } from "effect";
import { UnavailableError, ValidationError } from "../common/effect/errors";
import { CHECKPOINTS_REPOSITORY, CheckpointsRepository } from "./checkpoints.repository";

// `context` is intentionally `Schema.Unknown`: it's the engine's Context
// snapshot, whose shape is experiment-defined (see docs/backend-service.md
// §5) — this service persists it verbatim rather than validating its shape.
const CheckpointPayloadSchema = Schema.Struct({
  experimentSlug: Schema.String.pipe(Schema.minLength(1)),
  sessionId: Schema.String.pipe(Schema.minLength(1)),
  checkpointName: Schema.String.pipe(Schema.minLength(1)),
  stepId: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  context: Schema.Unknown,
});

export interface CheckpointResponse {
  readonly id: string;
  readonly createdAt: string;
}

@Injectable()
export class CheckpointsService {
  constructor(
    @Inject(CHECKPOINTS_REPOSITORY) private readonly repository: CheckpointsRepository,
  ) {}

  record(
    payload: unknown,
  ): Effect.Effect<CheckpointResponse, ValidationError | UnavailableError> {
    return Schema.decodeUnknown(CheckpointPayloadSchema)(payload).pipe(
      Effect.mapError(
        (parseError) =>
          new ValidationError({
            message: "Invalid checkpoint payload",
            issues: [parseError.message],
          }),
      ),
      Effect.flatMap((decoded) => this.repository.insert(decoded)),
      Effect.map((record) => ({ id: record.id, createdAt: record.createdAt })),
    );
  }
}
