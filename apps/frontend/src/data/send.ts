import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { Context } from '@experiment-hub/engine/types';
import { apiFetch } from './api-client';

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
export async function sendCheckpoint(submission: CheckpointSubmission): Promise<void> {
  await apiFetch('/checkpoints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submission),
  });
}

// Alias kept for callers outside React (the Zustand store's onCheckpoint
// handler in store.ts runs outside the component tree, so it can't use the
// useMutation hook below).
export const send = sendCheckpoint;

// Component-level entry point: wraps sendCheckpoint in TanStack Query's
// shared retry/loading-state handling (see query-client.ts). Future
// checkpoint-triggering UI should prefer this over calling send() directly.
export function useSendCheckpointMutation(): UseMutationResult<void, Error, CheckpointSubmission> {
  return useMutation({ mutationFn: sendCheckpoint });
}
