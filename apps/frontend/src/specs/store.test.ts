import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperimentFlow, InNodeState } from '@experiment-hub/engine/types';
import { useExperimentStore } from '@/src/data/store';

vi.mock('@/src/data/send', () => ({ submitCheckpoint: vi.fn().mockResolvedValue(undefined) }));
import { submitCheckpoint } from '@/src/data/send';

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
    useExperimentStore.setState({ step: null, isLoading: false, error: null });
    vi.mocked(submitCheckpoint).mockResolvedValue(undefined);
  });

  it('starts on a null step that is not loading', () => {
    const { step, isLoading } = useExperimentStore.getState();
    expect(step).toBeNull();
    expect(isLoading).toBe(false);
  });

  it('start() auto-advances past start/checkpoint onto the first screen', async () => {
    await useExperimentStore.getState().start(flow, 'test-slug');
    const { step, isLoading } = useExperimentStore.getState();
    expect(step?.state.type).toBe('in-node');
    expect(nodeId(step?.state)).toBe('screen-1');
    expect(isLoading).toBe(false);
  });

  it('start() records an enteredAt timing for the entered screen', async () => {
    await useExperimentStore.getState().start(flow, 'test-slug');
    const { step } = useExperimentStore.getState();
    const timings = step?.context.timings ?? {};
    const entries = Object.values(timings);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]).toMatchObject({ enteredAt: expect.any(String) });
  });

  it('start() honors an explicit startNodeId', async () => {
    await useExperimentStore.getState().start(flow, 'test-slug', 'start');
    expect(nodeId(useExperimentStore.getState().step?.state)).toBe('screen-1');
  });

  it('next() advances to the following screen', async () => {
    await useExperimentStore.getState().start(flow, 'test-slug');
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
    const promise = useExperimentStore.getState().start(flow, 'test-slug');
    expect(useExperimentStore.getState().isLoading).toBe(true);
    await promise;
    expect(useExperimentStore.getState().isLoading).toBe(false);
  });

  it('reset() clears step, isLoading, and error after a start()', async () => {
    await useExperimentStore.getState().start(flow, 'test-slug');
    expect(useExperimentStore.getState().step).not.toBeNull();

    useExperimentStore.getState().reset();

    const { step, isLoading, error } = useExperimentStore.getState();
    expect(step).toBeNull();
    expect(isLoading).toBe(false);
    expect(error).toBeNull();
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
    useExperimentStore.setState({ step: null, isLoading: false, error: null });
    vi.mocked(submitCheckpoint).mockResolvedValue(undefined);
  });

  it('a subsequent successful next() clears the error', async () => {
    await useExperimentStore.getState().start(flow, 'test-slug');
    useExperimentStore.setState({ error: 'previous error' });
    await useExperimentStore.getState().next({ one: 'answer' });
    expect(useExperimentStore.getState().error).toBeNull();
  });
});

describe('checkpoint persistence is off the participant-blocking path', () => {
  beforeEach(() => {
    useExperimentStore.setState({ step: null, isLoading: false, error: null });
  });

  it('next() still advances the step when the checkpoint POST rejects', async () => {
    vi.mocked(submitCheckpoint).mockResolvedValue(undefined);
    await useExperimentStore.getState().start(flowWithCheckpointAfterFirst, 'test-slug');
    vi.mocked(submitCheckpoint).mockRejectedValueOnce(new Error('network error'));

    await useExperimentStore.getState().next({ one: 'answer' });

    const { step, error, isLoading } = useExperimentStore.getState();
    expect(nodeId(step?.state)).toBe('screen-2');
    expect(error).toBeNull();
    expect(isLoading).toBe(false);
  });

  it("next() does not await submitCheckpoint's promise before resolving", async () => {
    vi.mocked(submitCheckpoint).mockResolvedValue(undefined);
    await useExperimentStore.getState().start(flowWithCheckpointAfterFirst, 'test-slug');

    let resolveCheckpoint: () => void = () => {};
    vi.mocked(submitCheckpoint).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCheckpoint = () => resolve(undefined);
      }),
    );

    await useExperimentStore.getState().next({ one: 'answer' });
    expect(nodeId(useExperimentStore.getState().step?.state)).toBe('screen-2');

    resolveCheckpoint();
  });
});
