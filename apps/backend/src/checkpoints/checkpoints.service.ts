import { Inject, Injectable } from "@nestjs/common";
import { Effect, Schema } from "effect";
import { UnavailableError, ValidationError } from "../common/effect/errors";
import { CHECKPOINTS_REPOSITORY, CheckpointsRepository } from "./checkpoints.repository";

// Identifier columns are `text`, so upper bounds are enforced here: the
// endpoint is unauthenticated, and every value lands in an indexed column.
const MAX_IDENTIFIER_LENGTH = 200;

const Identifier = Schema.String.pipe(
  Schema.minLength(1),
  Schema.maxLength(MAX_IDENTIFIER_LENGTH),
);

// `context` is intentionally `Schema.Unknown`: it's the engine's Context
// snapshot, whose shape is experiment-defined (see docs/backend-service.md
// §5) — this service persists it verbatim rather than validating its shape.
const CheckpointPayloadSchema = Schema.Struct({
  experimentSlug: Identifier,
  sessionId: Identifier,
  checkpointName: Identifier,
  stepId: Schema.optionalWith(
    Schema.NullOr(Schema.String.pipe(Schema.maxLength(MAX_IDENTIFIER_LENGTH))),
    { default: () => null },
  ),
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
