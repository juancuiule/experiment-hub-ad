import { Effect } from "effect";
import { UnavailableError } from "../common/effect/errors";

export interface CheckpointInput {
  readonly experimentSlug: string;
  readonly sessionId: string;
  readonly checkpointName: string;
  readonly stepId: string | null;
  readonly context: unknown;
}

export interface CheckpointRecord extends CheckpointInput {
  readonly id: string;
  readonly createdAt: string;
}

// Behind an interface (per docs/backend-service.md §5) so the ORM/driver
// choice doesn't leak into the service or controller.
export interface CheckpointsRepository {
  insert(input: CheckpointInput): Effect.Effect<CheckpointRecord, UnavailableError>;
}

export const CHECKPOINTS_REPOSITORY = Symbol("CHECKPOINTS_REPOSITORY");
