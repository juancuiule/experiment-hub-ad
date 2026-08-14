import { Injectable } from "@nestjs/common";
import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
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
        // A retried-but-actually-succeeded POST must not create a duplicate
        // row (see the unique index on session_id + checkpoint_name). On
        // conflict, fetch and return the row that already exists instead.
        const [inserted] = await this.dbService.db
          .insert(checkpoints)
          .values({
            experimentSlug: input.experimentSlug,
            sessionId: input.sessionId,
            checkpointName: input.checkpointName,
            stepId: input.stepId,
            context: input.context,
          })
          .onConflictDoNothing({
            target: [checkpoints.sessionId, checkpoints.checkpointName],
          })
          .returning();

        const row =
          inserted ??
          (
            await this.dbService.db
              .select()
              .from(checkpoints)
              .where(
                and(
                  eq(checkpoints.sessionId, input.sessionId),
                  eq(checkpoints.checkpointName, input.checkpointName),
                ),
              )
              .limit(1)
          )[0];

        if (!row) {
          throw new Error("Checkpoint insert conflicted but no matching row was found");
        }

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
