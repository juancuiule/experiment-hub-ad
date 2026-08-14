import { Context } from '@experiment-hub/engine/types';

const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 500;
const DEFAULT_TIMEOUT_MS = 8000;

export type SendOptions = {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postCheckpoint(context: Context, name: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('/api/checkpoints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, context }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Checkpoint POST failed with status ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

// Called by `checkpoint` nodes (via traverse()'s onCheckpoint handler, see
// store.ts) to persist a Context snapshot. Retries transient failures with a
// fixed delay; the final rejection propagates up through traverse() -> store.ts
// next()/start(), which already surfaces it as `error` state (see Screen.tsx
// and specs/store.test.ts "error state").
export async function send(context: Context, name: string, options: SendOptions = {}) {
  const {
    retries = DEFAULT_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await postCheckpoint(context, name, timeoutMs);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < retries) await wait(retryDelayMs);
    }
  }
  throw lastError;
}
