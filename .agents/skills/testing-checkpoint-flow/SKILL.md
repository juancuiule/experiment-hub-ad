---
name: testing-checkpoint-flow
description: How to run the experiment-hub stack locally (Postgres + NestJS backend + Next frontend) and drive an experiment through a checkpoint in the browser to test POST /checkpoints, CORS, body limits and payload validation.
---

# Testing the checkpoint flow end-to-end

## Bring the stack up

```bash
export PATH=$HOME/.local/node_modules/.bin:$PATH   # pnpm may not be on PATH
docker compose up -d postgres                       # repo root
pnpm --filter @experiment-hub/backend db:migrate    # creates the `checkpoints` table
pnpm dev:backend                                    # NestJS on :3001 (background it)
pnpm dev                                            # Next.js on :3000 (background it)
curl -s http://localhost:3001/health                # {"status":"ok",...} when ready (~15s)
```

No secrets or logins are required; there is no auth on the app or on `POST /checkpoints`.

Note: on older Node (e.g. 20.x, which predates `require(esm)`) `pnpm test` fails to load the
CJS `vitest.config.ts`. This is pre-existing on `main`. Workaround if unit tests are needed:
copy the config to `.mts` (replace `__dirname` with `import.meta.dirname`) and pass `--config`.

## Fastest UI path to a checkpoint POST

Experiment slug `experiment` (`apps/frontend/src/data/experiments/pandemic.ts`) reaches a
checkpoint after only two screens:

1. `http://localhost:3000/experiments/experiment`
2. Tick "Estoy de acuerdo y acepto participar de este estudio" (this enables the "Empezar"
   button — it is `disabled` until consent is true), click **Empezar**.
3. Screen "Para empezar": every response is required, including the **sliders** — a slider has
   no default value, so you must click on its track line (a few px above the min/max labels,
   not on the label row) or the form shows "This field is required". Then pick one option in
   each radio group and click **Continuar**.
4. That traverses node `checkpoint-first-questions` → `store.ts` `onCheckpoint` → `send.ts` →
   `api-client.ts` → `POST http://localhost:3001/checkpoints` (expect **201**).

Verify persistence:

```bash
docker exec experiment-hub-ad-postgres-1 psql -U postgres -d experiment_hub \
  -c "select experiment_slug, checkpoint_name, session_id, created_at from checkpoints order by created_at;"
```
`experiment_slug` = the URL slug, `checkpoint_name` = the checkpoint node's `props.name`,
`session_id` = a uuid generated per run, `step_id` is intentionally NULL (see `send.ts`).

## Testing CORS from the UI (better than curl)

The backend allowlist comes from `CORS_ORIGINS` (`apps/backend/src/config/config.service.ts`,
comma-separated; defaults to `http://localhost:3000` outside production, empty in production).
To *prove* the allowlist is enforced in a browser, restart the backend with a different
allowlist and re-run the flow:

```bash
CORS_ORIGINS=https://allowed.example.com pnpm dev:backend
```
The checkpoint submit then shows `blocked by CORS policy: No 'Access-Control-Allow-Origin'
header` in the console and the runner renders "Something went wrong while saving your answer."

Do **not** try serving the frontend from `http://127.0.0.1:3000` as the "other origin": the
Next dev server renders an empty experiment page on that host (dev cross-origin/HMR quirk), so
the flow can't be driven there. Changing `CORS_ORIGINS` is the reliable approach.

Remember CORS is browser-enforced only: a `curl` POST with `Origin: http://evil.example` still
gets **201** and still writes a row — the correct assertion is that the response carries **no**
`Access-Control-Allow-Origin` for that origin (always run the allowlisted origin as a control,
which must return the header).

## Backend guard-rail checks (shell)

```bash
# body limit (main.ts useBodyParser json 100kb) -> 413, nothing persisted
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3001/checkpoints \
  -H 'Content-Type: application/json' --data-binary @150kb.json
# identifier caps (checkpoints.service.ts, 200 chars) -> 400; 200 chars -> 201
```

## Production config checks

```bash
pnpm --filter @experiment-hub/backend build
cd apps/backend
env -u DATABASE_URL NODE_ENV=production PORT=3002 node dist/main.js   # must exit 1: ValidationError
NODE_ENV=production DATABASE_URL=... PORT=3002 node dist/main.js       # boots, empty CORS allowlist
```

## Devin Secrets Needed

None.
