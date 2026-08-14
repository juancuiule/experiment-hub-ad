import {
  MutationObserver,
  useMutation,
  type MutationObserverOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { Context } from '@experiment-hub/engine/types';
import { apiFetch } from './api-client';
import { queryClient } from './query-client';

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

// Shared with the imperative caller below so both paths go through the same
// retry/loading-state configuration (queryClient's mutations.retry default).
const checkpointMutationOptions: MutationObserverOptions<void, Error, CheckpointSubmission> = {
  mutationFn: sendCheckpoint,
};

// Component-level entry point: wraps sendCheckpoint in TanStack Query's
// shared retry/loading-state handling (see query-client.ts).
export function useSendCheckpointMutation(): UseMutationResult<void, Error, CheckpointSubmission> {
  return useMutation(checkpointMutationOptions);
}

// Non-component entry point for the Zustand store's onCheckpoint handler
// (store.ts runs outside the component tree, so it can't call the useMutation
// hook above). MutationObserver is the same primitive useMutation is built
// on, bound to the shared `queryClient` singleton, so this gets the identical
// retry behavior as the hook. Callers should treat the returned promise as
// fire-and-forget: checkpoint persistence is intentionally off the
// participant-blocking critical path (see store.ts).
export function submitCheckpoint(submission: CheckpointSubmission): Promise<void> {
  const observer = new MutationObserver(queryClient, checkpointMutationOptions);
  return observer.mutate(submission);
}
