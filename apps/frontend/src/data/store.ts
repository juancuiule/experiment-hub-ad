import {
  isEnded,
  recordEnteredAt,
  startExperiment,
  traverseWithTiming,
} from '@experiment-hub/engine/flow';
import {
  Context,
  ExperimentFlow,
  FlowHandlers,
  FlowStep,
  State,
} from '@experiment-hub/engine/types';
import { send } from './send';
import { create } from 'zustand';

type ExperimentStore = {
  step: FlowStep | null;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
  start: (
    experiment: ExperimentFlow,
    startNodeId?: string,
    locale?: string,
  ) => Promise<void>;
  next: (data?: Context['data']) => Promise<void>;
};

// Resume support: on each step transition we snapshot the traversal state
// (everything but `experiment` and `handlers`, which are not serializable /
// are re-derived on restore) to localStorage, keyed by the current page's
// pathname. start() consults this snapshot before running startExperiment(),
// so a participant who closes the tab and comes back to the same URL
// re-enters where they left off instead of restarting.
const STORAGE_PREFIX = 'experiment-hub:session:';

type PersistedSession = {
  state: State;
  context: Context;
  dataPath?: string[];
};

function storageKey(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return `${STORAGE_PREFIX}${window.location.pathname}`;
}

// Node ids referenced by a persisted state tree. Used to sanity-check a
// restored session against the experiment currently being rendered — if the
// experiment definition has since changed (a node was renamed/removed), the
// ids won't line up and we discard the stale session rather than risk
// resuming into a node that no longer exists.
function collectNodeIds(state: State): string[] {
  switch (state.type) {
    case 'in-node':
      return [state.node.id];
    case 'in-path':
      return [
        state.node.id,
        ...state.children.map((child) => child.id),
        ...collectNodeIds(state.innerState),
      ];
    case 'in-loop':
      return [
        state.node.id,
        state.template.id,
        ...collectNodeIds(state.innerState),
      ];
    default:
      return [];
  }
}

function saveSession(step: FlowStep) {
  const key = storageKey();
  if (!key) return;
  try {
    const payload: PersistedSession = {
      state: step.state,
      context: step.context,
      dataPath: step.dataPath,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Best-effort — private browsing / quota limits shouldn't break the run.
  }
}

function clearSession() {
  const key = storageKey();
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function loadSession(experiment: ExperimentFlow): PersistedSession | null {
  const key = storageKey();
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    const nodeIds = new Set(experiment.nodes.map((node) => node.id));
    if (!collectNodeIds(parsed.state).every((id) => nodeIds.has(id))) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistOrClear(step: FlowStep) {
  if (isEnded(step)) clearSession();
  else saveSession(step);
}

export const useExperimentStore = create<ExperimentStore>()((set, get) => ({
  step: null,
  isLoading: false,
  error: null,
  reset: () => set({ step: null, isLoading: false, error: null }),
  start: async (
    experiment: ExperimentFlow,
    startNodeId?: string,
    locale?: string,
  ) => {
    set({ isLoading: true, error: null });
    try {
      const handlers: FlowHandlers = {
        onCheckpoint: async (context) => {
          await send(context);
        },
      };
      const persisted = loadSession(experiment);
      const step = recordEnteredAt(
        persisted
          ? {
              state: persisted.state,
              experiment,
              context: persisted.context,
              dataPath: persisted.dataPath,
              handlers,
            }
          : await startExperiment(experiment, startNodeId, handlers, locale),
      );
      set({ step });
      persistOrClear(step);
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
      persistOrClear(nextStep);
    } catch (err) {
      console.error('Failed to advance experiment:', err);
      set({ error: 'Something went wrong while saving your answer. Please try again.' });
    } finally {
      set({ isLoading: false });
    }
  },
}));
