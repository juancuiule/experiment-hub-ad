# Backend service — scaffold and proposal

Status: **proposal, pending sign-off** (see EXP-9). The scaffold in `apps/backend/` is
functional (boots, serves `GET /health`, has passing tests) but intentionally does not
persist anything yet. Nothing here should be treated as a decision until the open
questions below (mainly §5, the database choice) are confirmed.

## 1. Where the service lives

New package: `apps/backend/` (`@experiment-hub/backend`), alongside `apps/frontend/`
in the pnpm workspace (`pnpm-workspace.yaml` already globs `apps/*`, so no workspace
config change was needed).

Workspace script wiring, in the root `package.json`:

| Script | Behavior |
|---|---|
| `pnpm dev` | unchanged — still `apps/frontend` only, so the existing participant-facing dev flow doesn't change shape |
| `pnpm dev:backend` | new — `nest start --watch` for the backend |
| `pnpm build` / `pnpm start` | unchanged — frontend only |
| `pnpm build:backend` / `pnpm start:backend` | new — backend build/start |
| `pnpm lint` | changed from `--filter frontend` to `pnpm -r lint` — now lints frontend and backend (engine still has no lint script; that's pre-existing and out of scope here) |
| `pnpm typecheck` / `pnpm test` | unchanged (already `pnpm -r ...`) — automatically picked up the backend once it defined matching scripts, no edit needed |

Rationale for *not* collapsing `dev`/`build`/`start` into `pnpm -r`: the frontend and
backend are two different long-running processes with different failure modes (a
backend crash shouldn't take down `next dev`, and vice versa). Until there's an actual
reason to run both from one command (e.g. once the frontend depends on the backend
being up locally), separate scripts are simpler than introducing a process manager
(`concurrently`, `turbo run dev --parallel`, etc.). Worth revisiting once the frontend
engineer's checkpoint-submission work needs the backend running alongside it.

`packages/engine` is untouched — the backend imports it as `@experiment-hub/engine`
(`workspace:*`, already added as a dependency) for any shared types it needs (e.g.
`Context` when validating checkpoint payloads later), the same way the frontend does.
No backend/framework code was added to `packages/engine`.

## 2. Responsibilities and boundaries

**Owns now:**
- Nothing persisted yet — this issue is scaffold-only. `GET /health` is the only route.

**Will own next** (once this proposal is confirmed — see EXP-9's follow-on task):
- Checkpoint persistence: replacing the `send()` stub in
  `apps/frontend/src/data/send.ts` with a real `POST` that this service handles.

**Will own later** (not scoped yet, flagged so the shape of what's built now doesn't
foreclose it):
- Session resume (pairs with re-enabling `Zustand persist` in the frontend — both are
  called out as deliberately-unimplemented in `CLAUDE.md`; they should land together).
- Researcher-facing auth and an experiment-authoring/analytics-export API.

**Explicitly does not own:**
- Flow traversal logic, validation, or schema building — those stay in
  `packages/engine`, which remains framework-agnostic (no NestJS import anywhere
  under `packages/engine/`). The backend calls into the engine as a library, the same
  way the frontend does; it doesn't fork or duplicate its logic.
- Rendering or per-screen form state — that's `apps/frontend`.

## 3. Auth approach (proposal)

Participant-facing and researcher-facing surfaces need different models, so splitting
them from the start avoids retrofitting later:

- **Participant-facing** (checkpoint submission, and later session resume): no login.
  Participants don't have accounts. The proposal is a short-lived, signed **session
  token** minted when a participant starts an experiment (tied to `experimentSlug` +
  a server-generated `sessionId`), sent back on every checkpoint POST and verified
  with a NestJS guard. This prevents one participant's session token from writing
  checkpoints for another session, without requiring any participant identity. Signing
  can be a NestJS-native JWT (`@nestjs/jwt`) with a short expiry refreshed on each
  checkpoint — cheap to implement, no new infra.
- **Researcher-facing** (once an authoring/analytics-export API exists): real
  authentication, most likely email/password or SSO via whatever the DB provider
  offers out of the box (Supabase Auth, if Supabase is chosen in §5 — see the coupling
  note there). Out of scope for this first deliverable; flagging the split now so the
  guard/module layout in §6 has a place for it later (`common/auth/` is reserved,
  currently empty).

Both are guards at the NestJS layer, not something `packages/engine` needs to know
about — the engine has no concept of "who is submitting," only of experiment state.

## 4. Logging / observability approach

`nestjs-pino` (structured JSON logs via `pino`), wired in `src/logging/logging.module.ts`:

- Pretty-printed, single-line output in development (`pino-pretty`); raw JSON in
  production, ready to ship to any log aggregator that ingests JSON lines.
- `req.headers.authorization` and `req.headers.cookie` are redacted unconditionally —
  worth keeping in mind once the participant session token (§3) starts flowing through
  requests.
- Nest's own logger is replaced with the pino instance in `main.ts`
  (`app.useLogger(app.get(Logger))`), so framework-level logs (module init, route
  mapping) and application logs go through the same structured pipeline.

Not yet decided: where logs go in production (stdout only vs. shipping to a
provider). Deferring until there's a real deployment target — premature to pick a log
sink before knowing where this service is hosted.

## 5. Database / persistence — proposal, needs sign-off

Nothing is wired up. This section is the actual decision to confirm before the
follow-on checkpoint-persistence task starts.

**Proposed: Postgres**, specifically via **Supabase** for hosting, for two reasons
specific to this project:

1. **Auth coupling** (§3): Supabase ships row-level-security-backed Postgres auth
   for free, which covers the researcher-facing auth need in §3 without standing up a
   separate auth service. If a different Postgres host is chosen instead (Neon, RDS,
   self-hosted), researcher auth becomes a second decision to make from scratch.
2. **Shape of the data fits relational well**: checkpoint payloads are structured
   (`experimentSlug`, `sessionId`, `stepId`, a JSON `context` blob, a timestamp) with
   clear query patterns (all checkpoints for a session, all sessions for an
   experiment) — nothing here needs a document or graph model.

**Alternatives considered:**
- **Plain Postgres** (self-hosted or RDS/Cloud SQL) — more portable, no vendor
  lock-in, but means building researcher auth separately (see above) and picking a
  hosting target, which is a bigger first decision than this issue's scope.
- **In-memory** — this is what the prior, discarded PR did; explicitly rejected by
  the CEO (see EXP-8 hiring-plan doc rev. 2), so not re-proposing it.

**ORM/access layer**: not decided yet, deliberately — Prisma vs. Drizzle vs. raw
`postgres.js` behind an Effect-wrapped repository is a smaller decision than the
platform itself and doesn't need to block this scaffold's review. Whichever is
chosen, it sits behind a repository interface in `src/checkpoints/` (once that module
exists) so the persistence mechanism doesn't leak into controllers — controllers only
ever see the `Effect`-returning service, same pattern as `HealthService` (§6).

**This is the one open question that actually blocks the next task.** Everything
else in this doc (module layout, auth split, logging) can proceed in parallel or be
adjusted without re-architecting; the DB choice determines what the checkpoint
repository module looks like.

## 6. NestJS + Effect conventions

The scaffold in `apps/backend/src/` demonstrates the pattern with a working example
(`health/`) rather than just describing it:

- **Services return `Effect`, not `Promise`.** `HealthService.check()` returns
  `Effect.Effect<HealthStatus, ValidationError>` — the failure type is part of the
  signature, not a thrown exception a caller has to know about out-of-band.
- **Domain errors are tagged, not stringly-typed.** `src/common/effect/errors.ts`
  defines `NotFoundError`, `ValidationError`, `UnavailableError` via
  `Data.TaggedError`. New failure modes should extend this union rather than throwing
  bare `Error`s or inventing ad hoc string codes.
- **Controllers are a thin Promise adapter, once.** `src/common/effect/run.ts`
  exports `runController()`, which runs a service's `Effect`, maps each `DomainError`
  tag to the matching Nest `HttpException` (`NotFoundError` → 404,
  `ValidationError` → 400, `UnavailableError` → 500), and rethrows anything else
  (a defect — an unexpected throw from a driver, say) unmapped, so Nest's default
  exception filter logs the full cause instead of a squashed generic 500. Every
  controller method should be `return runController(this.someService.someMethod())`
  — see `health/health.controller.ts`. Don't write per-controller try/catch.
- **Env/config validation uses `effect/Schema`, not manual parsing.**
  `src/config/config.service.ts` decodes `process.env` with a `Schema.Struct` and
  maps decode failures to `ValidationError`. This is the pattern to extend for any
  new required env var, rather than reading `process.env.X` inline in a module.
- **Module layout**: one directory per bounded concern
  (`config/`, `logging/`, `health/`, later `checkpoints/`, `auth/`), each with its own
  `*.module.ts`, `*.service.ts` (if it has logic), `*.controller.ts` (if it's
  routed), and colocated `*.test.ts`. `ConfigModule` is `@Global()` since config
  resolution is needed everywhere; other modules should default to *not* global and
  export only what they intend other modules to consume.
- **Testing**: Vitest (matching the rest of the repo, `Vitest 4 + happy-dom` per
  `CLAUDE.md`), not Jest despite that being Nest's default. This required one
  non-obvious piece of wiring: Nest's DI resolves constructor parameter types via
  `emitDecoratorMetadata`, which esbuild (Vitest's default transform) does not
  implement. `apps/backend/vitest.config.ts` uses `unplugin-swc` (`.swcrc` has
  `decoratorMetadata: true`) instead of Vitest's built-in esbuild transform — needed
  in any test file that instantiates a real Nest DI graph via `@nestjs/testing`'s
  `Test.createTestingModule`. Plain unit tests that `new` a service directly (like
  `config.service.test.ts`) don't strictly need it, but it's simplest to apply the
  swc transform repo-wide in this package rather than special-case which test files
  need DI.

## Verification

- `pnpm --filter @experiment-hub/backend typecheck` — passes.
- `pnpm --filter @experiment-hub/backend lint` — passes.
- `pnpm --filter @experiment-hub/backend test` — 6/6 passing (health controller,
  config schema validation success/failure paths, `runController` error mapping).
- `pnpm --filter @experiment-hub/backend build && node dist/main.js` — boots and
  `GET /health` returns `{"status":"ok","env":"development","uptimeSeconds":N}`.
