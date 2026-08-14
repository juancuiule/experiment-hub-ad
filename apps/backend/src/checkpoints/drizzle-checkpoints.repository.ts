import { Injectable } from "@nestjs/common";
import { Effect } from "effect";
import { DbService } from "../db/db.service";
import { checkpoints } from "../db/schema";
import { UnavailableError } from "../common/effect/errors";
import {
  CheckpointInput,
  CheckpointRecord,
  CheckpointsRepository,
} from "./checkpoints.repository";

@Injectable()
export class DrizzleCheckpointsRepository implements CheckpointsRepository {
  constructor(private readonly dbService: DbService) {}

  insert(input: CheckpointInput): Effect.Effect<CheckpointRecord, UnavailableError> {
    return Effect.tryPromise({
      try: async () => {
        const [row] = await this.dbService.db
          .insert(checkpoints)
          .values({
            experimentSlug: input.experimentSlug,
            sessionId: input.sessionId,
            checkpointName: input.checkpointName,
            stepId: input.stepId,
            context: input.context,
          })
          .returning();
        return {
          id: row.id,
          experimentSlug: row.experimentSlug,
          sessionId: row.sessionId,
          checkpointName: row.checkpointName,
          stepId: row.stepId,
          context: row.context,
          createdAt: row.createdAt,
        };
      },
      catch: (cause) => new UnavailableError({ message: "Failed to persist checkpoint", cause }),
    });
  }
}
