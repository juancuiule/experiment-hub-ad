import { Effect } from "effect";
import { UnavailableError } from "../common/effect/errors";

export interface ExperimentRecord {
  readonly id: string;
  readonly experimentSlug: string;
  readonly flow: unknown;
  readonly createdAt: string;
}

// Behind an interface (same pattern as CheckpointsRepository) so the
// ORM/driver choice doesn't leak into the service or controller.
export interface ExperimentsRepository {
  upsert(slug: string, flow: unknown): Effect.Effect<ExperimentRecord, UnavailableError>;
  findBySlug(slug: string): Effect.Effect<ExperimentRecord | null, UnavailableError>;
}

export const EXPERIMENTS_REPOSITORY = Symbol("EXPERIMENTS_REPOSITORY");
