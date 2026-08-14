import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canGoBack,
  goBack,
  pushHistory,
  startExperiment,
  traverse,
} from '@experiment-hub/engine/flow';
import { ExperimentFlow, FlowStep } from '@experiment-hub/engine/types';
import { makeScreen, seq } from '../test-helpers';

// Drives the store's actual usage pattern: snapshot the step being left onto
// `history` immediately before calling traverse(). Mirrors
// apps/frontend/src/data/store.ts's next().
async function advance(
  step: FlowStep,
  history: FlowStep[],
  data?: Record<string, unknown>,
) {
  const nextStep = await traverse(step, data);
  return { step: nextStep, history: pushHistory(history, step) };
}

function screenId(step: FlowStep): string | undefined {
  return step.state.type === 'in-node' ? step.state.node.id : undefined;
}

describe('back navigation history (goBack/canGoBack/pushHistory)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reports canGoBack(false) and goBack(null) on an empty history', async () => {
    const flow: ExperimentFlow = {
      nodes: [{ id: 'start', type: 'start' }, makeScreen('s1')],
      edges: [seq('start', 's1')],
    };
    const step = await startExperiment(flow, 'start');
    expect(canGoBack([])).toBe(false);
    expect(goBack([])).toBeNull();
    expect(screenId(step)).toBe('s1');
  });

  it('goBack never calls traverse — it restores the exact prior FlowStep', async () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: 'start', type: 'start' },
        makeScreen('s1'),
        makeScreen('s2'),
      ],
      edges: [seq('start', 's1'), seq('s1', 's2')],
    };
    const onS1 = await startExperiment(flow, 'start');
    let step = onS1;
    let history: FlowStep[] = [];
    ({ step, history } = await advance(step, history, { a: 1 }));
    expect(screenId(step)).toBe('s2');
    expect(canGoBack(history)).toBe(true);

    const restored = goBack(history);
    expect(restored).not.toBeNull();
    expect(screenId(restored!.step)).toBe('s1');
    // Same object identity as the pre-advance snapshot — a real restore, not
    // a recomputed traversal.
    expect(restored!.step).toBe(onS1);
    expect(canGoBack(restored!.history)).toBe(false);
  });

  describe('branch', () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: 'start', type: 'start' },
        makeScreen('s-gate', 'gate'),
        {
          id: 'branch-1',
          type: 'branch',
          props: {
            name: 'Branch',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$gate.answer',
                  value: 'yes',
                },
              },
            ],
          },
        },
        makeScreen('s-yes', 'yes-screen'),
        makeScreen('s-no', 'no-screen'),
      ],
      edges: [
        seq('start', 's-gate'),
        seq('s-gate', 'branch-1'),
        { type: 'branch-condition', from: 'branch-1.yes', to: 's-yes' },
        { type: 'branch-default', from: 'branch-1', to: 's-no' },
      ],
    };

    it('back from the branch-selected screen restores the screen before the branch', async () => {
      let step = await startExperiment(flow, 'start');
      let history: FlowStep[] = [];
      ({ step, history } = await advance(step, history, { answer: 'yes' }));
      expect(screenId(step)).toBe('s-yes');

      const restored = goBack(history)!;
      expect(screenId(restored.step)).toBe('s-gate');
    });

    it('re-forwarding after back re-evaluates the branch against new data (intended: lets a participant revise the answer that drives it)', async () => {
      let step = await startExperiment(flow, 'start');
      let history: FlowStep[] = [];
      ({ step, history } = await advance(step, history, { answer: 'yes' }));
      expect(screenId(step)).toBe('s-yes');

      const restored = goBack(history)!;
      const revised = await traverse(restored.step, { answer: 'no' });
      expect(screenId(revised)).toBe('s-no');
    });
  });

  describe('fork', () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: 'start', type: 'start' },
        makeScreen('s-gate', 'gate'),
        {
          id: 'fork-1',
          type: 'fork',
          props: {
            name: 'Fork',
            forks: [
              { id: 'a', name: 'A', weight: 1 },
              { id: 'b', name: 'B', weight: 1 },
            ],
          },
        },
        makeScreen('s-a', 'variant-a'),
        makeScreen('s-b', 'variant-b'),
      ],
      edges: [
        seq('start', 's-gate'),
        seq('s-gate', 'fork-1'),
        { type: 'fork-edge', from: 'fork-1.a', to: 's-a' },
        { type: 'fork-edge', from: 'fork-1.b', to: 's-b' },
      ],
    };

    it('back from the fork-selected screen restores the screen before the fork, winner unchanged', async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0); // always fork "a"
      let step = await startExperiment(flow, 'start');
      let history: FlowStep[] = [];
      ({ step, history } = await advance(step, history, {}));
      expect(screenId(step)).toBe('s-a');

      const restored = goBack(history)!;
      expect(screenId(restored.step)).toBe('s-gate');
      // context still carries the resolved winner even though we've backed
      // out of it — goBack never re-runs traverse(), so nothing was re-rolled.
      expect(step.context.forks?.['fork-1']).toBe('a');
    });

    it('known limitation: re-forwarding past a fork after going back can re-roll the winner (traverse() re-resolves it fresh — unchanged, existing traverse() behavior, not something goBack introduces)', async () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0); // first pass: fork "a"
      let step = await startExperiment(flow, 'start');
      let history: FlowStep[] = [];
      ({ step, history } = await advance(step, history, {}));
      expect(screenId(step)).toBe('s-a');

      const restored = goBack(history)!;
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.999); // re-forward: fork "b"
      const revised = await traverse(restored.step, {});
      expect(screenId(revised)).toBe('s-b');
    });
  });

  describe('path', () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'path-q', type: 'path', props: { name: 'Questions' } },
        makeScreen('screen-q1', 'q1'),
        makeScreen('screen-q2', 'q2'),
        makeScreen('screen-q3', 'q3'),
        makeScreen('screen-end', 'end'),
      ],
      edges: [
        seq('start', 'path-q'),
        { type: 'path-contains', from: 'path-q', to: 'screen-q1', order: 0 },
        { type: 'path-contains', from: 'path-q', to: 'screen-q2', order: 1 },
        { type: 'path-contains', from: 'path-q', to: 'screen-q3', order: 2 },
        seq('path-q', 'screen-end'),
      ],
    };

    it('steps back one child at a time within the path, preserving order tracking', async () => {
      let step = await startExperiment(flow, 'start');
      let history: FlowStep[] = [];
      ({ step, history } = await advance(step, history, { a: 1 }));
      ({ step, history } = await advance(step, history, { a: 2 }));
      expect((step.state as any).innerState.node.id).toBe('screen-q3');

      let restored = goBack(history)!;
      expect((restored.step.state as any).innerState.node.id).toBe('screen-q2');

      restored = goBack(restored.history)!;
      expect((restored.step.state as any).innerState.node.id).toBe('screen-q1');
    });

    it('backing out of the path\'s first child restores the screen before the path', async () => {
      const flowWithLeadIn: ExperimentFlow = {
        nodes: [{ id: 'start', type: 'start' }, makeScreen('lead-in'), ...flow.nodes.slice(1)],
        edges: [seq('start', 'lead-in'), seq('lead-in', 'path-q'), ...flow.edges.slice(1)],
      };
      let step = await startExperiment(flowWithLeadIn, 'start');
      expect(screenId(step)).toBe('lead-in');
      let history: FlowStep[] = [];
      ({ step, history } = await advance(step, history, {}));
      expect((step.state as any).innerState.node.id).toBe('screen-q1');

      const restored = goBack(history)!;
      expect(screenId(restored.step)).toBe('lead-in');
    });
  });

  describe('loop', () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: 'start', type: 'start' },
        {
          id: 'loop-items',
          type: 'loop',
          props: { type: 'static', values: ['a', 'b', 'c'] },
        },
        makeScreen('screen-item', 'item'),
        makeScreen('screen-end', 'end'),
      ],
      edges: [
        seq('start', 'loop-items'),
        { type: 'loop-template', from: 'loop-items', to: 'screen-item' },
        seq('loop-items', 'screen-end'),
      ],
    };

    it('backing out of iteration 2 restores iteration 1 of the same loop', async () => {
      let step = await startExperiment(flow, 'start');
      let history: FlowStep[] = [];
      expect((step.state as any).index).toBe(0);
      ({ step, history } = await advance(step, history, { v: 1 }));
      expect((step.state as any).index).toBe(1);

      const restored = goBack(history)!;
      expect((restored.step.state as any).index).toBe(0);
      expect(restored.step.context.loopData?.['loop-items']?.index).toBe(0);
    });
  });

  describe('checkpoint', () => {
    const flow: ExperimentFlow = {
      nodes: [
        { id: 'start', type: 'start' },
        makeScreen('screen-q1', 'q1'),
        { id: 'cp1', type: 'checkpoint', props: { name: 'after-q1' } },
        makeScreen('screen-q2', 'q2'),
      ],
      edges: [
        seq('start', 'screen-q1'),
        seq('screen-q1', 'cp1'),
        seq('cp1', 'screen-q2'),
      ],
    };

    it('goBack alone never re-fires onCheckpoint (no traverse() call)', async () => {
      const onCheckpoint = vi.fn().mockResolvedValue(undefined);
      let step = await startExperiment(flow, 'start', { onCheckpoint });
      let history: FlowStep[] = [];
      ({ step, history } = await advance(step, history, { q1: 'answer' }));
      expect(screenId(step)).toBe('screen-q2');
      expect(onCheckpoint).toHaveBeenCalledTimes(1);

      goBack(history);
      expect(onCheckpoint).toHaveBeenCalledTimes(1); // unchanged
    });

    it('known consequence: re-forwarding past a checkpoint after going back re-fires onCheckpoint (existing traverse() behavior — see flow.checkpoint.test.ts)', async () => {
      const onCheckpoint = vi.fn().mockResolvedValue(undefined);
      let step = await startExperiment(flow, 'start', { onCheckpoint });
      let history: FlowStep[] = [];
      ({ step, history } = await advance(step, history, { q1: 'answer' }));
      expect(onCheckpoint).toHaveBeenCalledTimes(1);

      const restored = goBack(history)!;
      await traverse(restored.step, { q1: 'revised answer' });
      expect(onCheckpoint).toHaveBeenCalledTimes(2);
    });
  });
});
