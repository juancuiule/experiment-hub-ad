# Experiment design/schema in Postgres — proposal, needs sign-off

Status: **draft, awaiting sign-off** (EXP-16). This is exploratory per the issue —
no schema or engine change has been made. This doc exists to get the options on
record and force a decision before any implementation issue is scoped, the same
process `docs/backend-service.md` went through for EXP-9.

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
`apps/frontend/src/data/experiments/`; the backend reads the graph directly to
validate.

- Pro: single source of truth, no drift between "what's stored" and "what's
  validated" by construction.
- Con: This is the largest possible change on the table and touches the most
  sensitive code in the repo per `CLAUDE.md`'s sensitive-files list —
  `apps/frontend/src/data/experiments/index.ts` and (indirectly, since the shape
  read by the engine would now come over the wire instead of being statically
  typed) `packages/engine/types.ts`. It also removes the current authoring
  workflow (typed TS literals, checked by `tsc`, reviewed in a normal PR diff) in
  favor of a DB-editing workflow with no analogous tooling yet (no admin UI, no
  migration-per-experiment story). Not proportionate to the problem — the reviewer
  comment asks for *checkpoint validation*, not an authoring-storage migration.

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

## 5. Recommendation

Start with **option C** (allow-list on `experimentSlug`/`checkpointName`) as a small,
low-risk first increment — it closes the most obviously-wrong case (POSTs for
experiments/checkpoints that don't exist) without requiring a decision on the harder
problem in §2. Treat **option B** (mirrored per-checkpoint shape) as a real
follow-on worth pursuing, but only once it's scoped with an explicit answer to "how
strict is validation allowed to be given legitimate per-run field-set variance from
branches/loops/forks" — that's a product/research-methodology question (does a
malformed-but-plausible payload need to be rejected, or just anomaly-flagged for
review?) as much as an engineering one, and it determines whether B needs the
"permissive union" shape described above or something closer to replaying
`traverse()` server-side. **Option A is not recommended** — disproportionate to the
problem, and it converts the researcher-authoring workflow's static-typing
guarantees into a runtime/DB-editing story with no compensating tooling built yet.

None of this is proposed as the final word — flagging it as the shape of the
decision that needs a sign-off round, per the issue's "do not start
implementation" instruction.

## 6. Explicitly out of scope for this proposal

- Any change to `packages/engine/flow/traverse.ts`, `packages/engine/experiment-validation/`, or `packages/engine/screen-schema.ts`.
- Any Postgres schema/migration (this doc doesn't even commit to *whether* a new
  table is needed — that depends on which option is chosen).
- Timing relative to other unscoped backend work (participant session-token auth,
  session resume) — this doc doesn't sequence against those.

## 7. Open questions for sign-off

1. Which option (A/B/C) — or start with C and revisit B later, as recommended in §5?
2. If B: how strict should validation be, given legitimate per-run field-set
   variance (§2)? This determines whether it's a permissive-union check or a
   full `traverse()`-replay check.
3. If B or C's generated variant: what triggers regeneration of the mirrored
   data — a build step, a CI job, an admin action? Not designed here.
4. Should this be scoped as one issue or split further (e.g., C first as a fast
   follow, B as a separate, larger proposal once §7.2 has an answer)?
