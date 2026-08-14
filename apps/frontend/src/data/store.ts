import {
  goBack,
  pushHistory,
  recordEnteredAt,
  startExperiment,
  traverseWithTiming,
} from '@experiment-hub/engine/flow';
import { Context, ExperimentFlow, FlowStep } from '@experiment-hub/engine/types';
import { send } from './send';
import { create } from 'zustand';

type ExperimentStore = {
  step: FlowStep | null;
  // Snapshot stack of steps left behind by next(). back() pops from this and
  // never calls traverse() itself — see packages/engine/flow/history.ts for
  // why that keeps it side-effect-free (no re-fired checkpoint sends, no
  // re-rolled fork/loop randomization) on the pop itself.
  history: FlowStep[];
  isLoading: boolean;
  error: string | null;
  reset: () => void;
  start: (
    experiment: ExperimentFlow,
    startNodeId?: string,
    locale?: string,
  ) => Promise<void>;
  next: (data?: Context['data']) => Promise<void>;
  back: () => void;
};

export const useExperimentStore = create<ExperimentStore>()((set, get) => ({
  step: null,
  history: [],
  isLoading: false,
  error: null,
  reset: () => set({ step: null, history: [], isLoading: false, error: null }),
  start: async (
    experiment: ExperimentFlow,
    startNodeId?: string,
    locale?: string,
  ) => {
    set({ isLoading: true, error: null, history: [] });
    try {
      const step = await startExperiment(
        experiment,
        startNodeId,
        {
          onCheckpoint: async (context) => {
            await send(context);
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
    const { step, history } = get();
    if (!step) return;
    set({ isLoading: true, error: null });
    try {
      const nextStep = await traverseWithTiming(step, data).then(
        recordEnteredAt,
      );
      set({ step: nextStep, history: pushHistory(history, step) });
    } catch (err) {
      console.error('Failed to advance experiment:', err);
      set({ error: 'Something went wrong while saving your answer. Please try again.' });
    } finally {
      set({ isLoading: false });
    }
  },
  back: () => {
    const { history } = get();
    const restored = goBack(history);
    if (!restored) return;
    set({ step: restored.step, history: restored.history, error: null });
  },
}));
