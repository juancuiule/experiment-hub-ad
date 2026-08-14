import { defineConfig } from "drizzle-kit";

// Local-dev default only (matches docker-compose.yml); migrating anything else
// requires an explicit DATABASE_URL.
const LOCAL_DEV_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/experiment_hub";

const url =
  process.env.DATABASE_URL ??
  (process.env.NODE_ENV === "production" ? undefined : LOCAL_DEV_DATABASE_URL);

if (!url) {
  throw new Error("DATABASE_URL must be set when NODE_ENV=production");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
});
