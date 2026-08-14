# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

An adaptive experiment runner for behavioral research. Researchers define branching, looping, and randomized participant flows as typed TypeScript object literals; the engine renders them as structured multi-screen web studies.

## Stack

- Next.js 16.1.6 (App Router), React 19, TypeScript 5 (strict)
- Tailwind CSS 4, Radix UI primitives
- Zustand 5 (experiment state), react-hook-form + Zod (per-screen validation)
- Vitest 4 + happy-dom (unit tests), Playwright (e2e)
- pnpm 9 is the canonical package manager (CI uses it)

## Essential commands

```bash
pnpm dev           # start dev server (runs from repo root)
pnpm build         # Next.js production build
pnpm lint          # eslint (eslint.config.mjs)
pnpm test          # vitest run — all unit tests (engine + frontend)
pnpm test:watch    # vitest — watch mode
pnpm test:e2e      # playwright test — e2e suite
pnpm typecheck     # tsc --noEmit across all workspace packages (pnpm -r typecheck)
```

Run a single test file:
```bash
pnpm --filter @experiment-hub/engine exec vitest run specs/conditions.test.ts
pnpm --filter @experiment-hub/frontend exec vitest run src/specs/store.test.ts
```

Vitest accepts a file path or pattern as a positional argument. Test files live under `packages/engine/specs/` (engine) and `apps/frontend/src/specs/` (React components). E2E tests live under `apps/frontend/e2e/`.

## Architecture

This is a pnpm workspace. `packages/engine` and `apps/frontend` must stay decoupled
(no React in the engine). `apps/backend` is a NestJS service persisting checkpoint
data to Postgres — see `docs/backend-service.md` for its scope, conventions, and
open questions (researcher-facing auth is still unimplemented).

```
packages/engine/             # Pure TypeScript engine — zero React imports
                             # Published in-workspace as @experiment-hub/engine
  flow/                      # State machine (directory)
    traverse.ts              # traverse(), enterStep(), traverseInPath/Loop()
    graph.ts                 # Graph helpers
    context.ts               # Context construction
    formulas.ts              # Formula evaluation
    timing.ts                # Timing utilities
    shuffles.ts              # Shuffle helpers
    visibility.ts            # Visibility evaluation
    index.ts                 # Re-exports
  experiment-validation/     # Static graph validator (directory)
    index.ts                 # validateExperiment() — exports ValidationError[]
    check-*.ts               # 10 individual check modules
    validate-condition-structure.ts
  types.ts                   # ExperimentFlow, FlowStep, State, Context — all core types
  nodes.ts                   # Node type interfaces (start, checkpoint, screen, branch,
                             #   path, fork, loop, compute, data)
  edges.ts                   # Edge type definitions (sequential, branch-*, path-contains,
                             #   loop-template, fork-edge)
  conditions.ts              # Condition evaluation
  resolve.ts                 # Data key resolution and {{ }} string interpolation
  screen-schema.ts           # buildSchema() — Zod schema builder for per-screen form validation
  screen-bindings.ts         # Screen binding helpers
  field-schema.ts            # Field schema extraction from screen component definitions
  fields.ts                  # collectFields() — flat field descriptor list from screen components
  component-walker.ts        # flatMap() — tree-shaped traversal over screen components
  tokens.ts                  # Token definitions
  i18n.ts                    # i18n helpers
  utils.ts                   # Shared utilities incl. shuffleAnchored()
  screen.ts                  # Screen-level utilities
  components/                # Component type definitions (content, response, layout, control)
  specs/                     # Unit tests for the engine

apps/frontend/               # Next.js React application
                             # Published in-workspace as @experiment-hub/frontend
  app/
    (experiments-layout)/
      experiments/[slug]/
        page.tsx             # Validates experiment, selects start node, mounts Experiment
    page.tsx / layout.tsx
  src/
    Experiment.tsx           # Runner: reads store, dispatches start()/next(), renders Screen
    Screen.tsx               # Per-screen form: react-hook-form + zodResolver(buildSchema(...))
    data/
      experiments/           # EXPERIMENTS record — one file per experiment
        index.ts             # Exports the EXPERIMENTS record keyed by slug
        ocean.ts, emociones.ts, pandemic.ts, …
      store.ts               # Zustand store with start(experiment, startNodeId?, locale?) and next(data?)
      send.ts                # send() stub — checkpoint nodes call this to persist data
    components/
      RenderComponent.tsx    # Dispatcher: routes by componentFamily + template to concrete components
      content/               # RichText, Image, Video, Audio
      response/              # 12 response input components (slider, radio, checkboxes, etc.)
      layout/                # Button, Group
      control/               # Conditional, ForEach
    specs/                   # Unit tests for React components
  e2e/                       # Playwright tests

apps/backend/                 # NestJS service — see docs/backend-service.md
                               # Published in-workspace as @experiment-hub/backend
                               # Uses Effect (effect-ts) for service-layer error handling
  drizzle/migrations/          # SQL migrations generated by drizzle-kit
  src/
    main.ts                   # Bootstrap
    app.module.ts
    config/                   # ConfigModule/ConfigService — env validation via effect/Schema
    logging/                  # LoggingModule — nestjs-pino structured logging
    common/effect/            # errors.ts (tagged DomainError union), run.ts (runController adapter)
    health/                   # Demo module: GET /health, shows the Effect-service convention
    db/                       # schema.ts (Drizzle checkpoints table), DbService/DbModule (pg client)
    checkpoints/               # POST /checkpoints — repository interface + Drizzle implementation

docs/                        # Reference documentation (see below)
agents.sh                    # Fan-out script (see Agent workflow below) (untracked)
```

The flow engine (`packages/engine/`) has no React dependency and is fully unit-tested. The React layer drives it by calling `startExperiment()` once and `traverse(step, formData)` on each screen submission.

## How experiments are defined

All experiments live in `apps/frontend/src/data/experiments/` as entries in the `EXPERIMENTS` record. The `index.ts` file exports the record; each experiment is defined in its own file:

```ts
// apps/frontend/src/data/experiments/index.ts
export const EXPERIMENTS: Record<string, ExperimentFlow> = {
  "my-study": { nodes: [...], edges: [...], screens: [...], options: {...} }
};
```

The route `apps/frontend/app/(experiments-layout)/experiments/[slug]/page.tsx` looks up `EXPERIMENTS[slug]`, calls `validateExperiment()`, and renders `<ValidationErrors>` if any errors are returned — so misconfigured graphs are caught before the participant sees anything.

Start node selection is driven by query-string params: `?condition=A` matches a `StartNode` whose `props.param` equals `{ key: "condition", value: "A" }`. This enables within-experiment condition assignment without separate URLs.

## Non-obvious conventions

**`shouldUnregister: true`** in `apps/frontend/src/Screen.tsx`'s `useForm` call is intentional: unmounted components (those hidden by `conditional`) do not retain their values in the submitted form data.

**`Zustand persist` is not enabled** in `apps/frontend/src/data/store.ts`. Browser refresh resets the experiment. This is a known limitation, not a bug to fix casually — re-enabling it requires implementing session resume logic.

**`send()` in `apps/frontend/src/data/send.ts` is a stub.** `checkpoint` nodes call `send(context)` to persist data — currently a 100ms `setTimeout`. Replace with a real API POST before running participant-facing studies.

**Debug panels are gated behind `process.env.NODE_ENV === 'development'`** (build-time in Next.js production builds). Keep that gate intact when touching `apps/frontend/app/(experiments-layout)/experiments/[slug]/page.tsx` or `apps/frontend/src/Screen.tsx`.

**Option anchoring** — response options accept `anchor: "first" | "last"` to pin specific choices to the ends of a shuffled list. Handled by `shuffleAnchored()` in `packages/engine/utils.ts`.

**pnpm is the canonical package manager.** Always use `pnpm`; the CI pipeline uses pnpm 9 exclusively.

## Anti-patterns

**Do not import React anywhere inside `packages/engine/`.** The engine is deliberately framework-agnostic. Tests in `packages/engine/specs/` run without a DOM renderer. Any React import in that layer breaks the isolation.

**Do not use `$fieldName` references outside `RenderComponent`.** `apps/frontend/src/components/RenderComponent.tsx` merges `form.watch()` into context before resolving props. The engine's `resolve.ts` and condition evaluator never have access to live form state — `$` references in branch conditions or loop `dataKey` fields silently resolve to nothing.

**Do not enable `Zustand persist` without implementing session resume.** Restoring persisted state mid-experiment requires knowing which step to re-enter and which context to restore. It's not a one-line change.

**Do not remove or bypass the `process.env.NODE_ENV === 'development'` guard** on debug panels. In production Next.js builds this dead-code-eliminates the panels; removing the guard exposes raw JSON context to participants.

## Agent workflow

**One git worktree per issue, always — never share a single checkout across concurrent issues.** This is a hard rule, not a suggestion: an agent working EXP-5 in the shared checkout once found *uncommitted* work from EXP-2/3/4 sitting in the working tree and nearly clobbered it. Even a single agent working one issue at a time in the primary checkout should give any second, parallel issue its own worktree (`git worktree add ../<repo>-<issue> -b feature/<name>`) rather than reusing the primary directory. `agents.sh` (below) automates this for fan-out; use the same pattern by hand if you're spinning up work manually.

When picking up an issue:

1. Create a dedicated git worktree for the issue (see rule above) and branch from `main` as `feature/<name>` or `fix/<name>` inside it.
2. Implement. Keep changes scoped to the issue.
3. Run `pnpm lint && pnpm test` before committing. Both must pass.
4. Use conventional commit prefixes: `feat:`, `fix:`, `test:`, `refactor:`.
5. Open a PR against `main` with `gh pr create`, referencing the issue number.
6. Run the `explain-diff` skill against the PR diff and attach the resulting HTML walkthrough (background, intuition, code walkthrough, comprehension quiz) as a work product on the issue before requesting review. Mandatory for changes touching `packages/engine/`, `apps/backend/`, or any file listed under **Sensitive files** below; reviewer discretion for small, self-contained frontend-only tweaks.
7. CI runs `pnpm test` and `pnpm test:e2e` automatically — both must pass before merge.
8. Remove the worktree once the PR merges (`git worktree remove`).

**`agents.sh`** at the repo root (untracked; present only in the maintainer's local checkout) is a fan-out script that launches one Claude Code agent per GitHub issue in a tmux grid, each in its own git worktree, for parallel multi-issue development.

**Workspace filter commands**: use `pnpm --filter @experiment-hub/engine <script>` or `pnpm --filter @experiment-hub/frontend <script>` to run scripts in a single package without affecting the other.

## Commit and branch conventions

From git history:
- Feature branches: `feature/<name>` (e.g. `feature/compute-node`, `feature/shared-options`)
- Bug fix branches: `fix/<name>` (e.g. `fix/in-path-stepper`)
- Commit messages use `feat:`, `fix:`, `test:`, `refactor:` prefixes for new work; plain imperatives for small changes
- All PRs target `main`
- CI runs `pnpm test` and `pnpm test:e2e` on every PR before merge

## Environment variables

`apps/frontend` (participant-facing app) reads no environment variables at runtime beyond `NEXT_PUBLIC_BACKEND_URL` (backend origin for checkpoint POSTs, defaults to `http://localhost:3001`; see `apps/frontend/src/data/send.ts`) and the debug-panel `NODE_ENV` guards. The E2E CI job sets `NODE_ENV=test`. There is no `.env.example`.

`apps/backend` reads `PORT`, `NODE_ENV`, and `DATABASE_URL` via `apps/backend/src/config/config.service.ts` (see `docs/backend-service.md`); all three have local-dev defaults, so no `.env` is required to run `pnpm dev:backend` against the repo-root `docker-compose.yml` Postgres.

## Sensitive files

Changing these incorrectly breaks participant-facing behavior:

- `apps/frontend/src/data/experiments/index.ts` — the `EXPERIMENTS` dict; removing or renaming a key breaks its route
- `packages/engine/flow/traverse.ts` — the traversal state machine; affects path step counting and all data nesting
- `packages/engine/experiment-validation/` — any regression here silently allows malformed experiments through
- `packages/engine/screen-schema.ts` — `buildSchema()` failing silently disables all per-screen form validation

## Documentation

The `docs/` folder contains precise reference documentation — use it before reading source code for domain questions:

| File | Contents |
|---|---|
| `docs/experiment.md` | `ExperimentFlow` top-level structure |
| `docs/nodes.md` | Node type reference (currently covers 7 of the 9 node types; compute and data are not yet documented) |
| `docs/edges.md` | All edge types and node-to-edge validation rules |
| `docs/components.md` | All component types and their props (content, response, layout, control) |
| `docs/data-keys.md` | The 5 reference prefixes: `$$`, `@`, `$`, `#`, `%` |
| `docs/answer-piping.md` | String interpolation in labels and content (`{{ }}` syntax) |
| `docs/i18n.md` | Localized message dictionary and the `[[ ]]` token |
| `docs/validate.md` | All validation error codes with explanations |
| `docs/backend-service.md` | `apps/backend/` scope, boundaries, auth/logging/DB proposal, NestJS+Effect conventions |

## Where to look first

| Question | Start here |
|---|---|
| How the state machine works | `packages/engine/flow/traverse.ts` — `traverse()`, `enterStep()`, `traverseInNode/Path/Loop()` |
| All core type definitions | `packages/engine/types.ts` — `ExperimentFlow`, `State`, `Context`, `FlowStep` |
| What node types exist | `packages/engine/nodes.ts` |
| What validation checks run | `packages/engine/experiment-validation/index.ts` — `validateExperiment()` |
| How a screen form is wired | `apps/frontend/src/Screen.tsx` — `useForm` + `buildSchema` + `buildDefaultValues` |
| How a component gets rendered | `apps/frontend/src/components/RenderComponent.tsx` — switch on `componentFamily` + `template` |
| Where experiments are registered | `apps/frontend/src/data/experiments/index.ts` — `EXPERIMENTS` |
| How a URL maps to an experiment | `apps/frontend/app/(experiments-layout)/experiments/[slug]/page.tsx` |
| Engine behavior examples | `packages/engine/specs/flow/` — traversal tests covering branch, path, loop, fork |
