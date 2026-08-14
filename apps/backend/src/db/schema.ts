import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Hybrid relational + JSONB schema (docs/backend-service.md §5): relational
// columns for everything queried/filtered/joined on, one jsonb column for the
// engine's Context, whose shape is experiment-defined and not known here.
export const checkpoints = pgTable(
  "checkpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    experimentSlug: text("experiment_slug").notNull(),
    sessionId: text("session_id").notNull(),
    checkpointName: text("checkpoint_name").notNull(),
    stepId: text("step_id"),
    context: jsonb("context").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("checkpoints_experiment_slug_idx").on(table.experimentSlug),
    index("checkpoints_session_id_idx").on(table.sessionId),
    index("checkpoints_created_at_idx").on(table.createdAt),
  ],
);

export type CheckpointRow = typeof checkpoints.$inferSelect;
export type NewCheckpointRow = typeof checkpoints.$inferInsert;
