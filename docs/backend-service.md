# Backend service — scaffold and proposal

Status: **revision 3, approved by CEO 2026-08-14** (see EXP-9). Local Postgres +
the JSONB-hybrid `checkpoints` schema (§5) is the confirmed direction for the
checkpoint-persistence follow-on task. The scaffold in `apps/backend/` is functional
(boots, serves `GET /health`, has passing tests) but intentionally does not persist
anything yet — that's the next task, not this one.

**Revision 2 changes** (per CEO feedback on the first proposal, 2026-08-14): dropped
Supabase entirely — DB is now **local Postgres** (Docker Compose for dev, plain
Postgres in production, no vendor-hosted product), and researcher auth (§3) no longer
depends on Supabase Auth. §5 also now spells out concretely how the engine's
JSON-shaped `Context`/checkpoint data maps onto Postgres's relational model, which the
first revision only gestured at.

**Revision 3 changes** (per CEO approval comment, 2026-08-14): no substantive change
to the DB decision (local Postgres, JSONB-hybrid `checkpoints` table stands). Added
§5's "Future consideration: polyglot persistence" subsection to record two things the
CEO asked to keep on file at approval time: (1) the JSONB-hybrid rationale is the
recorded, agreed shape for `context` storage, and (2) a Postgres+MongoDB polyglot
layer was raised as a possibility for later, explicitly deferred pending evidence of
a real bottleneck — not adopted now.

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
  authentication, self-hosted rather than delegated to a vendor auth product (see §5 —
  Supabase is out). Proposal: a `users` table in our own Postgres (email + password
  hash via `argon2` or `bcrypt`), `@nestjs/passport` with a local strategy for
  login, and `@nestjs/jwt` issuing short-lived access tokens plus a refresh token
  (rotated, stored hashed in a `refresh_tokens` table so a leaked token can be
  revoked). This is more code than "turn on Supabase Auth" but has no external
  dependency and reuses the same JWT machinery already needed for participant
  sessions above — one `auth/` module, two guards (`ParticipantSessionGuard`,
  `ResearcherAuthGuard`), not two auth systems. Out of scope for this first
  deliverable; flagging the approach now so the module layout in §6 has a place for it
  later (`common/auth/` is reserved, currently empty).

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

**Proposed: plain Postgres, no vendor product.** Local dev runs it via Docker Compose
(a `postgres:16` service added to a repo-root `docker-compose.yml`, not yet created —
that's part of the follow-on task, not this scaffold); production runs against
whatever plain Postgres instance we point `DATABASE_URL` at (self-hosted, RDS, Cloud
SQL — the specific host is a deployment decision, deliberately not made here). No
Supabase, no managed-auth-as-a-database-feature — see §3, researcher auth is now our
own code against our own tables, so nothing about the DB choice is coupled to auth
anymore. This directly replaces the prior revision's Supabase proposal per CEO
feedback.

**Alternatives considered:**
- **Supabase** — proposed in the first revision for the free auth integration; dropped
  because the CEO wants local Postgres for now and doesn't want the auth story tied to
  a specific hosted product (§3 already reflects the standalone approach).
- **In-memory** — this is what the prior, discarded PR did; explicitly rejected by
  the CEO (see EXP-8 hiring-plan doc rev. 2), so not re-proposing it.

### JSON-shaped experiment data vs. relational storage

The CEO flagged this as the open question worth thinking through explicitly, so
here's the concrete shape of what gets persisted. `packages/engine/types.ts`'s
`Context` (the object `traverse()` accumulates and mutates across a run) is a
loosely-typed, dynamically-keyed blob:

```ts
type Context = Partial<{
  data: Record<string, any>;              // participant answers, keyed by dataKey — keys are experiment-defined, not known at schema time
  screenData: { foreachData?; shuffledOptions?; shuffledForeachOrders? };
  branches: Record<string, string>;        // which branch was taken, per branch node id
  forks: Record<string, string>;
  paths: { [pathNodeId: string]: { order: string[] } };
  loops: { [loopNodeId: string]: { order: string[]; values: (...)[] } };
  loopData: { [loopNodeId: string]: { value: any; index: number } };
  timings: Record<string, { enteredAt: string; submittedAt: string }>;
  locale: string;
  messages: Record<string, string>;
  checkpoints: { [checkpointName: string]: string };
}>;
```

The keys under `data` (and `branches`, `paths`, `loops`, ...) are named by whatever
`dataKey`s and node ids the researcher chose when authoring a given experiment in
`apps/frontend/src/data/experiments/`. There is no fixed column set across
experiments — one study might key `data.age`, another `data.q1_response`,
`data.trial_3_rt`. Modeling every field as a relational column (or an EAV table with
one row per field) would mean either per-experiment migrations or a `field_name,
field_value` table with no type safety and expensive aggregate queries.

**Recommendation: hybrid.** A `checkpoints` table with real, indexed relational
columns for everything we actually query/filter/join on, plus one `JSONB` column for
the parts of `Context` whose shape is experiment-defined:

| Column | Type | Why relational |
|---|---|---|
| `id` | uuid, pk | — |
| `experiment_slug` | text, indexed | filter "all checkpoints for experiment X" |
| `session_id` | text, indexed | filter/group "all checkpoints for this participant run" |
| `checkpoint_name` | text | which checkpoint node fired — bounded, known at experiment-definition time |
| `step_id` | text, nullable | which step the participant was on |
| `context` | jsonb | the *entire* `Context` snapshot at that checkpoint — `data`, `branches`, `paths`, `loops`, `timings`, etc., verbatim |
| `created_at` | timestamptz, indexed | time-range queries, ordering |

`experiment_slug`, `session_id`, and `created_at` cover the query patterns we
actually have today (all checkpoints for a session, latest checkpoint per session,
all sessions for an experiment) without touching the JSONB payload. The full
`context` blob stays JSONB rather than being decomposed, because:
- it preserves the engine's own shape exactly (no lossy mapping, no drift between
  what `traverse()` produces and what's stored),
- Postgres's JSONB supports indexed queries into it when we need one (a `GIN` index
  on `context -> 'data'`, or a targeted `(context -> 'data' ->> 'some_key')`
  expression index) *after* we know which fields researchers actually query often —
  premature to guess that now,
- analytics/export (flagging per-participant answers, computing per-condition
  summaries) can be done by reading `context->'data'` in application code or via
  Postgres JSON operators in SQL, without a rigid schema blocking a researcher from
  adding a new `dataKey` to their experiment definition.

This is still "structured relational database," not a document store bolted on —
the columns that matter for querying and integrity (which experiment, which session,
when) are real columns with real indexes and foreign-key-able types; only the
part of the payload that is *inherently* researcher-defined and schema-less at
authoring time lives in JSONB. This is a standard, well-supported Postgres pattern
(not a workaround), and keeps the door open to promoting specific `data` keys to real
columns later (e.g. a materialized/generated column) if a specific experiment's
analytics need it, without changing how every other experiment is stored.

**ORM/access layer**: not decided yet, deliberately — Prisma vs. Drizzle vs. raw
`postgres.js` behind an Effect-wrapped repository is a smaller decision than the
platform itself and doesn't need to block this scaffold's review. Whichever is
chosen, it sits behind a repository interface in `src/checkpoints/` (once that module
exists) so the persistence mechanism doesn't leak into controllers — controllers only
ever see the `Effect`-returning service, same pattern as `HealthService` (§6). Note
that Drizzle's `jsonb()` column type and Prisma's `Json` type both handle the
`context` column above natively, so this doesn't narrow the ORM choice either.

**This is the one open question that actually blocks the next task.** Everything
else in this doc (module layout, auth split, logging) can proceed in parallel or be
adjusted without re-architecting; the DB choice and the JSONB-hybrid shape above
determine what the checkpoint repository module and its migration look like.

### Future consideration: polyglot persistence (Postgres + MongoDB in parallel)

Recorded per CEO request on sign-off, not adopted now. The question raised: could
the `context` JSONB column above eventually move to a document store (e.g. MongoDB)
running alongside Postgres, with Postgres keeping the relational data (researchers,
experiments, sessions, auth) and MongoDB owning the schema-less checkpoint payloads?

**Why not now:**
- The JSONB-hybrid table above already gives us most of what a document store would:
  schema-less storage per experiment, no per-experiment migrations, and queryable
  indexes into the blob when needed (§ above).
- A second database is a second thing to run, back up, monitor, and keep consistent
  with the first — for a single service with no production traffic yet, that
  operational cost isn't justified by a query pattern we don't have evidence for.
- Cross-database consistency (a checkpoint write spanning Postgres session/experiment
  rows and a Mongo document) adds a distributed-transaction problem that a single
  Postgres instance with JSONB doesn't have.

**When to revisit:** if, once real experiments are running, `context` JSONB queries
or aggregations become a measured bottleneck that Postgres's JSON operators and GIN
indexes can't address cost-effectively — that's the trigger to prototype a Mongo
(or other document-store) side-by-side, not a decision to make speculatively now.
If revisited, the checkpoint repository interface already isolates the persistence
mechanism behind `src/checkpoints/` (see ORM note above), so swapping or splitting
the backing store there wouldn't require changes outside that module.

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

## 7. Checkpoint persistence (EXP-12, follow-on to this scaffold)

Implements the `POST` this doc's §2/§5 pointed at: `send()` in
`apps/frontend/src/data/send.ts` now POSTs to this service instead of the
100ms `setTimeout` stub.

**ORM/access layer: Drizzle** (`drizzle-orm` + the `postgres` package as the
driver). Chosen over Prisma and raw `postgres.js`-with-hand-written-SQL because:
- its `pgTable`/`jsonb()` column type maps the `context` column (§5) with no
  codegen step (unlike Prisma, which needs `prisma generate` wired into the
  build/CI pipeline before types exist),
- `drizzle-kit generate`/`migrate` gives SQL-file migrations (readable,
  reviewable in a PR diff) without a bespoke migration runner,
- it stays a thin layer over SQL rather than an ORM runtime with its own query
  engine process (Prisma) — consistent with keeping the persistence mechanism
  swappable behind `src/checkpoints/checkpoints.repository.ts`'s interface, per
  §5's note that the ORM choice "doesn't narrow" the schema decision.

**Module layout** (`apps/backend/src/`):
- `db/schema.ts` — the `checkpoints` table exactly as specified in §5 (7
  columns, 3 indexes: `experiment_slug`, `session_id`, `created_at`).
- `db/db.service.ts` / `db.module.ts` — wraps a `postgres.js` client + Drizzle
  instance as an injectable, closed via `onModuleDestroy`. `postgres.js`
  connects lazily on first query, so the client can be constructed
  synchronously from `ConfigService.load()` (via `Effect.runSync`) without an
  async factory provider.
- `checkpoints/checkpoints.repository.ts` — the `CheckpointsRepository`
  interface + `CHECKPOINTS_REPOSITORY` DI token, so the controller/service
  never import Drizzle directly.
- `checkpoints/drizzle-checkpoints.repository.ts` — the Drizzle
  implementation, the only file that imports `db/schema.ts`.
- `checkpoints/checkpoints.service.ts` — validates the request body with
  `effect/Schema` (same pattern as `ConfigService`), including `context:
  Schema.Unknown` — the payload is the engine's `Context` snapshot, stored
  verbatim, never shape-checked here (§5).
- `checkpoints/checkpoints.controller.ts` — `POST /checkpoints`, one line:
  `return runController(this.checkpointsService.record(body))`.

**Route**: `POST /checkpoints` (no `/api` prefix — matches `GET /health`'s
existing convention on this service; `/api` is a Next.js App Router
convention this backend doesn't use).

**Request body**:
```json
{
  "experimentSlug": "ocean",
  "sessionId": "b3f1...-uuid",
  "checkpointName": "intro-complete",
  "stepId": null,
  "context": { "data": { "age": 30 }, "branches": {}, "...": "..." }
}
```
`stepId` is optional (defaults to `null` server-side). The frontend never
sends it today: `FlowHandlers.onCheckpoint` (`packages/engine/types.ts`) is
called as `(context, name)` — it doesn't carry the current node id, and
`packages/engine/flow/traverse.ts` is out of scope for this change. The
`step_id` column exists per the approved schema but is unpopulated until a
future change (in scope for `packages/engine`, not this task) threads it
through.

**Response** (`201`): `{ "id": "<uuid>", "createdAt": "<timestamptz>" }`.
Validation failures → `400` with issue messages; DB/driver failures →
`500` via `UnavailableError`.

**`sessionId`**: generated client-side with `crypto.randomUUID()` in
`apps/frontend/src/data/store.ts`'s `start()`, held in a closure for the
run's lifetime (not persisted — matches the existing "no `Zustand persist`"
limitation). This is a placeholder, not the §3-proposed signed session
token — see the auth gap below.

**Local dev**: `docker compose up -d postgres` (repo-root
`docker-compose.yml`, `postgres:16`, default credentials
`postgres`/`postgres`, db `experiment_hub`, port `5432`) then
`pnpm --filter @experiment-hub/backend db:migrate` to apply
`apps/backend/drizzle/migrations/`. `ConfigService`'s `DATABASE_URL` default
(`postgresql://postgres:postgres@localhost:5432/experiment_hub`) matches this
compose file, so no `.env` is required for local dev; production must set
`DATABASE_URL` explicitly.

**Verified manually** (not part of the CI unit suite, which has no Postgres
service wired up): ran `postgres:16` in Docker, applied the generated
migration with `drizzle-kit migrate`, booted the built service, and
confirmed `POST /checkpoints` both persists a row with the expected columns
and returns `400` for a payload missing `experimentSlug`.

**Known gap — no auth on this endpoint yet.** §3's participant session-token
guard (`@nestjs/jwt`, minted when a participant starts an experiment) is not
implemented here — it wasn't in this issue's scope (EXP-12 items 1–5), and
building it requires a "start experiment" server round-trip that doesn't
exist yet on either side. Right now `POST /checkpoints` accepts any
`experimentSlug`/`sessionId` from an unauthenticated caller. Tracked as a
follow-up issue (participant session-token guard) rather than folded into
this task, to keep this PR reviewable and scoped to persistence.
