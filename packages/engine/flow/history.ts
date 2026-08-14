import { FlowStep } from '../types';

// Back navigation is implemented as a snapshot stack over FlowStep, not as
// new traversal logic. traverse()/enterStep() already produce a brand-new,
// fully immutable FlowStep on every call without mutating their input, so a
// prior screen's exact state (branch/fork winners, path/loop position and
// shuffle order, stepper counts) can be restored just by keeping the FlowStep
// around — no changes to traverse.ts are needed.
//
// Known consequence of this approach (not a bug): calling goBack() never
// re-enters traverse(), so it never re-fires checkpoint sends or re-rolls
// fork/loop randomization. But if the caller then advances forward again from
// a restored step, traverse() runs as normal and can re-resolve anything not
// yet captured in that step's context — e.g. re-crossing a fork re-rolls its
// weighted random winner, and re-crossing a checkpoint re-fires onCheckpoint.
// This matches traverse()'s existing, well-tested behavior (see
// flow.checkpoint.test.ts: "calls onCheckpoint each time a checkpoint is
// traversed") and is out of scope to change here.

/** Push the step being left onto the back-navigation stack, before advancing past it. */
export function pushHistory(history: FlowStep[], step: FlowStep): FlowStep[] {
  return [...history, step];
}

export function canGoBack(history: FlowStep[]): boolean {
  return history.length > 0;
}

/** Restore the previous step from history, or null if there is nothing to go back to. */
export function goBack(
  history: FlowStep[],
): { step: FlowStep; history: FlowStep[] } | null {
  if (history.length === 0) return null;
  return {
    step: history[history.length - 1],
    history: history.slice(0, -1),
  };
}
