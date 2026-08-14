import {
  recordEnteredAt,
  startExperiment,
  traverseWithTiming,
} from '@experiment-hub/engine/flow';
import { Context, ExperimentFlow, FlowStep } from '@experiment-hub/engine/types';
import { submitCheckpoint } from './send';
import { getSessionId } from './session-id';
import { create } from 'zustand';

type ExperimentStore = {
  step: FlowStep | null;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
  start: (
    experiment: ExperimentFlow,
    experimentSlug: string,
    startNodeId?: string,
    locale?: string,
  ) => Promise<void>;
  next: (data?: Context['data']) => Promise<void>;
};

export const useExperimentStore = create<ExperimentStore>()((set, get) => ({
  step: null,
  isLoading: false,
  error: null,
  reset: () => set({ step: null, isLoading: false, error: null }),
  start: async (
    experiment: ExperimentFlow,
    experimentSlug: string,
    startNodeId?: string,
    locale?: string,
  ) => {
    set({ isLoading: true, error: null });
    try {
      // One session id per tab, not per start() call — see session-id.ts.
      const sessionId = getSessionId();
      const step = await startExperiment(
        experiment,
        startNodeId,
        {
          // Persistence is intentionally off the participant-blocking path:
          // returning immediately lets traverse() (and therefore next())
          // advance the participant regardless of the checkpoint POST's
          // outcome. submitCheckpoint's own retry (via TanStack Query) runs
          // in the background; a failure after retries is logged, not
          // surfaced to the participant, since the answer already advanced
          // and there is no in-UI retry affordance to route it to.
          onCheckpoint: (context, checkpointName) => {
            submitCheckpoint({
              experimentSlug,
              sessionId,
              checkpointName,
              context,
            }).catch((err) => {
              console.error('Checkpoint submission failed after retries:', err);
            });
            return Promise.resolve();
          },
        },
        locale,
      ).then(recordEnteredAt);
      set({ step });
    } catch (err) {
      console.error('Failed to load experiment:', err);
      set({ error: 'Something went wrong while loading the experiment.' });
    } finally {
      set({ isLoading: false });
    }
  },
  next: async (data?: Context['data']) => {
    const { step } = get();
    if (!step) return;
    set({ isLoading: true, error: null });
    try {
      const nextStep = await traverseWithTiming(step, data).then(
        recordEnteredAt,
      );
      set({ step: nextStep });
    } catch (err) {
      console.error('Failed to advance experiment:', err);
      set({ error: 'Something went wrong while saving your answer. Please try again.' });
    } finally {
      set({ isLoading: false });
    }
  },
}));
