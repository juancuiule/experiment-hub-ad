# Experiment design/schema in Postgres — proposal, needs sign-off

Status: **revision 2, draft, awaiting sign-off** (EXP-16). This is exploratory per
the issue — no schema or engine change has been made. This doc exists to get the
options on record and force a decision before any implementation issue is scoped,
the same process `docs/backend-service.md` went through for EXP-9.

**Revision 2 changes** (per reviewer comment on rev 1, 2026-08-14): rev 1
recommended against option A (`ExperimentFlow` wholesale in Postgres) on the
assumption that the goal was narrowly "validate `POST /checkpoints` payloads." The
reviewer corrected that framing: the actual driver is that researchers, not
engineers, need to update live experiments without a redeploy, and checkpoint
validation should fall out of that as a side effect, not be the goal itself. That
changes the cost/benefit call in rev 1's §5 — this revision goes deep on option A:
how schema derivation and graph validation would reuse existing `packages/engine`
logic unchanged, whether Postgres/JSONB or MongoDB is the right store, what the
authoring/versioning workflow needs to not break live participant sessions, and a
phased path to get there. §3's option A subsection, §5, and §7 are rewritten; §8–§10
are new. §1, §2, §4, §6 (problem statement, per-run-variance analysis, existing
validation layers, and rev-1 scope notes) are unchanged and still hold.

## 1. Problem statement

`POST /checkpoints` (`apps/backend/src/checkpoints/checkpoints.service.ts`, landed
in EXP-12) validates only the envelope of a checkpoint submission —
`experimentSlug`, `sessionId`, `checkpointName`, `stepId`, and that `context` is
present. The `context` payload itself is `Schema.Unknown` and is stored verbatim.
The service has no knowledge of:

- whether `experimentSlug` is a real experiment,
- whether `checkpointName` is a checkpoint that experiment actually defines,
- what fields/types `context.data` is expected to contain at that point in the flow.

This was a deliberate scope cut in EXP-12 (see `docs/backend-service.md` §5 and §7 —
"the payload is the engine's `Context` snapshot, stored verbatim, never shape-checked
here"), not an oversight. The reviewer comment that raised this issue is asking
whether that should change, and if so, how.

Today the only place any of this is validated is client-side, in the browser, before
`send()` is even called:
- `packages/engine/experiment-validation/` (`validateExperiment()`) checks the
  *graph* — node/edge wiring, reachability, reference integrity — once, at
  `apps/frontend/app/(experiments-layout)/experiments/[slug]/page.tsx` render time.
- `packages/engine/screen-schema.ts` (`buildSchema()`) checks *per-screen form
  data* — via `Screen.tsx`'s `zodResolver` — before a participant can advance past
  a screen.

Neither runs on the backend. A malformed or malicious POST to `/checkpoints` today
succeeds unconditionally as long as the four required string fields are present.

## 2. Why this isn't a simple "mirror the schema" problem

The three questions in the issue are all versions of one underlying question: is
there a stable, static "expected shape" per `experimentSlug` + `checkpointName` that
a database row could hold? Two things about how checkpoints actually work make the
answer "not entirely":

**Checkpoint nodes don't declare which fields feed them.** `CheckpointNode`
(`packages/engine/nodes.ts`) is `{ type: 'checkpoint', props: { name: string } }` —
nothing else. It's a marker in the graph, auto-traversed
(`packages/engine/flow/traverse.ts`), that fires `onCheckpoint(context, name)` with
whatever `Context` has accumulated so far. It doesn't enumerate "the screens/fields
this checkpoint covers." That set is implicit in graph position, not declared data.

**The accumulated `Context` at a given checkpoint is not statically fixed across
runs of the same experiment.** Every experiment that uses checkpoints
(`emociones.ts`, `pandemic.ts`) places them after a run of `screen` nodes, but the
graph in between can include `branch`, `path`, `fork`, and `loop` nodes. Two
participants hitting the same `checkpointName` can have taken different branches,
different fork order, or a different number of loop iterations — meaning
`context.data` can legitimately have a different key set per participant at the
"same" checkpoint. Loop-templated fields in particular
(`packages/engine/screen-schema.ts`'s `dynamicFields`/`iterateLoops` handling) are
keyed by a resolved template string (`{{ }}` interpolation into a `dataKey`), not a
fixed name — the engine itself only knows the exact key set at runtime, per
participant, via `resolveValuesInString`.

This means "the expected schema for checkpoint X" is not a fixed Zod-shape the way
a single screen's schema is. It's closer to "the union of schemas for every screen
reachable before checkpoint X, gated by whichever conditions/loop counts applied to
this specific run" — which is exactly what `buildSchemaFromFields()` already
computes, per-screen, using the live `Context` as input. Reproducing that on the
backend either means re-running the same graph-walk logic server-side (duplicating
`packages/engine`, the drift risk the issue calls out) or invoking
`packages/engine` itself from `apps/backend` (already a workspace dependency, see
`docs/backend-service.md` §1) with the checkpoint's accumulated context as input.

## 3. Options

### A. Move `ExperimentFlow` wholesale into Postgres

Experiments become rows instead of TS object literals in
`apps/frontend/src/data/experiments/`; both the frontend (to render) and the
backend (to validate) read the graph from the same stored source.

- Pro: single source of truth, no drift between "what's stored" and "what's
  validated" by construction. Also the only option that satisfies the actual
  driver — researchers publishing experiment changes without an engineering
  redeploy — rather than just checkpoint-payload validation as a side concern.
- Con: the largest change on the table, and it touches the most sensitive code in
  the repo per `CLAUDE.md`'s sensitive-files list —
  `apps/frontend/src/data/experiments/index.ts` — plus it removes the current
  authoring workflow's free safety net (`tsc` catching a malformed `ExperimentFlow`
  literal at compile time, before it's ever reviewed or shipped). That safety net
  has to be replaced by something, not just dropped. §8 works through what that
  replacement looks like and why it's more tractable than rev 1 assumed, because
  `packages/engine` was built storage-agnostic from the start.

See §8 (schema derivation reuse), §9 (Postgres/JSONB vs. MongoDB), and §10
(authoring/versioning workflow and phased rollout) for the deep dive this revision
adds.

### B. Mirror a validation-relevant subset into a DB table alongside the TS source of truth

Keep `EXPERIMENTS` as the authoring source of truth. At build/deploy time (or via a
script run in CI), derive a smaller "expected shape per experiment + checkpoint"
artifact from the same `ExperimentFlow` graphs, using `packages/engine`'s own
graph-walk (the logic `buildSchemaFromFields` already has, not a reimplementation of
it), and write that into Postgres. The backend then validates incoming `context`
payloads against the mirrored shape for that `experimentSlug`/`checkpointName`.

- Pro: doesn't touch the authoring workflow. The one thing it needs from
  `packages/engine` (reusing its field-collection logic to generate the mirror) is
  an addition, not a duplication — call `collectFields()`/`buildSchemaFromFields()`
  or an engine-side export built for this, not hand-write equivalent server-side
  logic.
- Con: still has to answer the per-run variability problem in §2. Realistically this
  means the mirrored "shape" is closer to a permissive union (every field any run
  could produce, each optional) than a strict per-checkpoint schema — useful for
  catching gross structural errors (wrong key entirely, wrong type for a known key)
  but not for verifying "this run must have submitted exactly these keys," since
  that depends on the participant's own branch/loop history, which the backend
  would also need to reconstruct from `context.branches`/`context.loops`/etc. to
  check precisely. That reconstruction is itself close to re-running `traverse()`
  server-side — a bigger lift than "add a validation table."
- Needs a sync mechanism (regenerate-on-build vs. regenerate-on-experiment-change)
  and a place to run it — not designed here, flagged as a real open question if this
  option is chosen.

### C. No DB mirror — tighten only what doesn't require reproducing engine logic

Add a lightweight allow-list check instead of full field/type validation: the
backend already has (or could cheaply have) the list of valid `experimentSlug`
values and, per experiment, the list of valid `checkpointName`s — both are static,
small, and don't suffer the per-run variability problem in §2 (a checkpoint's
*name* is fixed even if the *fields present when it fires* aren't). This could be:
- a small static config/constant in `apps/backend` (manually kept in sync — same
  drift risk as any hand-duplicated list, but a much smaller one: two string
  fields, not a full schema), or
- generated at build time from `EXPERIMENTS` the same way option B's mirror would
  be, just with far less surface (`{ slug, checkpointNames: string[] }[]` instead of
  a schema per checkpoint).

This is a much smaller change that closes the most obvious gap (accepting
checkpoint POSTs for experiments/checkpoints that don't exist at all) without
attempting field-level shape validation, which §2 shows is the genuinely hard part.
It doesn't address the reviewer's full ask (validating the *answer* shape), only
the envelope's `experimentSlug`/`checkpointName` — worth stating plainly rather than
presenting it as equivalent to A/B.

## 4. Interaction with existing validation

**`buildSchema()` / `screen-schema.ts`**: this is the one place per-screen field
validation already lives, and it's already `Context`-aware (handles gating, loop
templating). Any option here should call into this logic (directly, by having
`apps/backend` depend on `@experiment-hub/engine` the way it already does — see
`docs/backend-service.md` §1 — and run the relevant engine functions against the
submitted `context`) rather than re-encode field types in a DB row read by hand-
written comparison logic. A DB table of "field name → type" that isn't generated
from `buildSchemaFromFields()`'s own inputs will drift the first time someone adds
a `conditional`-gated field or an `anchor`ed option to a screen definition.

**`validateExperiment()` / `experiment-validation/`**: this validates the *graph
shape* once, at experiment-load time (nodes/edges wired correctly, no unreachable
nodes, references resolve). It has nothing to do with a single participant's
*runtime* answer payload — the two operate at different layers and this proposal
doesn't touch or replace it. Whatever gets built here should be additive: a new
concern (validating one participant's checkpoint submission against the graph they
presumably traversed), not a rework of the static validator.

## 5. Recommendation (revised)

**Option A, phased.** Rev 1 weighed A against the narrow goal of checkpoint-payload
validation, where it's genuinely overkill. Against the real goal — researchers
publish experiment changes without an engineering redeploy — A is the only option
that gets there; B and C both keep `EXPERIMENTS` as TS-authored, redeploy-gated
source of truth and just add a validation side-table, which doesn't move the
authoring bottleneck at all. See §8–§10 for why A's two rev-1 objections (schema
drift risk, loss of `tsc` safety net) are more tractable than rev 1 assumed, and for
a phased path that de-risks the largest change in the repo by shipping it in
stages rather than one migration. Checkpoint-payload validation (this issue's
original trigger) falls out of Phase 1 for free, via the same mechanism that makes
authoring safe — see §8.

## 6. Explicitly out of scope for this proposal

- Any change to `packages/engine/flow/traverse.ts`'s core algorithm,
  `packages/engine/experiment-validation/`'s check logic, or
  `packages/engine/screen-schema.ts`'s schema-building logic. (§8 proposes *calling*
  these unchanged from a new context — `apps/backend` — not modifying them.)
- The actual Postgres migration/schema DDL — §9 names the shape, not the DDL.
- Researcher-facing auth/roles — `docs/backend-service.md` states plainly that
  researcher-facing auth is unimplemented. Phase 1/2 in §10 assume trusted/internal
  write access (e.g. a CLI run by an engineer or a researcher with a shared
  credential), not a public authoring surface. A real multi-researcher editor with
  per-user permissions is out of scope here and would need its own proposal once
  auth exists.
- Timing relative to other unscoped backend work (session resume) — not sequenced
  against this.

## 7. Open questions for sign-off

1. Confirm the direction: option A, phased per §10, superseding rev 1's "start with
   C, drop A" recommendation?
2. Postgres/JSONB (§9) or reopen MongoDB? Rev 1 doesn't identify a query pattern
   that needs a document store beyond what JSONB already gives, and EXP-9 rev 3
   already recorded polyglot Postgres+Mongo as deferred pending evidence of a real
   bottleneck (`docs/backend-service.md`, "Future consideration: polyglot
   persistence"). This proposal's read is that storing a *bigger* JSON blob
   (`ExperimentFlow` instead of just `context`) doesn't change that calculus — but
   flagging explicitly in case there's a specific access pattern in mind that
   motivated reopening it.
3. Phasing per §10 — Phase 1 (DB mirror + validated write API, no UI, engineer/CLI-
   driven) as the immediate scope, Phase 2 (frontend reads from DB) and Phase 3
   (versioning + researcher editor UI) as separate follow-on issues? Or does the
   "no redeploy" urgency mean Phase 3's editor UI needs to be pulled forward?
4. Do the existing TS files in `apps/frontend/src/data/experiments/` stay (as a
   seed/local-dev/fallback source, per §10 Phase 1) once the DB is authoritative, or
   should they be removed entirely once Phase 2 ships?

## 8. Schema/graph validation reuse — why A doesn't duplicate engine logic

Rev 1's strongest objection to B was duplication/drift risk from hand-mirroring
engine logic into a DB row. That objection doesn't apply to A the same way, and
this is the key technical fact that changes the calculus:

`packages/engine` has no React dependency and no dependency on *how* an
`ExperimentFlow` value is obtained — `validateExperiment()`, `buildSchema()`,
`collectFields()`, and `traverse()` all take a plain `ExperimentFlow`/`Context`
object as input (`packages/engine/types.ts`). Nothing in the engine cares whether
that object came from a static TS `import` or from `JSON.parse()` of a Postgres
JSONB column — it's the same shape either way, validated at the boundary by
`ExperimentFlow`'s own Zod/TS types, not by the fact that it happens to live in a
`.ts` file today.

Concretely, this means:
- **Graph validation** (`validateExperiment()`): today it runs once, client-side,
  at `apps/frontend/app/(experiments-layout)/experiments/[slug]/page.tsx` render
  time. Under option A it *also* runs — unchanged, same function — server-side, as
  the gate on any write to the experiments table (§10 Phase 1). This directly
  answers the issue's own question ("would this replace or sit alongside the
  existing `validateExperiment()` static graph validator?") — it sits alongside,
  reused, not replaced or reimplemented.
- **Per-screen/checkpoint schema derivation** (`buildSchema()` /
  `collectFields()`): once `apps/backend` can load a given `experimentSlug`'s
  `ExperimentFlow` from the DB (Phase 1), `POST /checkpoints` can run the same
  field-collection logic against the submitted `context` that `Screen.tsx` already
  runs client-side — this is what closes the original EXP-16 gap, and it's the same
  "derive validation the way the frontend does" outcome asked for in the reviewer
  comment, achieved by calling the existing function with a DB-sourced argument
  instead of writing new logic.
- The per-run field-set variance from `branch`/`fork`/`loop` (§2) doesn't go away
  under option A — but it stops being a "does the mirror encode this correctly"
  problem, because there is no separate mirror to keep in sync. The backend runs
  the actual engine against the actual stored graph, so it's exactly as correct as
  the client-side check is today, by construction.

`apps/backend` already depends on `@experiment-hub/engine` as a workspace package
(`docs/backend-service.md` §1), so this isn't a new dependency — it's using one
that's already there for exactly this purpose.

## 9. Storage engine: Postgres/JSONB vs. MongoDB

The user comment raised reconsidering MongoDB. Worth being precise about what's
actually being weighed, since "store a big JSON graph" sounds document-store-shaped
at first glance:

- **This was already decided once.** EXP-9 rev 3 (`docs/backend-service.md`,
  "Future consideration: polyglot persistence") recorded a Postgres+MongoDB
  polyglot layer as explicitly raised and explicitly deferred — "revisit if
  `context` JSONB queries or aggregations become a measured bottleneck," not
  adopted speculatively. `context` is a strict subset of what's being proposed here
  (a checkpoint's accumulated data vs. an experiment's entire graph) — the new
  ask is structurally the same kind of blob, just bigger.
- **JSONB already provides what a document store would give for this shape**:
  schema-less storage per experiment (no per-experiment migration when a
  researcher adds a node type or a new component), and queryable/indexable access
  into the blob when needed (Postgres `jsonb_path_ops` GIN indexes) without giving
  up transactional guarantees with the rest of the relational data (sessions,
  checkpoints, and — per §6 — eventually researcher accounts).
- **A second database is a second operational surface** — running, backing up,
  monitoring, and keeping two stores consistent — for a benefit that would only
  materialize if there's a specific Mongo-shaped access pattern (e.g. flexible ad
  hoc querying across many experiment documents by researchers directly against
  the DB) that this proposal doesn't currently have a stated need for. If that need
  exists, naming it would change this recommendation — that's §7 Q2, explicitly
  asked back to the reviewer rather than assumed either way.
- **Recommendation: Postgres/JSONB**, same instance, an `experiments` table
  alongside the existing `checkpoints` table, unless Q2 surfaces a concrete access
  pattern JSONB can't serve. This is the low-risk default per the already-recorded
  EXP-9 rationale, not a re-litigation of it — flagging that explicitly since this
  revision exists specifically because a rev 1 recommendation got overridden, and
  §9 shouldn't read as just asserting the old answer without engaging the new ask.

## 10. Authoring, versioning, and a phased rollout

This is the part of option A that rev 1 correctly flagged as the hard, undesigned
piece — moving `ExperimentFlow` to the DB is a schema/storage question (§9,
actually simple); replacing the *authoring workflow* safely is a product/workflow
question (this section), and is where most of the real risk and design work in this
proposal lives. Two problems, neither solved by "add a table":

**Problem 1 — losing `tsc`'s free correctness check.** Today, a malformed
`ExperimentFlow` literal fails the build before it's ever reviewed. A DB row has no
such gate by default. §8 already provides the replacement: any write path
(`PUT`/`POST /experiments/:slug`) must run the submitted `ExperimentFlow` through
`validateExperiment()` server-side and reject the write if it fails — a mechanical
requirement, not a new design.

**Problem 2 — live participant sessions mid-experiment.** If a researcher edits and
publishes a running experiment, a participant partway through the *old* graph
must not suddenly be traversed against the *new* one — `traverse()`'s state
(current node, accumulated `Context`) is only meaningful relative to the exact
graph it was computed against. This needs an explicit **draft vs. published,
versioned** model — e.g. each write creates a new version row, `checkpoints`
gains an `experimentVersion` (or similar) column recorded at session start and
carried through, and `traverse()` for a given session always resolves against the
version it started with, not "whatever's current." This is a real design question
this proposal is *not* answering — it's naming it as the thing that needs to be
scoped, and flagging it as more of a product/UX call (how strict should
"in-flight sessions keep the old version" be — forever, or until some cutoff?) than
a pure engineering one.

**Proposed phasing**, to avoid doing the whole migration — engine reuse (§8),
storage (§9), and the two problems above — as one large, high-risk change:

- **Phase 1 — DB mirror + validated write path, no UI, no frontend change.** Add
  the `experiments` table (§9), a backend write endpoint gated by
  `validateExperiment()` (Problem 1, above), and a read endpoint. Publish by
  calling the endpoint (a script, or an engineer/researcher using a shared
  credential — see §6's auth caveat) rather than editing a TS file + PR + deploy.
  `apps/frontend/src/data/experiments/` TS files can stay as-is during this phase
  (nothing reads from the DB yet) — this phase is purely additive and lands
  `POST /checkpoints` validation (§8) as a side effect, with zero frontend risk.
- **Phase 2 — frontend reads from the DB instead of the static `EXPERIMENTS`
  import.** `apps/frontend/app/(experiments-layout)/experiments/[slug]/page.tsx`
  fetches the experiment instead of importing it — natural fit for the TanStack
  Query client layer just adopted (`3ddebba`, EXP-15). This is the step that
  actually delivers "no redeploy to change an experiment." Decide here whether the
  TS files are deleted (DB fully authoritative) or kept as a local-dev/offline
  fallback (§7 Q4).
- **Phase 3 — versioning (Problem 2) and a researcher-facing editor.** The
  larger, genuinely under-designed piece. Versioning can't ship without deciding
  the product question above; an editor UI needs researcher auth (§6, currently
  unimplemented) before it can be exposed beyond trusted/internal use, and is a
  substantial frontend/design effort in its own right (graph editing, not a form).
  This is the piece where bringing in outside design/data-architecture help (as
  the reviewer offered) would actually pay for itself — not for §9's storage
  choice, which this proposal treats as settled by the existing EXP-9 record, but
  for versioning semantics and editor UX, which are genuinely new problems this
  codebase hasn't solved yet.

None of this is proposed as final — flagging it as the shape of the decision that
needs a sign-off round, per the issue's "do not start implementation" instruction.
§7 asks the specific questions needed to scope Phase 1 as a concrete child issue.
