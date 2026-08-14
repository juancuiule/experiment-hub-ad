import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperimentFlow, InNodeState } from '@experiment-hub/engine/types';
import { useExperimentStore } from '@/src/data/store';

vi.mock('@/src/data/send', () => ({ send: vi.fn().mockResolvedValue(undefined) }));
import { send } from '@/src/data/send';

const flow: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    { id: 'cp', type: 'checkpoint', props: { name: 'cp1' } },
    { id: 'screen-1', type: 'screen', props: { slug: 'one' } },
    { id: 'screen-2', type: 'screen', props: { slug: 'two' } },
  ],
  edges: [
    { type: 'sequential', from: 'start', to: 'cp' },
    { type: 'sequential', from: 'cp', to: 'screen-1' },
    { type: 'sequential', from: 'screen-1', to: 'screen-2' },
  ],
};

const nodeId = (state: InNodeState | unknown) => (state as InNodeState).node.id;

// Simulates closing the tab and coming back: the in-memory store is wiped
// but localStorage (which start()/next() write to) is left untouched.
function simulateReload() {
  useExperimentStore.setState({ step: null, isLoading: false, error: null });
}

describe('experiment session resume', () => {
  beforeEach(() => {
    useExperimentStore.setState({ step: null, isLoading: false, error: null });
    vi.mocked(send).mockResolvedValue(undefined);
    window.localStorage.clear();
  });

  it('resumes at the last-reached screen with prior answers after a simulated reload', async () => {
    await useExperimentStore.getState().start(flow);
    await useExperimentStore.getState().next({ one: 'first answer' });
    expect(nodeId(useExperimentStore.getState().step?.state)).toBe('screen-2');

    simulateReload();
    expect(useExperimentStore.getState().step).toBeNull();

    await useExperimentStore.getState().start(flow);

    const { step } = useExperimentStore.getState();
    expect(nodeId(step?.state)).toBe('screen-2');
    expect(step?.context.data?.one).toEqual({ one: 'first answer' });
  });

  it('starts fresh (does not resume) once the experiment has ended', async () => {
    await useExperimentStore.getState().start(flow);
    await useExperimentStore.getState().next({ one: 'a1' });
    await useExperimentStore.getState().next({ two: 'a2' });
    expect(useExperimentStore.getState().step?.state.type).toBe('end');

    simulateReload();
    await useExperimentStore.getState().start(flow);

    // No saved progress to resume from an ended run, so it re-enters at the
    // first screen like a brand new participant.
    expect(nodeId(useExperimentStore.getState().step?.state)).toBe('screen-1');
  });

  it('discards a persisted session whose nodes no longer match the experiment', async () => {
    await useExperimentStore.getState().start(flow);
    await useExperimentStore.getState().next({ one: 'first answer' });

    const changedFlow: ExperimentFlow = {
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'cp', type: 'checkpoint', props: { name: 'cp1' } },
        { id: 'screen-1', type: 'screen', props: { slug: 'one' } },
        { id: 'screen-2-renamed', type: 'screen', props: { slug: 'two' } },
      ],
      edges: [
        { type: 'sequential', from: 'start', to: 'cp' },
        { type: 'sequential', from: 'cp', to: 'screen-1' },
        { type: 'sequential', from: 'screen-1', to: 'screen-2-renamed' },
      ],
    };

    simulateReload();
    await useExperimentStore.getState().start(changedFlow);

    expect(nodeId(useExperimentStore.getState().step?.state)).toBe('screen-1');
    expect(useExperimentStore.getState().error).toBeNull();
  });

  it('starts fresh when the persisted session is corrupted JSON', async () => {
    window.localStorage.setItem(
      `experiment-hub:session:${window.location.pathname}`,
      '{not valid json',
    );

    await useExperimentStore.getState().start(flow);

    const { step, error } = useExperimentStore.getState();
    expect(error).toBeNull();
    expect(nodeId(step?.state)).toBe('screen-1');
  });
});
