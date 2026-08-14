import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { checkpoints } from "./schema";

const config = getTableConfig(checkpoints);
const columns = new Map(config.columns.map((column) => [column.name, column]));

describe("checkpoints table", () => {
  it("is named checkpoints and exposes the hybrid relational + jsonb columns", () => {
    expect(config.name).toBe("checkpoints");
    expect([...columns.keys()].sort()).toEqual([
      "checkpoint_name",
      "context",
      "created_at",
      "experiment_slug",
      "id",
      "session_id",
      "step_id",
    ]);
  });

  it("uses a generated uuid primary key and a default created_at", () => {
    const id = columns.get("id")!;
    expect(id.primary).toBe(true);
    expect(id.hasDefault).toBe(true);
    expect(columns.get("created_at")!.hasDefault).toBe(true);
  });

  it("requires every column except step_id", () => {
    expect(columns.get("experiment_slug")!.notNull).toBe(true);
    expect(columns.get("session_id")!.notNull).toBe(true);
    expect(columns.get("checkpoint_name")!.notNull).toBe(true);
    expect(columns.get("context")!.notNull).toBe(true);
    expect(columns.get("step_id")!.notNull).toBe(false);
  });

  it("stores the engine context as jsonb", () => {
    expect(columns.get("context")!.getSQLType()).toBe("jsonb");
  });

  it("indexes the columns checkpoints are queried by", () => {
    const indexes = config.indexes.map((index) => index.config.name).sort();
    expect(indexes).toEqual([
      "checkpoints_created_at_idx",
      "checkpoints_experiment_slug_idx",
      "checkpoints_session_id_idx",
    ]);
  });
});
