import { Context } from '@experiment-hub/engine/types';

// Backend origin for the NestJS service added in apps/backend (see
// docs/backend-service.md). Client-side code (this file runs in the
// browser via the store's onCheckpoint handler), so the var must be
// NEXT_PUBLIC_-prefixed to be inlined at build time.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
const REQUEST_TIMEOUT_MS = 5000;

export type CheckpointSubmission = {
  experimentSlug: string;
  sessionId: string;
  checkpointName: string;
  context: Context;
};

// Persists a checkpoint by POSTing to the backend's /checkpoints endpoint.
// `stepId` isn't included: the engine's onCheckpoint handler (traverse.ts)
// only passes (context, name), not the current node id, and packages/engine
// traversal logic is out of scope for this change.
export async function send({
  experimentSlug,
  sessionId,
  checkpointName,
  context,
}: CheckpointSubmission): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BACKEND_URL}/checkpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experimentSlug, sessionId, checkpointName, context }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Checkpoint persistence failed with status ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
