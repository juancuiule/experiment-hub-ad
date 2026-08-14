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

describe('useExperimentStore', () => {
  beforeEach(() => {
    useExperimentStore.setState({ step: null, history: [], isLoading: false, error: null });
    vi.mocked(send).mockResolvedValue(undefined);
  });

  it('starts on a null step that is not loading', () => {
    const { step, isLoading } = useExperimentStore.getState();
    expect(step).toBeNull();
    expect(isLoading).toBe(false);
  });

  it('start() auto-advances past start/checkpoint onto the first screen', async () => {
    await useExperimentStore.getState().start(flow);
    const { step, isLoading } = useExperimentStore.getState();
    expect(step?.state.type).toBe('in-node');
    expect(nodeId(step?.state)).toBe('screen-1');
    expect(isLoading).toBe(false);
  });

  it('start() records an enteredAt timing for the entered screen', async () => {
    await useExperimentStore.getState().start(flow);
    const { step } = useExperimentStore.getState();
    const timings = step?.context.timings ?? {};
    const entries = Object.values(timings);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]).toMatchObject({ enteredAt: expect.any(String) });
  });

  it('start() honors an explicit startNodeId', async () => {
    await useExperimentStore.getState().start(flow, 'start');
    expect(nodeId(useExperimentStore.getState().step?.state)).toBe('screen-1');
  });

  it('next() advances to the following screen', async () => {
    await useExperimentStore.getState().start(flow);
    await useExperimentStore.getState().next({ one: 'answer' });
    const { step, isLoading } = useExperimentStore.getState();
    expect(nodeId(step?.state)).toBe('screen-2');
    expect(isLoading).toBe(false);
  });

  it('next() is a no-op when there is no current step', async () => {
    await useExperimentStore.getState().next({ anything: 1 });
    const { step } = useExperimentStore.getState();
    expect(step).toBeNull();
  });

  it('resets isLoading to false even after start completes', async () => {
    const promise = useExperimentStore.getState().start(flow);
    expect(useExperimentStore.getState().isLoading).toBe(true);
    await promise;
    expect(useExperimentStore.getState().isLoading).toBe(false);
  });

  it('reset() clears step, isLoading, and error after a start()', async () => {
    await useExperimentStore.getState().start(flow);
    expect(useExperimentStore.getState().step).not.toBeNull();

    useExperimentStore.getState().reset();

    const { step, isLoading, error } = useExperimentStore.getState();
    expect(step).toBeNull();
    expect(isLoading).toBe(false);
    expect(error).toBeNull();
  });
});

describe('back()', () => {
  beforeEach(() => {
    useExperimentStore.setState({ step: null, history: [], isLoading: false, error: null });
    vi.mocked(send).mockResolvedValue(undefined);
  });

  it('is a no-op with empty history', async () => {
    await useExperimentStore.getState().start(flow);
    const before = useExperimentStore.getState().step;
    useExperimentStore.getState().back();
    expect(useExperimentStore.getState().step).toBe(before);
  });

  it('restores the previous screen after next()', async () => {
    await useExperimentStore.getState().start(flow);
    await useExperimentStore.getState().next({ one: 'answer' });
    expect(nodeId(useExperimentStore.getState().step?.state)).toBe('screen-2');

    useExperimentStore.getState().back();
    expect(nodeId(useExperimentStore.getState().step?.state)).toBe('screen-1');
  });

  it('does not call send() (no checkpoint re-fire on the pop itself)', async () => {
    await useExperimentStore.getState().start(flow);
    await useExperimentStore.getState().next({ one: 'answer' });
    vi.mocked(send).mockClear();

    useExperimentStore.getState().back();
    expect(send).not.toHaveBeenCalled();
  });

  it('clears a previous error', async () => {
    await useExperimentStore.getState().start(flow);
    await useExperimentStore.getState().next({ one: 'answer' });
    useExperimentStore.setState({ error: 'previous error' });

    useExperimentStore.getState().back();
    expect(useExperimentStore.getState().error).toBeNull();
  });

  it('can be followed by next() again, re-submitting from the restored screen', async () => {
    await useExperimentStore.getState().start(flow);
    await useExperimentStore.getState().next({ one: 'first answer' });
    useExperimentStore.getState().back();
    await useExperimentStore.getState().next({ one: 'revised answer' });

    const { step } = useExperimentStore.getState();
    expect(nodeId(step?.state)).toBe('screen-2');
    expect(step?.context.data?.one).toEqual({ one: 'revised answer' });
  });
});

const flowWithCheckpointAfterFirst: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    { id: 'screen-1', type: 'screen', props: { slug: 'one' } },
    { id: 'cp-mid', type: 'checkpoint', props: { name: 'mid' } },
    { id: 'screen-2', type: 'screen', props: { slug: 'two' } },
  ],
  edges: [
    { type: 'sequential', from: 'start', to: 'screen-1' },
    { type: 'sequential', from: 'screen-1', to: 'cp-mid' },
    { type: 'sequential', from: 'cp-mid', to: 'screen-2' },
  ],
};

describe('error state', () => {
  beforeEach(() => {
    useExperimentStore.setState({ step: null, history: [], isLoading: false, error: null });
    vi.mocked(send).mockResolvedValue(undefined);
  });

  it('next() failure sets error and resets isLoading to false', async () => {
    await useExperimentStore.getState().start(flowWithCheckpointAfterFirst);
    vi.mocked(send).mockRejectedValueOnce(new Error('network error'));
    await useExperimentStore.getState().next({ one: 'answer' });
    const { error, isLoading } = useExperimentStore.getState();
    expect(error).toBe('Something went wrong while saving your answer. Please try again.');
    expect(isLoading).toBe(false);
  });

  it('a subsequent successful next() clears the error', async () => {
    await useExperimentStore.getState().start(flow);
    useExperimentStore.setState({ error: 'previous error' });
    await useExperimentStore.getState().next({ one: 'answer' });
    expect(useExperimentStore.getState().error).toBeNull();
  });
});
