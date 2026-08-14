import {
  MutationObserver,
  useMutation,
  type MutationObserverOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { Context } from '@experiment-hub/engine/types';
import { apiFetch } from './api-client';
import { makeQueryClient } from './query-client';

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
// (store.ts runs outside the component tree, so it can't read the
// QueryProvider-scoped client via context and can't call the useMutation
// hook above). A dedicated, lazily-created client — not query-client.ts's
// per-request makeQueryClient() output, and not a module-scope `new
// QueryClient()` — sidesteps the SSR cross-request sharing that
// makeQueryClient's factory pattern exists to avoid: this one is never
// constructed until a checkpoint is actually submitted, which only happens
// from a client-side participant interaction, never during server rendering.
// MutationObserver is the same primitive useMutation is built on, so this
// gets the identical retry behavior as the hook. Callers should treat the
// returned promise as fire-and-forget: checkpoint persistence is
// intentionally off the participant-blocking critical path (see store.ts).
let imperativeQueryClient: ReturnType<typeof makeQueryClient> | undefined;

function getImperativeQueryClient() {
  if (!imperativeQueryClient) {
    imperativeQueryClient = makeQueryClient();
  }
  return imperativeQueryClient;
}

export function submitCheckpoint(submission: CheckpointSubmission): Promise<void> {
  const observer = new MutationObserver(getImperativeQueryClient(), checkpointMutationOptions);
  return observer.mutate(submission);
}

// Test-only escape hatch: lets send.test.ts configure/clear the module-private
// client submitCheckpoint uses (e.g. dropping retryDelay so retry tests don't
// wait out the real exponential backoff).
export const __getImperativeQueryClientForTests = getImperativeQueryClient;
