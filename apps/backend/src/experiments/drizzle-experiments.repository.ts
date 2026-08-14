import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { DbService } from "../db/db.service";
import { experiments } from "../db/schema";
import { UnavailableError } from "../common/effect/errors";
import { ExperimentRecord, ExperimentsRepository } from "./experiments.repository";

@Injectable()
export class DrizzleExperimentsRepository implements ExperimentsRepository {
  constructor(private readonly dbService: DbService) {}

  upsert(slug: string, flow: unknown): Effect.Effect<ExperimentRecord, UnavailableError> {
    return Effect.tryPromise({
      try: async () => {
        const [row] = await this.dbService.db
          .insert(experiments)
          .values({ experimentSlug: slug, flow })
          .onConflictDoUpdate({
            target: experiments.experimentSlug,
            set: { flow },
          })
          .returning();
        return {
          id: row.id,
          experimentSlug: row.experimentSlug,
          flow: row.flow,
          createdAt: row.createdAt,
        };
      },
      catch: (cause) => new UnavailableError({ message: "Failed to persist experiment", cause }),
    });
  }

  findBySlug(slug: string): Effect.Effect<ExperimentRecord | null, UnavailableError> {
    return Effect.tryPromise({
      try: async () => {
        const [row] = await this.dbService.db
          .select()
          .from(experiments)
          .where(eq(experiments.experimentSlug, slug))
          .limit(1);
        if (!row) {
          return null;
        }
        return {
          id: row.id,
          experimentSlug: row.experimentSlug,
          flow: row.flow,
          createdAt: row.createdAt,
        };
      },
      catch: (cause) => new UnavailableError({ message: "Failed to read experiment", cause }),
    });
  }
}
