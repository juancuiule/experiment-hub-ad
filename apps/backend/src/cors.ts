import { INestApplication } from "@nestjs/common";

// Frontend dev origin (apps/frontend runs on :3000, backend on :3001 — see
// CLAUDE.md "Environment variables"). Exported so the same policy backs both
// the real bootstrap (main.ts) and the HTTP integration test that exercises
// a real preflight + checkpoint POST.
export const ALLOWED_ORIGINS = ["http://localhost:3000"];

export function enableCors(app: INestApplication): void {
  app.enableCors({ origin: ALLOWED_ORIGINS });
}
