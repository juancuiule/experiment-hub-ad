import { validateExperiment } from '@experiment-hub/engine/experiment-validation';
import { ExperimentFlow } from '@experiment-hub/engine/types';
import { describe, expect, it } from 'vitest';
import { makeScreen, seq } from './test-helpers';

const start = { id: 'start', type: 'start' as const };
const end = { id: 'end', type: 'end' as const };

function codes(flow: ExperimentFlow) {
  return validateExperiment(flow).map((e) => e.code);
}

function messages(flow: ExperimentFlow) {
  return validateExperiment(flow).map((e) => e.message);
}

function categories(flow: ExperimentFlow) {
  return validateExperiment(flow).map((e) => e.category);
}

// Minimal valid flow used as a baseline across tests
const minimalFlow: ExperimentFlow = {
  nodes: [start, makeScreen('s1', 'welcome'), end],
  edges: [seq('start', 's1'), seq('s1', 'end')],
  screens: [
    {
      slug: 'welcome',
      components: [
        {
          componentFamily: 'layout',
          template: 'button',
          props: { text: 'Go' },
        },
      ],
    },
  ],
};

describe('error categories', () => {
  it('assigns explicit categories to validation errors', () => {
    const missingStartFlow: ExperimentFlow = {
      nodes: [makeScreen('s1', 'welcome'), end],
      edges: [],
      screens: [],
    };
    expect(categories(missingStartFlow)).toContain('node');

    const missingEdgeFlow: ExperimentFlow = {
      nodes: [start],
      edges: [],
    };
    expect(categories(missingEdgeFlow)).toContain('edge');

    const missingScreenFlow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome')],
      edges: [seq('start', 's1')],
      screens: [],
    };
    expect(categories(missingScreenFlow)).toContain('screen');

    const branchFlow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$q.answer',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s2', 'fallback'),
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'b'),
        { type: 'branch-default', from: 'b', to: 's2' },
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'answer', label: '?' },
            },
          ],
        },
        { slug: 'fallback', components: [] },
      ],
    };
    expect(categories(branchFlow)).toContain('branch');

    const referenceFlow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome')],
      edges: [seq('start', 's1')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'content',
              template: 'rich-text',
              props: { content: '{{$$missing.value}}' },
            },
          ],
        },
      ],
    };
    expect(categories(referenceFlow)).toContain('reference');
  });
});

describe('node identity', () => {
  it('passes a valid minimal flow', () => {
    expect(validateExperiment(minimalFlow)).toEqual([]);
  });

  it('reports duplicate-node-id', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'a'), makeScreen('s1', 'b'), end],
      edges: [],
    };
    expect(codes(flow)).toContain('duplicate-node-id');
  });

  it('reports missing-start', () => {
    const flow: ExperimentFlow = {
      nodes: [makeScreen('s1', 'welcome')],
      edges: [],
      screens: [],
    };
    expect(codes(flow)).toContain('missing-start');
  });

  it('reports missing-end when there is no end node', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome')],
      edges: [seq('start', 's1')],
      screens: [{ slug: 'welcome', components: [] }],
    };
    expect(codes(flow)).toContain('missing-end');
  });

  it('accepts multiple start nodes (valid multi-entry-point design)', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { ...start, id: 'start2' },
        makeScreen('s1', 'welcome'),
        makeScreen('s2', 'other'),
      ],
      edges: [seq('start', 's1'), seq('start2', 's2')],
      screens: [
        { slug: 'welcome', components: [] },
        { slug: 'other', components: [] },
      ],
    };
    expect(codes(flow)).not.toContain('multiple-start');
    expect(codes(flow)).not.toContain('missing-start');
  });
});

describe('edge endpoints', () => {
  it('reports unknown source node', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome')],
      edges: [{ type: 'sequential', from: 'ghost', to: 's1' }],
      screens: [{ slug: 'welcome', components: [] }],
    };
    expect(codes(flow)).toContain('unknown-node');
    expect(messages(flow).some((m) => m.includes('"ghost"'))).toBe(true);
  });

  it('reports unknown target node', () => {
    const flow: ExperimentFlow = {
      nodes: [start],
      edges: [seq('start', 'ghost')],
    };
    expect(codes(flow)).toContain('unknown-node');
    expect(messages(flow).some((m) => m.includes('"ghost"'))).toBe(true);
  });

  it('reports unknown-node when dot-segment from node id does not exist', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'q')],
      edges: [
        seq('start', 's1'),
        { type: 'branch-condition', from: 'ghost.cond', to: 's1' },
      ],
      screens: [{ slug: 'q', components: [] }],
    };
    expect(codes(flow)).toContain('unknown-node');
    expect(messages(flow).some((m) => m.includes('"ghost"'))).toBe(true);
  });
});

describe('start node wiring', () => {
  it('reports missing-edge when start has no sequential outgoing edge', () => {
    const flow: ExperimentFlow = {
      nodes: [start],
      edges: [],
    };
    expect(codes(flow)).toContain('missing-edge');
  });
});

describe('checkpoint wiring', () => {
  it('passes when checkpoint has no sequential edge (valid terminal)', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'welcome'),
        { id: 'cp', type: 'checkpoint', props: { name: 'done' } },
      ],
      edges: [seq('start', 's1'), seq('s1', 'cp')],
      screens: [{ slug: 'welcome', components: [] }],
    };
    expect(codes(flow)).not.toContain('ambiguous-edge');
  });

  it('reports ambiguous-edge when checkpoint has more than one sequential outgoing edge', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'cp', type: 'checkpoint', props: { name: 'done' } },
        makeScreen('s1', 'a'),
        makeScreen('s2', 'b'),
      ],
      edges: [seq('start', 'cp'), seq('cp', 's1'), seq('cp', 's2')],
      screens: [
        { slug: 'a', components: [] },
        { slug: 'b', components: [] },
      ],
    };
    expect(codes(flow)).toContain('ambiguous-edge');
  });
});

describe('branch wiring', () => {
  it('passes a fully wired branch', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'Test',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$q.answer',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s1', 'q'),
        makeScreen('s-yes', 'yes-screen'),
        makeScreen('s-no', 'no-screen'),
        end,
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'b'),
        { type: 'branch-condition', from: 'b.yes', to: 's-yes' },
        { type: 'branch-default', from: 'b', to: 's-no' },
        seq('s-yes', 'end'),
        seq('s-no', 'end'),
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'answer', label: '?' },
            },
          ],
        },
        { slug: 'yes-screen', components: [] },
        { slug: 'no-screen', components: [] },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('reports missing-edge when branch has no branch-default edge', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$s1.v',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s1', 'q'),
        makeScreen('s-yes', 'yes'),
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'b'),
        { type: 'branch-condition', from: 'b.yes', to: 's-yes' },
        // no branch-default
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'v', label: '?' },
            },
          ],
        },
        { slug: 'yes', components: [] },
      ],
    };
    expect(codes(flow)).toContain('missing-edge');
  });

  it('reports unrouted-branch when a branch condition has no branch-condition edge', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$s1.v',
                  value: 'y',
                },
              },
              {
                id: 'maybe',
                name: 'Maybe',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$s1.v',
                  value: 'm',
                },
              },
            ],
          },
        },
        makeScreen('s1', 'q'),
        makeScreen('s-yes', 'yes'),
        makeScreen('s-no', 'no'),
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'b'),
        { type: 'branch-condition', from: 'b.yes', to: 's-yes' },
        // "maybe" has no branch-condition edge
        { type: 'branch-default', from: 'b', to: 's-no' },
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'v', label: '?' },
            },
          ],
        },
        { slug: 'yes', components: [] },
        { slug: 'no', components: [] },
      ],
    };
    expect(codes(flow)).toContain('unrouted-branch');
    expect(messages(flow).some((m) => m.includes('"maybe"'))).toBe(true);
  });

  it('reports empty-branch when branch has no branches defined', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'b', type: 'branch', props: { name: 'B', branches: [] } },
        end,
      ],
      edges: [],
      screens: [],
    };
    expect(codes(flow)).toContain('empty-branch');
  });

  it('reports duplicate-branch-id when two branches share the same id', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'cond',
                name: 'First',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$s.v',
                  value: 'y',
                },
              },
              {
                id: 'cond',
                name: 'Second',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$s.v',
                  value: 'n',
                },
              },
            ],
          },
        },
        end,
      ],
      edges: [],
      screens: [],
    };
    expect(codes(flow)).toContain('duplicate-branch-id');
  });

  it('reports condition-empty when a branch condition is an empty and/or', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              { id: 'cond', name: 'Cond', config: { type: 'and', conditions: [] } },
            ],
          },
        },
        end,
      ],
      edges: [],
      screens: [],
    };
    expect(codes(flow)).toContain('condition-empty');
  });

  it('reports invalid-edge when branch-condition references a non-existent branch id', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$s1.v',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s1', 'q'),
        makeScreen('s-yes', 'yes'),
        makeScreen('s-no', 'no'),
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'b'),
        { type: 'branch-condition', from: 'b.yes', to: 's-yes' },
        { type: 'branch-condition', from: 'b.ghost', to: 's-no' }, // "ghost" doesn't exist
        { type: 'branch-default', from: 'b', to: 's-no' },
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'v', label: '?' },
            },
          ],
        },
        { slug: 'yes', components: [] },
        { slug: 'no', components: [] },
      ],
    };
    expect(codes(flow)).toContain('invalid-edge');
    expect(messages(flow).some((m) => m.includes('"ghost"'))).toBe(true);
  });
});

describe('fork wiring', () => {
  it('reports missing-edge when a fork id has no fork-edge', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'f',
          type: 'fork',
          props: {
            name: 'Variant fork',
            forks: [
              { id: 'a', name: 'A' },
              { id: 'b', name: 'B' },
            ],
          },
        },
        makeScreen('s-a', 'variant-a'),
        makeScreen('s-b', 'variant-b'),
      ],
      edges: [
        seq('start', 'f'),
        { type: 'fork-edge', from: 'f.a', to: 's-a' },
        // "b" has no fork-edge
      ],
      screens: [
        { slug: 'variant-a', components: [] },
        { slug: 'variant-b', components: [] },
      ],
    };
    expect(codes(flow)).toContain('missing-edge');
    expect(messages(flow).some((m) => m.includes('"b"'))).toBe(true);
  });

  it('reports missing-edge when fork has only 1 arm', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'f',
          type: 'fork',
          props: { name: 'Variant fork', forks: [{ id: 'a', name: 'A' }] },
        },
        makeScreen('s-a', 'variant-a'),
      ],
      edges: [seq('start', 'f'), { type: 'fork-edge', from: 'f.a', to: 's-a' }],
      screens: [{ slug: 'variant-a', components: [] }],
    };
    expect(codes(flow)).toContain('missing-edge');
    expect(messages(flow).some((m) => m.includes('at least two are required'))).toBe(
      true,
    );
  });

  it('does not report missing-edge for arm count when fork has 2 arms', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'f',
          type: 'fork',
          props: {
            name: 'Variant fork',
            forks: [
              { id: 'a', name: 'A' },
              { id: 'b', name: 'B' },
            ],
          },
        },
        makeScreen('s-a', 'variant-a'),
        makeScreen('s-b', 'variant-b'),
      ],
      edges: [
        seq('start', 'f'),
        { type: 'fork-edge', from: 'f.a', to: 's-a' },
        { type: 'fork-edge', from: 'f.b', to: 's-b' },
      ],
      screens: [
        { slug: 'variant-a', components: [] },
        { slug: 'variant-b', components: [] },
      ],
    };
    expect(messages(flow).some((m) => m.includes('at least two are required'))).toBe(
      false,
    );
  });

  it('reports empty-fork when fork has no forks defined', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'f', type: 'fork', props: { name: 'F', forks: [] } },
        end,
      ],
      edges: [],
      screens: [],
    };
    expect(codes(flow)).toContain('empty-fork');
  });

  it('reports duplicate-fork-id when two forks share the same id', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'f',
          type: 'fork',
          props: {
            name: 'F',
            forks: [
              { id: 'arm', name: 'First' },
              { id: 'arm', name: 'Second' },
            ],
          },
        },
        end,
      ],
      edges: [],
      screens: [],
    };
    expect(codes(flow)).toContain('duplicate-fork-id');
  });

  it('reports unrouted-fork when a fork id in props has no fork-edge', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'f',
          type: 'fork',
          props: {
            name: 'F',
            forks: [
              { id: 'a', name: 'A' },
              { id: 'b', name: 'B' },
              { id: 'c', name: 'C' },
            ],
          },
        },
        makeScreen('sa', 'a'),
        makeScreen('sb', 'b'),
      ],
      edges: [
        seq('start', 'f'),
        { type: 'fork-edge', from: 'f.a', to: 'sa' },
        { type: 'fork-edge', from: 'f.b', to: 'sb' },
        // 'c' has no fork-edge
      ],
      screens: [
        { slug: 'a', components: [] },
        { slug: 'b', components: [] },
      ],
    };
    expect(codes(flow)).toContain('unrouted-fork');
    expect(messages(flow).some((m) => m.includes('"c"'))).toBe(true);
  });

  it('reports invalid-edge when fork-edge references a non-existent fork id', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'f',
          type: 'fork',
          props: { name: 'Variant fork', forks: [{ id: 'a', name: 'A' }] },
        },
        makeScreen('s-a', 'variant-a'),
        makeScreen('s-ghost', 'ghost'),
      ],
      edges: [
        seq('start', 'f'),
        { type: 'fork-edge', from: 'f.a', to: 's-a' },
        { type: 'fork-edge', from: 'f.ghost', to: 's-ghost' }, // "ghost" not in forks
      ],
      screens: [
        { slug: 'variant-a', components: [] },
        { slug: 'ghost', components: [] },
      ],
    };
    expect(codes(flow)).toContain('invalid-edge');
    expect(messages(flow).some((m) => m.includes('"ghost"'))).toBe(true);
  });
});

describe('path wiring', () => {
  it('reports missing-edge when path has no path-contains edges', () => {
    const flow: ExperimentFlow = {
      nodes: [start, { id: 'p', type: 'path', props: { name: 'P' } }],
      edges: [seq('start', 'p')],
    };
    expect(codes(flow)).toContain('missing-edge');
  });

  it('reports missing-edge when path has no sequential exit edge', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'p', type: 'path', props: { name: 'P' } },
        makeScreen('s1', 'step-a'),
      ],
      edges: [
        seq('start', 'p'),
        { type: 'path-contains', from: 'p', to: 's1', order: 0 },
        // no sequential edge from "p"
      ],
      screens: [{ slug: 'step-a', components: [] }],
    };
    expect(codes(flow)).toContain('missing-edge');
    expect(
      messages(flow).some((m) => m.includes('no sequential outgoing edge')),
    ).toBe(true);
  });

  it('reports ambiguous-edge when path has more than one sequential exit edge', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'p', type: 'path', props: { name: 'P' } },
        makeScreen('s1', 'step-a'),
        makeScreen('s-after1', 'after1'),
        makeScreen('s-after2', 'after2'),
      ],
      edges: [
        seq('start', 'p'),
        { type: 'path-contains', from: 'p', to: 's1', order: 0 },
        seq('p', 's-after1'),
        seq('p', 's-after2'),
      ],
      screens: [
        { slug: 'step-a', components: [] },
        { slug: 'after1', components: [] },
        { slug: 'after2', components: [] },
      ],
    };
    expect(codes(flow)).toContain('ambiguous-edge');
    expect(
      messages(flow).some((m) =>
        m.includes('sequential outgoing edges; at most one is allowed'),
      ),
    ).toBe(true);
  });

  it('reports invalid-edge when path-contains edge does not source from a path node', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'a'), makeScreen('s2', 'b')],
      edges: [
        seq('start', 's1'),
        { type: 'path-contains', from: 's1', to: 's2', order: 0 }, // s1 is a screen, not a path
      ],
      screens: [
        { slug: 'a', components: [] },
        { slug: 'b', components: [] },
      ],
    };
    expect(codes(flow)).toContain('invalid-edge');
  });
});

describe('loop wiring', () => {
  it('reports missing-edge when loop has no loop-template edge', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'loop', type: 'loop', props: { type: 'static', values: ['a'] } },
      ],
      edges: [seq('start', 'loop')],
    };
    expect(codes(flow)).toContain('missing-edge');
  });

  it('reports duplicate-edge when loop has more than one loop-template edge', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'loop', type: 'loop', props: { type: 'static', values: ['a'] } },
        makeScreen('s1', 'item-a'),
        makeScreen('s2', 'item-b'),
      ],
      edges: [
        seq('start', 'loop'),
        { type: 'loop-template', from: 'loop', to: 's1' },
        { type: 'loop-template', from: 'loop', to: 's2' },
      ],
      screens: [
        { slug: 'item-a', components: [] },
        { slug: 'item-b', components: [] },
      ],
    };
    expect(codes(flow)).toContain('duplicate-edge');
  });

  it('reports invalid-edge when loop-template does not source from a loop node', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'a'), makeScreen('s2', 'b')],
      edges: [
        seq('start', 's1'),
        { type: 'loop-template', from: 's1', to: 's2' }, // s1 is a screen, not a loop
      ],
      screens: [
        { slug: 'a', components: [] },
        { slug: 'b', components: [] },
      ],
    };
    expect(codes(flow)).toContain('invalid-edge');
  });
});

describe('screen definitions', () => {
  it('reports missing-screen when a screen node has no matching definition', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'missing-slug')],
      edges: [seq('start', 's1')],
      screens: [],
    };
    expect(codes(flow)).toContain('missing-screen');
    expect(messages(flow).some((m) => m.includes('"missing-slug"'))).toBe(true);
  });

  it('reports duplicate-screen when two definitions share a slug', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome')],
      edges: [seq('start', 's1')],
      screens: [
        { slug: 'welcome', components: [] },
        { slug: 'welcome', components: [] },
      ],
    };
    expect(codes(flow)).toContain('duplicate-screen');
  });

  it('reports unreferenced-screen when a definition has no matching screen node', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome')],
      edges: [seq('start', 's1')],
      screens: [
        { slug: 'welcome', components: [] },
        { slug: 'orphan', components: [] }, // no node references this
      ],
    };
    expect(codes(flow)).toContain('unreferenced-screen');
    expect(messages(flow).some((m) => m.includes('"orphan"'))).toBe(true);
  });
});

describe('nested node wiring', () => {
  it('does not require sequential edge from branch arm screens inside a loop template', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'loop', type: 'loop', props: { type: 'static', values: ['a', 'b'] } },
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'is-a',
                name: 'Is A',
                config: { type: 'simple', operator: 'eq', dataKey: '@loop.value', value: 'a' },
              },
            ],
          },
        },
        makeScreen('s-a', 'screen-a'),
        makeScreen('s-other', 'screen-other'),
        end,
      ],
      edges: [
        seq('start', 'loop'),
        { type: 'loop-template', from: 'loop', to: 'b' },
        { type: 'branch-condition', from: 'b.is-a', to: 's-a' },
        { type: 'branch-default', from: 'b', to: 's-other' },
        seq('loop', 'end'),
      ],
      screens: [
        { slug: 'screen-a', components: [] },
        { slug: 'screen-other', components: [] },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('does not require sequential edge from branch arm screens inside a path', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s-before', 'before'),
        { id: 'p', type: 'path', props: { name: 'P' } },
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: { type: 'simple', operator: 'eq', dataKey: '$$before.answer', value: 'y' },
              },
            ],
          },
        },
        makeScreen('s-yes', 'yes-screen'),
        makeScreen('s-after', 'after'),
        end,
      ],
      edges: [
        seq('start', 's-before'),
        seq('s-before', 'p'),
        { type: 'path-contains', from: 'p', to: 'b', order: 0 },
        { type: 'branch-condition', from: 'b.yes', to: 's-yes' },
        { type: 'branch-default', from: 'b', to: 's-after' },
        { type: 'path-contains', from: 'p', to: 's-after', order: 1 },
        seq('p', 'end'),
      ],
      screens: [
        {
          slug: 'before',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'answer', label: '?' },
            },
          ],
        },
        { slug: 'yes-screen', components: [] },
        { slug: 'after', components: [] },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('does not treat direct branch arm of a top-level branch as nested', () => {
    // Branch B is top-level (not inside a path/loop).
    // arm 'with-path' → path P → s-in-path  (s-in-path is nested via path-contains)
    // default arm      → s-direct            (NOT nested — B is top-level)
    // P and s-direct both need explicit sequential edges; s-in-path does not.
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s-q', 'q'),
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'with-path',
                name: 'With path',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$q.answer',
                  value: 'y',
                },
              },
            ],
          },
        },
        { id: 'p', type: 'path', props: { name: 'P' } },
        makeScreen('s-in-path', 'in-path'),
        makeScreen('s-direct', 'direct'),
        end,
      ],
      edges: [
        seq('start', 's-q'),
        seq('s-q', 'b'),
        { type: 'branch-condition', from: 'b.with-path', to: 'p' },
        { type: 'branch-default', from: 'b', to: 's-direct' },
        { type: 'path-contains', from: 'p', to: 's-in-path', order: 0 },
        seq('p', 'end'),
        seq('s-direct', 'end'),
        // s-in-path has no sequential edge — nested inside p, no edge required
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'answer', label: '?' },
            },
          ],
        },
        { slug: 'in-path', components: [] },
        { slug: 'direct', components: [] },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('reports missing-edge for the direct branch arm but not for the nested screen in its sibling path arm', () => {
    // Same as above, but s-direct is missing its sequential exit edge.
    // Only s-direct should be flagged — not s-in-path (nested) and not p (has its edge).
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s-q', 'q'),
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'with-path',
                name: 'With path',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$q.answer',
                  value: 'y',
                },
              },
            ],
          },
        },
        { id: 'p', type: 'path', props: { name: 'P' } },
        makeScreen('s-in-path', 'in-path'),
        makeScreen('s-direct', 'direct'),
        end,
      ],
      edges: [
        seq('start', 's-q'),
        seq('s-q', 'b'),
        { type: 'branch-condition', from: 'b.with-path', to: 'p' },
        { type: 'branch-default', from: 'b', to: 's-direct' },
        { type: 'path-contains', from: 'p', to: 's-in-path', order: 0 },
        seq('p', 'end'),
        // missing: seq('s-direct', 'end')
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'answer', label: '?' },
            },
          ],
        },
        { slug: 'in-path', components: [] },
        { slug: 'direct', components: [] },
      ],
    };
    const errs = validateExperiment(flow);
    expect(errs.map((e) => e.code)).toContain('missing-edge');
    expect(errs.some((e) => e.message.includes('"s-direct"'))).toBe(true);
    expect(errs.every((e) => !e.message.includes('"s-in-path"'))).toBe(true);
  });
});

describe('@ reference checks', () => {
  it('accepts @value in a loop template screen', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'loop',
          type: 'loop',
          props: { type: 'static', values: ['a', 'b'] },
        },
        makeScreen('s-item', 'item'),
        end,
      ],
      edges: [
        seq('start', 'loop'),
        { type: 'loop-template', from: 'loop', to: 's-item' },
        seq('loop', 'end'),
      ],
      screens: [
        {
          slug: 'item',
          components: [
            {
              componentFamily: 'response',
              template: 'likert-scale',
              props: {
                dataKey: 'score-{{@loop.value}}',
                label: 'Rate {{@loop.value}}',
                options: [
                  { label: 'Low', value: '1' },
                  { label: 'Medium', value: '2' },
                  { label: 'High', value: '3' },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('reports invalid-reference for @value used outside a loop', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome')],
      edges: [seq('start', 's1')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'name', label: 'Hi {{@loop.value}}' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('invalid-reference');
    expect(messages(flow).some((m) => m.includes('not inside a loop'))).toBe(
      true,
    );
  });

  it('reports invalid-reference for @value in rich-text outside a loop', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'intro')],
      edges: [seq('start', 's1')],
      screens: [
        {
          slug: 'intro',
          components: [
            {
              componentFamily: 'content',
              template: 'rich-text',
              props: { content: '## {{@loop.value}}' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('invalid-reference');
  });
});

describe('$ (single-dollar) reference checks', () => {
  it('accepts a $ reference to a response field in the same screen', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome'), end],
      edges: [seq('start', 's1'), seq('s1', 'end')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'name', label: 'Name' },
            },
            {
              componentFamily: 'content',
              template: 'rich-text',
              props: { content: 'Hello {{$name}}' },
            },
          ],
        },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('reports unavailable-reference for a $ reference to a field not in the screen', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome'), end],
      edges: [seq('start', 's1'), seq('s1', 'end')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'name', label: 'Hello {{$other}}' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('unavailable-reference');
  });

  it('reports unavailable-reference for a $ reference to a prior screen field ($ never crosses screens)', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'welcome'),
        makeScreen('s2', 'profile'),
        end,
      ],
      edges: [seq('start', 's1'), seq('s1', 's2'), seq('s2', 'end')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'name', label: 'Name' },
            },
          ],
        },
        {
          slug: 'profile',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'note', label: 'Hi {{$name}}' },
            },
          ],
        },
      ],
    };
    // The same field is reachable as {{$$welcome.name}}, but $name is not.
    expect(codes(flow)).toContain('unavailable-reference');
  });
});

describe('$$ reference checks', () => {
  it('accepts a $$ reference to a screen that ran before', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome'), makeScreen('s2', 'profile'), end],
      edges: [seq('start', 's1'), seq('s1', 's2'), seq('s2', 'end')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'name', label: 'Name' },
            },
          ],
        },
        {
          slug: 'profile',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'note', label: 'Hi {{$$welcome.name}}' },
            },
          ],
        },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('accepts a $$ reference to a field nested inside a group on a prior screen', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome'), makeScreen('s2', 'profile'), end],
      edges: [seq('start', 's1'), seq('s1', 's2'), seq('s2', 'end')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'layout',
              template: 'group',
              props: {
                name: 'group',
                components: [
                  {
                    componentFamily: 'response',
                    template: 'text-input',
                    props: { dataKey: 'name', label: 'Name' },
                  },
                ],
              },
            },
          ],
        },
        {
          slug: 'profile',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'note', label: 'Hi {{$$welcome.name}}' },
            },
          ],
        },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('accepts a $$ reference into the interior of an object-valued response field', () => {
    // The response stores an object under "address"; the walk only records the
    // leaf key "welcome.address", so a reference to a nested field must resolve
    // against that ancestor.
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'welcome'),
        makeScreen('s2', 'profile'),
        end,
      ],
      edges: [seq('start', 's1'), seq('s1', 's2'), seq('s2', 'end')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'address', label: 'Address' },
            },
          ],
        },
        {
          slug: 'profile',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'note', label: 'You live in {{$$welcome.address.city}}' },
            },
          ],
        },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('accepts a $ reference into the interior of a same-screen object-valued field', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome'), end],
      edges: [seq('start', 's1'), seq('s1', 'end')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'address', label: 'Address' },
            },
            {
              componentFamily: 'content',
              template: 'rich-text',
              props: { content: 'City: {{$address.city}}' },
            },
          ],
        },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('does not match a sibling key that shares a prefix segment', () => {
    // "$$welcome.addressLine" must NOT resolve against the key "welcome.address".
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'welcome'),
        makeScreen('s2', 'profile'),
        end,
      ],
      edges: [seq('start', 's1'), seq('s1', 's2'), seq('s2', 'end')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'address', label: 'Address' },
            },
          ],
        },
        {
          slug: 'profile',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'note', label: 'Hi {{$$welcome.addressLine}}' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('unavailable-reference');
  });

  it('reports unavailable-reference for a $$ token not yet written', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome')],
      edges: [seq('start', 's1')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'name', label: 'Hi {{$$other.name}}' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('unavailable-reference');
  });

  it('reports unwrapped-token for a bare $$ ref embedded in label text', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome')],
      edges: [seq('start', 's1')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'name', label: 'Hello $$welcome.name' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('unwrapped-token');
  });

  it('reports unwrapped-token for a bare $$ ref embedded in rich-text content', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome'), makeScreen('s2', 'profile'), end],
      edges: [seq('start', 's1'), seq('s1', 's2'), seq('s2', 'end')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'name', label: 'Name' },
            },
          ],
        },
        {
          slug: 'profile',
          components: [
            {
              componentFamily: 'content',
              template: 'rich-text',
              props: { content: 'Welcome back $$welcome.name, glad to see you' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('unwrapped-token');
  });

  it('accepts a $$ reference to data written inside a path', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'path-info', type: 'path', props: { name: 'Info' } },
        makeScreen('s-age', 'demographics'),
        makeScreen('s-after', 'after'),
        end,
      ],
      edges: [
        seq('start', 'path-info'),
        { type: 'path-contains', from: 'path-info', to: 's-age', order: 0 },
        seq('path-info', 's-after'),
        seq('s-after', 'end'),
      ],
      screens: [
        {
          slug: 'demographics',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'age', label: 'Age' },
            },
          ],
        },
        {
          slug: 'after',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: {
                dataKey: 'note',
                label: '{{$$path-info.demographics.age}}',
              },
            },
          ],
        },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('reports unavailable-reference for data written only in one branch', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s-before', 'before'),
        {
          id: 'branch',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$before.answer',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s-yes', 'branch-yes'),
        makeScreen('s-no', 'branch-no'),
        makeScreen('s-after', 'after'),
      ],
      edges: [
        seq('start', 's-before'),
        seq('s-before', 'branch'),
        { type: 'branch-condition', from: 'branch.yes', to: 's-yes' },
        { type: 'branch-default', from: 'branch', to: 's-no' },
        seq('s-yes', 's-after'),
        seq('s-no', 's-after'),
      ],
      screens: [
        {
          slug: 'before',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'answer', label: '?' },
            },
          ],
        },
        {
          slug: 'branch-yes',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'extra', label: 'Extra' },
            },
          ],
        },
        { slug: 'branch-no', components: [] },
        {
          slug: 'after',
          // "extra" is only written in the yes branch — not guaranteed
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'x', label: '{{$$branch-yes.extra}}' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('unavailable-reference');
  });

  it('accepts a $$ reference to data written before a branch', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s-before', 'before'),
        {
          id: 'branch',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$before.answer',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s-yes', 'branch-yes'),
        makeScreen('s-no', 'branch-no'),
        makeScreen('s-after', 'after'),
        end,
      ],
      edges: [
        seq('start', 's-before'),
        seq('s-before', 'branch'),
        { type: 'branch-condition', from: 'branch.yes', to: 's-yes' },
        { type: 'branch-default', from: 'branch', to: 's-no' },
        seq('s-yes', 's-after'),
        seq('s-no', 's-after'),
        seq('s-after', 'end'),
      ],
      screens: [
        {
          slug: 'before',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'answer', label: '?' },
            },
          ],
        },
        { slug: 'branch-yes', components: [] },
        { slug: 'branch-no', components: [] },
        {
          slug: 'after',
          // "answer" was written before the branch — always available
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'x', label: '{{$$before.answer}}' },
            },
          ],
        },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });
});

describe('condition reference checks', () => {
  it('accepts a valid $$ reference in a branch condition', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'welcome'),
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$welcome.answer',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s-yes', 'yes'),
        makeScreen('s-no', 'no'),
        end,
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'b'),
        { type: 'branch-condition', from: 'b.yes', to: 's-yes' },
        { type: 'branch-default', from: 'b', to: 's-no' },
        seq('s-yes', 'end'),
        seq('s-no', 'end'),
      ],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'answer', label: '?' },
            },
          ],
        },
        { slug: 'yes', components: [] },
        { slug: 'no', components: [] },
      ],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('reports unavailable-reference when condition references data not yet written', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            // References $$future.answer but no screen has run yet
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$future.answer',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s-yes', 'yes'),
        makeScreen('s-no', 'no'),
      ],
      edges: [
        seq('start', 'b'),
        { type: 'branch-condition', from: 'b.yes', to: 's-yes' },
        { type: 'branch-default', from: 'b', to: 's-no' },
      ],
      screens: [
        { slug: 'yes', components: [] },
        { slug: 'no', components: [] },
      ],
    };
    expect(codes(flow)).toContain('unavailable-reference');
  });

  it('reports invalid-reference when condition uses @value outside a loop', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        {
          id: 'b',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'yes',
                name: 'Yes',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '@loop.value',
                  value: 'y',
                },
              },
            ],
          },
        },
        makeScreen('s-yes', 'yes'),
        makeScreen('s-no', 'no'),
      ],
      edges: [
        seq('start', 'b'),
        { type: 'branch-condition', from: 'b.yes', to: 's-yes' },
        { type: 'branch-default', from: 'b', to: 's-no' },
      ],
      screens: [
        { slug: 'yes', components: [] },
        { slug: 'no', components: [] },
      ],
    };
    expect(codes(flow)).toContain('invalid-reference');
  });
});

describe('shared option references', () => {
  function makeRadioScreen(optionsValue: string | object[]) {
    return {
      slug: 'q',
      components: [
        {
          componentFamily: 'response' as const,
          template: 'radio' as const,
          props: {
            dataKey: 'answer',
            label: 'Pick one',
            options: optionsValue as any,
          },
        },
      ],
    };
  }

  it('passes when %name resolves to a key in experiment.options', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'q'), end],
      edges: [seq('start', 's1'), seq('s1', 'end')],
      options: { 'yes-no': [{ label: 'Yes', value: 'yes' }] },
      screens: [makeRadioScreen('%yes-no')],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('reports unknown-shared-options when %name is not in experiment.options', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'q')],
      edges: [seq('start', 's1')],
      screens: [makeRadioScreen('%missing')],
    };
    const errs = validateExperiment(flow);
    expect(errs.map((e) => e.code)).toContain('unknown-shared-options');
    expect(
      errs.find((e) => e.code === 'unknown-shared-options')!.message,
    ).toContain('%missing');
  });

  it('passes when options is an inline array (no % reference)', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'q'), end],
      edges: [seq('start', 's1'), seq('s1', 'end')],
      screens: [makeRadioScreen([{ label: 'Yes', value: 'yes' }])],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('passes when options is a $$ reference (not a % reference)', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'q')],
      edges: [seq('start', 's1')],
      screens: [makeRadioScreen('$$other-screen.data-key' as any)],
    };
    const codes = validateExperiment(flow).map((e) => e.code);
    expect(codes).not.toContain('unknown-shared-options');
  });

  it('reports unknown-shared-options for unsupported template placeholders in % references', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'q')],
      edges: [seq('start', 's1')],
      screens: [makeRadioScreen('%mirada-{{loop.value}}')],
    };
    const errs = validateExperiment(flow);
    expect(errs.map((e) => e.code)).toContain('unknown-shared-options');
    expect(
      errs.find((e) => e.code === 'unknown-shared-options')!.message,
    ).toContain('%mirada-{{loop.value}}');
  });
});

// ─── Compute node ────────────────────────────────────────────────────────────

function makeCompute(
  id: string,
  computations: any[] = [],
): ExperimentFlow['nodes'][0] {
  return { id, type: 'compute' as const, props: { name: id, computations } };
}

describe('compute node wiring', () => {
  it('passes a valid compute node with sequential exit edge', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeCompute('c1'), makeScreen('s1', 'end'), end],
      edges: [seq('start', 'c1'), seq('c1', 's1'), seq('s1', 'end')],
      screens: [{ slug: 'end', components: [] }],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('passes a compute node with no sequential exit edge (end of flow)', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'q'), makeCompute('c1'), end],
      edges: [seq('start', 's1'), seq('s1', 'c1'), seq('c1', 'end')],
      screens: [{ slug: 'q', components: [] }],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });
});

describe('compute node reference checks', () => {
  it('reports unavailable-reference for a $$ ref not yet written', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeCompute('c1', [
          {
            outputKey: 'total',
            formula: { type: 'sum', inputs: ['$$q.score'] },
          },
        ]),
        makeScreen('s1', 'end'),
        end,
      ],
      edges: [seq('start', 'c1'), seq('c1', 's1'), seq('s1', 'end')],
      screens: [{ slug: 'end', components: [] }],
    };
    expect(codes(flow)).toContain('unavailable-reference');
  });

  it('passes when $$ ref is available from a prior screen', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          {
            outputKey: 'total',
            formula: { type: 'sum', inputs: ['$$q.score'] },
          },
        ]),
        makeScreen('s2', 'end'),
        end,
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'c1'),
        seq('c1', 's2'),
        seq('s2', 'end'),
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'numeric-input',
              props: { dataKey: 'score', label: 'Score' },
            },
          ],
        },
        { slug: 'end', components: [] },
      ],
    };
    expect(codes(flow)).toEqual([]);
  });

  it('reports unknown-compute-output-reference when $outputKey references a key not yet defined in the same node', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          // level references $total but total is defined AFTER level — wrong order
          {
            outputKey: 'level',
            formula: {
              type: 'conditional',
              condition: {
                type: 'simple',
                operator: 'gte',
                dataKey: '$total',
                value: 10,
              },
              then: 'high',
              else: 'low',
            },
          },
          {
            outputKey: 'total',
            formula: { type: 'sum', inputs: ['$$q.score'] },
          },
        ]),
        makeScreen('s2', 'end'),
        end,
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'c1'),
        seq('c1', 's2'),
        seq('s2', 'end'),
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'numeric-input',
              props: { dataKey: 'score', label: 'Score' },
            },
          ],
        },
        { slug: 'end', components: [] },
      ],
    };
    expect(codes(flow)).toContain('unknown-compute-output-reference');
  });

  it('passes when $outputKey references an earlier output in the same node', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          {
            outputKey: 'total',
            formula: { type: 'sum', inputs: ['$$q.score'] },
          },
          {
            outputKey: 'level',
            formula: {
              type: 'conditional',
              condition: {
                type: 'simple',
                operator: 'gte',
                dataKey: '$total',
                value: 10,
              },
              then: 'high',
              else: 'low',
            },
          },
        ]),
        makeScreen('s2', 'end'),
        end,
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'c1'),
        seq('c1', 's2'),
        seq('s2', 'end'),
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'numeric-input',
              props: { dataKey: 'score', label: 'Score' },
            },
          ],
        },
        { slug: 'end', components: [] },
      ],
    };
    expect(codes(flow)).toEqual([]);
  });

  it('unknown-compute-output-reference: $nonexistent never declared in the node → error', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          {
            outputKey: 'total',
            formula: { type: 'sum', inputs: ['$ghost'] },
          },
        ]),
        end,
      ],
      edges: [seq('start', 's1'), seq('s1', 'c1'), seq('c1', 'end')],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'numeric-input',
              props: { dataKey: 'score', label: 'Score' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('unknown-compute-output-reference');
  });

  it('unknown-compute-output-reference: $later references output declared after current one → error', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          {
            outputKey: 'level',
            formula: {
              type: 'conditional',
              condition: {
                type: 'simple',
                operator: 'gte',
                dataKey: '$total',
                value: 10,
              },
              then: 'high',
              else: 'low',
            },
          },
          {
            outputKey: 'total',
            formula: { type: 'sum', inputs: ['$$q.score'] },
          },
        ]),
        end,
      ],
      edges: [seq('start', 's1'), seq('s1', 'c1'), seq('c1', 'end')],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'numeric-input',
              props: { dataKey: 'score', label: 'Score' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('unknown-compute-output-reference');
  });

  it('unknown-compute-output-reference: $earlier referencing a prior output → no error', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          {
            outputKey: 'total',
            formula: { type: 'sum', inputs: ['$$q.score'] },
          },
          {
            outputKey: 'level',
            formula: {
              type: 'conditional',
              condition: {
                type: 'simple',
                operator: 'gte',
                dataKey: '$total',
                value: 10,
              },
              then: 'high',
              else: 'low',
            },
          },
        ]),
        end,
      ],
      edges: [seq('start', 's1'), seq('s1', 'c1'), seq('c1', 'end')],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'numeric-input',
              props: { dataKey: 'score', label: 'Score' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).not.toContain('unknown-compute-output-reference');
  });

  it('unknown-compute-output-reference: $$ inputs never trigger this code (unavailable-reference instead)', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeCompute('c1', [
          {
            outputKey: 'total',
            formula: { type: 'sum', inputs: ['$$notwritten.score'] },
          },
        ]),
        end,
      ],
      edges: [seq('start', 'c1'), seq('c1', 'end')],
      screens: [],
    };
    const errorCodes = codes(flow);
    expect(errorCodes).not.toContain('unknown-compute-output-reference');
    expect(errorCodes).toContain('unavailable-reference');
  });

  it('unknown-compute-output-reference: $out.subpath into a prior output → no error (first segment checked)', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          {
            outputKey: 'stats',
            formula: { type: 'sum', inputs: ['$$q.score'] },
          },
          {
            outputKey: 'derived',
            formula: { type: 'sum', inputs: ['$stats.nested'] },
          },
        ]),
        end,
      ],
      edges: [seq('start', 's1'), seq('s1', 'c1'), seq('c1', 'end')],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'numeric-input',
              props: { dataKey: 'score', label: 'Score' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).not.toContain('unknown-compute-output-reference');
  });

  it('adds compute outputs to the available set for downstream nodes', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          {
            outputKey: 'total',
            formula: { type: 'sum', inputs: ['$$q.score'] },
          },
        ]),
        makeScreen('s2', 'result'),
        end,
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'c1'),
        seq('c1', 's2'),
        seq('s2', 'end'),
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'numeric-input',
              props: { dataKey: 'score', label: 'Score' },
            },
          ],
        },
        {
          slug: 'result',
          components: [
            {
              componentFamily: 'content',
              template: 'rich-text',
              props: { content: 'Your score: {{$$c1.total}}' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toEqual([]);
  });

  it('passes when a branch condition references a compute (score) output via $$', () => {
    // The score-variable pattern: sum Likert items in a compute node, then
    // branch on the resulting $$computeId.outputKey — no new node type needed.
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('score', [
          {
            outputKey: 'total',
            formula: { type: 'sum', inputs: ['$$q.a', '$$q.b', '$$q.c'] },
          },
        ]),
        {
          id: 'branch-score',
          type: 'branch' as const,
          props: {
            name: 'Score branch',
            branches: [
              {
                id: 'high',
                name: 'High',
                config: {
                  type: 'simple',
                  operator: 'gte',
                  dataKey: '$$score.total',
                  value: 10,
                },
              },
            ],
          },
        },
        makeScreen('s-high', 'high-screen'),
        makeScreen('s-default', 'default-screen'),
        end,
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'score'),
        seq('score', 'branch-score'),
        {
          type: 'branch-condition',
          from: 'branch-score.high',
          to: 's-high',
        },
        { type: 'branch-default', from: 'branch-score', to: 's-default' },
        seq('s-high', 'end'),
        seq('s-default', 'end'),
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'numeric-input',
              props: { dataKey: 'a', label: 'A' },
            },
            {
              componentFamily: 'response',
              template: 'numeric-input',
              props: { dataKey: 'b', label: 'B' },
            },
            {
              componentFamily: 'response',
              template: 'numeric-input',
              props: { dataKey: 'c', label: 'C' },
            },
          ],
        },
        { slug: 'high-screen', components: [] },
        { slug: 'default-screen', components: [] },
      ],
    };
    expect(codes(flow)).toEqual([]);
  });

  it('reports unavailable-reference when a branch condition references a compute output that was never declared', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('score', [
          {
            outputKey: 'total',
            formula: { type: 'sum', inputs: ['$$q.a'] },
          },
        ]),
        {
          id: 'branch-score',
          type: 'branch' as const,
          props: {
            name: 'Score branch',
            branches: [
              {
                id: 'high',
                name: 'High',
                config: {
                  type: 'simple',
                  operator: 'gte',
                  // typo: "totall" was never declared as an output key
                  dataKey: '$$score.totall',
                  value: 10,
                },
              },
            ],
          },
        },
        makeScreen('s-high', 'high-screen'),
        end,
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'score'),
        seq('score', 'branch-score'),
        {
          type: 'branch-condition',
          from: 'branch-score.high',
          to: 's-high',
        },
        { type: 'branch-default', from: 'branch-score', to: 's-high' },
        seq('s-high', 'end'),
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'numeric-input',
              props: { dataKey: 'a', label: 'A' },
            },
          ],
        },
        { slug: 'high-screen', components: [] },
      ],
    };
    expect(codes(flow)).toContain('unavailable-reference');
  });

  it('reports duplicate-lookup-key when a lookup table has two entries with the same when value', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          {
            outputKey: 'level',
            formula: {
              type: 'lookup',
              input: '$$q.score',
              table: [
                { when: 5, then: 'mild' },
                { when: 5, then: 'moderate' },
              ],
            },
          },
        ]),
        end,
      ],
      edges: [seq('start', 's1'), seq('s1', 'c1'), seq('c1', 'end')],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'numeric-input',
              props: { dataKey: 'score', label: 'Score' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('duplicate-lookup-key');
  });

  it('scopes compute outputs under path id when inside a path', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        { id: 'path-a', type: 'path' as const, props: { name: 'A' } },
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          {
            outputKey: 'total',
            formula: { type: 'sum', inputs: ['$$path-a.q.score'] },
          },
        ]),
        makeScreen('s2', 'result'),
        end,
      ],
      edges: [
        seq('start', 'path-a'),
        { type: 'path-contains', from: 'path-a', to: 's1', order: 0 },
        { type: 'path-contains', from: 'path-a', to: 'c1', order: 1 },
        seq('path-a', 's2'),
        seq('s2', 'end'),
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'numeric-input',
              props: { dataKey: 'score', label: 'Score' },
            },
          ],
        },
        {
          slug: 'result',
          components: [
            {
              componentFamily: 'content',
              template: 'rich-text',
              props: { content: '{{$$path-a.c1.total}}' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toEqual([]);
  });

  it('reports duplicate-lookup-key when when values are equal after numeric coercion (5 vs "5")', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          {
            outputKey: 'level',
            formula: {
              type: 'lookup',
              input: '$$q.score',
              table: [
                { when: 5, then: 'mild' },
                { when: '5' as any, then: 'duplicate' },
              ],
            },
          },
        ]),
        end,
      ],
      edges: [seq('start', 's1'), seq('s1', 'c1'), seq('c1', 'end')],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'numeric-input',
              props: { dataKey: 'score', label: 'Score' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('duplicate-lookup-key');
  });

  it('reports duplicate-output-key when two computations share the same outputKey', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          { outputKey: 'total', formula: { type: 'sum', inputs: ['$$q.a'] } },
          { outputKey: 'total', formula: { type: 'sum', inputs: ['$$q.b'] } },
        ]),
        end,
      ],
      edges: [seq('start', 's1'), seq('s1', 'c1'), seq('c1', 'end')],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'numeric-input',
              props: { dataKey: 'a', label: 'A' },
            },
            {
              componentFamily: 'response',
              template: 'numeric-input',
              props: { dataKey: 'b', label: 'B' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('duplicate-output-key');
  });
});

describe('compute node — sample formula validation', () => {
  it('passes with a static inline pool', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeCompute('c1', [
          {
            outputKey: 'selected',
            formula: { type: 'sample', input: ['a', 'b', 'c'], n: 2 },
          },
        ]),
        makeScreen('s1', 'end'),
        end,
      ],
      edges: [seq('start', 'c1'), seq('c1', 's1'), seq('s1', 'end')],
      screens: [{ slug: 'end', components: [] }],
    };
    expect(validateExperiment(flow)).toEqual([]);
  });

  it('passes when $$ input is available from a prior screen', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          {
            outputKey: 'selected',
            formula: { type: 'sample', input: '$$q.pool', n: 3 },
          },
        ]),
        makeScreen('s2', 'end'),
        end,
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'c1'),
        seq('c1', 's2'),
        seq('s2', 'end'),
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'pool', label: 'Pool' },
            },
          ],
        },
        { slug: 'end', components: [] },
      ],
    };
    expect(codes(flow)).toEqual([]);
  });

  it('reports unavailable-reference when $$ input is not yet written', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeCompute('c1', [
          {
            outputKey: 'selected',
            formula: { type: 'sample', input: '$$q.pool', n: 3 },
          },
        ]),
        makeScreen('s1', 'end'),
      ],
      edges: [seq('start', 'c1'), seq('c1', 's1')],
      screens: [{ slug: 'end', components: [] }],
    };
    expect(codes(flow)).toContain('unavailable-reference');
  });

  it('reports invalid-sample-size when n is zero or negative', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeCompute('c1', [
          {
            outputKey: 'selectedA',
            formula: { type: 'sample', input: ['a', 'b', 'c'], n: 0 },
          },
          {
            outputKey: 'selectedB',
            formula: { type: 'sample', input: ['a', 'b', 'c'], n: -1 },
          },
        ]),
        makeScreen('s1', 'end'),
      ],
      edges: [seq('start', 'c1'), seq('c1', 's1')],
      screens: [{ slug: 'end', components: [] }],
    };
    expect(codes(flow)).toContain('invalid-sample-size');
  });

  it('reports invalid-sample-size when n is not an integer', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeCompute('c1', [
          {
            outputKey: 'selected',
            formula: { type: 'sample', input: ['a', 'b', 'c'], n: 1.5 },
          },
        ]),
        makeScreen('s1', 'end'),
      ],
      edges: [seq('start', 'c1'), seq('c1', 's1')],
      screens: [{ slug: 'end', components: [] }],
    };
    expect(codes(flow)).toContain('invalid-sample-size');
  });
});

describe('compute node — split formula validation', () => {
  it('passes with a static inline list (size mode)', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeCompute('c1', [
          {
            outputKey: 'bins',
            formula: { type: 'split', input: ['a', 'b', 'c'], mode: 'size', n: 2 } as any,
          },
        ]),
        makeScreen('s1', 'end'),
        end,
      ],
      edges: [seq('start', 'c1'), seq('c1', 's1'), seq('s1', 'end')],
      screens: [{ slug: 'end', components: [] }],
    };
    expect(codes(flow)).toEqual([]);
  });

  it('reports invalid-split-size when size is zero or negative', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeCompute('c1', [
          {
            outputKey: 'binsA',
            formula: { type: 'split', input: ['a', 'b', 'c'], mode: 'size', n: 0 } as any,
          },
          {
            outputKey: 'binsB',
            formula: { type: 'split', input: ['a', 'b', 'c'], mode: 'into', n: -2 } as any,
          },
        ]),
        makeScreen('s1', 'end'),
      ],
      edges: [seq('start', 'c1'), seq('c1', 's1')],
      screens: [{ slug: 'end', components: [] }],
    };
    expect(codes(flow)).toContain('invalid-split-size');
  });

  it('reports invalid-split-size when into is not an integer', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeCompute('c1', [
          {
            outputKey: 'bins',
            formula: { type: 'split', input: ['a', 'b', 'c'], mode: 'into', n: 1.5 } as any,
          },
        ]),
        makeScreen('s1', 'end'),
      ],
      edges: [seq('start', 'c1'), seq('c1', 's1')],
      screens: [{ slug: 'end', components: [] }],
    };
    expect(codes(flow)).toContain('invalid-split-size');
  });

  it('reports split-bins-exceed-items when into exceeds an inline list length', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeCompute('c1', [
          {
            outputKey: 'bins',
            formula: { type: 'split', input: ['a', 'b'], mode: 'into', n: 3 } as any,
          },
        ]),
        makeScreen('s1', 'end'),
      ],
      edges: [seq('start', 'c1'), seq('c1', 's1')],
      screens: [{ slug: 'end', components: [] }],
    };
    expect(codes(flow)).toContain('split-bins-exceed-items');
  });

  it('does not report split-bins-exceed-items for a dynamic reference', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'q'),
        makeCompute('c1', [
          {
            outputKey: 'bins',
            formula: { type: 'split', input: '$$q.items', mode: 'into', n: 50 } as any,
          },
        ]),
        makeScreen('s2', 'end'),
      ],
      edges: [
        seq('start', 's1'),
        seq('s1', 'c1'),
        seq('c1', 's2'),
        seq('s2', 'end'),
      ],
      screens: [
        {
          slug: 'q',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'items', label: 'Items' },
            },
          ],
        },
        { slug: 'end', components: [] },
      ],
    };
    expect(codes(flow)).not.toContain('split-bins-exceed-items');
  });

  it('reports unavailable-reference when $$ input is not yet written', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeCompute('c1', [
          {
            outputKey: 'bins',
            formula: { type: 'split', input: '$$q.items', mode: 'size', n: 2 } as any,
          },
        ]),
        makeScreen('s1', 'end'),
      ],
      edges: [seq('start', 'c1'), seq('c1', 's1')],
      screens: [{ slug: 'end', components: [] }],
    };
    expect(codes(flow)).toContain('unavailable-reference');
  });
});

describe('compute node — loop-aggregate formula validation', () => {
  const loopNode = {
    id: 'trial-loop',
    type: 'loop' as const,
    props: { type: 'static' as const, values: ['a', 'b'] },
  };

  function makePickCompute(loopId: string) {
    return makeCompute('c1', [
      {
        outputKey: 'score',
        formula: {
          type: 'loop-aggregate',
          loopId,
          op: 'count',
          where: {
            type: 'simple',
            operator: 'eq',
            dataKey: `@${loopId}.trial.answer`,
            value: `@${loopId}.value.correct`,
          },
        },
      },
    ]);
  }

  it('passes when loopId resolves to a loop node', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s-pick', 'pick'),
        loopNode,
        makeScreen('s-trial', 'trial'),
        makePickCompute('trial-loop'),
        makeScreen('s-end', 'end'),
        end,
      ],
      edges: [
        seq('start', 's-pick'),
        seq('s-pick', 'trial-loop'),
        { type: 'loop-template', from: 'trial-loop', to: 's-trial' },
        seq('trial-loop', 'c1'),
        seq('c1', 's-end'),
        seq('s-end', 'end'),
      ],
      screens: [
        {
          slug: 'pick',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'items', label: 'Items' },
            },
          ],
        },
        { slug: 'trial', components: [] },
        { slug: 'end', components: [] },
      ],
    };
    expect(codes(flow)).toEqual([]);
  });

  it('reports unknown-node when loopId does not reference a loop node', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s-pick', 'pick'),
        loopNode,
        makeScreen('s-trial', 'trial'),
        makePickCompute('nonexistent-loop'),
        makeScreen('s-end', 'end'),
        end,
      ],
      edges: [
        seq('start', 's-pick'),
        seq('s-pick', 'trial-loop'),
        { type: 'loop-template', from: 'trial-loop', to: 's-trial' },
        seq('trial-loop', 'c1'),
        seq('c1', 's-end'),
        seq('s-end', 'end'),
      ],
      screens: [
        {
          slug: 'pick',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'items', label: 'Items' },
            },
          ],
        },
        { slug: 'trial', components: [] },
        { slug: 'end', components: [] },
      ],
    };
    expect(codes(flow)).toContain('unknown-node');
  });

  it('reports unknown-node when loopId references a non-loop node', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s-pick', 'pick'),
        loopNode,
        makeScreen('s-trial', 'trial'),
        makePickCompute('s-pick'),
        makeScreen('s-end', 'end'),
        end,
      ],
      edges: [
        seq('start', 's-pick'),
        seq('s-pick', 'trial-loop'),
        { type: 'loop-template', from: 'trial-loop', to: 's-trial' },
        seq('trial-loop', 'c1'),
        seq('c1', 's-end'),
        seq('s-end', 'end'),
      ],
      screens: [
        {
          slug: 'pick',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'items', label: 'Items' },
            },
          ],
        },
        { slug: 'trial', components: [] },
        { slug: 'end', components: [] },
      ],
    };
    expect(codes(flow)).toContain('unknown-node');
  });

  it('reports invalid-reference when loop-aggregate @ refs target another loop', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s-pick', 'pick'),
        loopNode,
        makeScreen('s-trial', 'trial'),
        makeCompute('c1', [
          {
            outputKey: 'score',
            formula: {
              type: 'loop-aggregate',
              loopId: 'trial-loop',
              op: 'count',
              where: {
                type: 'simple',
                operator: 'eq',
                dataKey: '@other-loop.trial.answer',
                value: '@trial-loop.value.correct',
              },
            },
          },
        ]),
        makeScreen('s-end', 'end'),
        end,
      ],
      edges: [
        seq('start', 's-pick'),
        seq('s-pick', 'trial-loop'),
        { type: 'loop-template', from: 'trial-loop', to: 's-trial' },
        seq('trial-loop', 'c1'),
        seq('c1', 's-end'),
        seq('s-end', 'end'),
      ],
      screens: [
        {
          slug: 'pick',
          components: [
            {
              componentFamily: 'response',
              template: 'text-input',
              props: { dataKey: 'items', label: 'Items' },
            },
          ],
        },
        { slug: 'trial', components: [] },
        { slug: 'end', components: [] },
      ],
    };
    expect(codes(flow)).toContain('invalid-reference');
  });
});

describe('compute node — collect-loop formula validation', () => {
  const loopNode = {
    id: 'q-loop',
    type: 'loop' as const,
    props: { type: 'static' as const, values: ['a', 'b'] },
  };

  function makeCollectCompute(loopId: string) {
    return makeCompute('c1', [
      {
        outputKey: 'ans',
        formula: { type: 'collect-loop', loopId, screen: 'trial' } as any,
      },
    ]);
  }

  function flowWith(loopId: string): ExperimentFlow {
    return {
      nodes: [
        start,
        loopNode,
        makeScreen('s-trial', 'trial'),
        makeCollectCompute(loopId),
        makeScreen('s-end', 'end'),
        end,
      ],
      edges: [
        seq('start', 'q-loop'),
        { type: 'loop-template', from: 'q-loop', to: 's-trial' },
        seq('q-loop', 'c1'),
        seq('c1', 's-end'),
        seq('s-end', 'end'),
      ],
      screens: [
        { slug: 'trial', components: [] },
        { slug: 'end', components: [] },
      ],
    };
  }

  it('passes when loopId resolves to a loop node', () => {
    expect(codes(flowWith('q-loop'))).toEqual([]);
  });

  it('reports unknown-node when loopId does not reference a loop node', () => {
    expect(codes(flowWith('nope'))).toContain('unknown-node');
  });
});

describe('cyclic-flow', () => {
  it('reports cyclic-flow when two screens form a sequential cycle', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'pg1'), makeScreen('s2', 'pg2'), end],
      edges: [
        seq('start', 's1'),
        seq('s1', 's2'),
        seq('s2', 's1'),
      ],
      screens: [
        { slug: 'pg1', components: [] },
        { slug: 'pg2', components: [] },
      ],
    };
    expect(codes(flow)).toContain('cyclic-flow');
  });

  it('does not report cyclic-flow for a valid linear flow', () => {
    expect(codes(minimalFlow)).not.toContain('cyclic-flow');
  });
});

describe('unreachable-node', () => {
  it('reports unreachable-node for a screen with no incoming edges', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('s1', 'pg1'),
        makeScreen('orphan', 'pg2'),
        end,
      ],
      edges: [seq('start', 's1'), seq('s1', 'end')],
      screens: [
        { slug: 'pg1', components: [] },
        { slug: 'pg2', components: [] },
      ],
    };
    expect(codes(flow)).toContain('unreachable-node');
  });

  it('does not report unreachable-node for a valid flow', () => {
    expect(codes(minimalFlow)).not.toContain('unreachable-node');
  });
});

describe('button payload reference checks', () => {
  it('does not report unavailable-reference when a branch condition uses a $$ key written by a button payload', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('first'),
        {
          id: 'branch',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'more',
                name: 'More',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$first.answer',
                  value: 'yes',
                },
              },
            ],
          },
        },
        makeScreen('extra'),
        end,
      ],
      edges: [
        seq('start', 'first'),
        seq('first', 'branch'),
        { type: 'branch-condition', from: 'branch.more', to: 'extra' },
        { type: 'branch-default', from: 'branch', to: 'end' },
        seq('extra', 'end'),
      ],
      screens: [
        {
          slug: 'first',
          components: [
            {
              componentFamily: 'layout',
              template: 'button',
              props: { text: 'Yes', payload: { dataKey: 'answer', value: 'yes' } },
            },
            {
              componentFamily: 'layout',
              template: 'button',
              props: { text: 'No', payload: { dataKey: 'answer', value: 'no' } },
            },
          ],
        },
        { slug: 'extra', components: [] },
      ],
    };
    expect(codes(flow)).not.toContain('unavailable-reference');
  });

  it('reports unavailable-reference when a branch condition uses a $$ key that no button on the screen provides', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('first'),
        {
          id: 'branch',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'more',
                name: 'More',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$first.missing-key',
                  value: 'yes',
                },
              },
            ],
          },
        },
        end,
      ],
      edges: [
        seq('start', 'first'),
        seq('first', 'branch'),
        { type: 'branch-default', from: 'branch', to: 'end' },
      ],
      screens: [
        {
          slug: 'first',
          components: [
            {
              componentFamily: 'layout',
              template: 'button',
              props: { text: 'Yes', payload: { dataKey: 'answer', value: 'yes' } },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('unavailable-reference');
  });

  it('button without payload does not contribute any key to the available set', () => {
    const flow: ExperimentFlow = {
      nodes: [
        start,
        makeScreen('first'),
        {
          id: 'branch',
          type: 'branch',
          props: {
            name: 'B',
            branches: [
              {
                id: 'more',
                name: 'More',
                config: {
                  type: 'simple',
                  operator: 'eq',
                  dataKey: '$$first.answer',
                  value: 'yes',
                },
              },
            ],
          },
        },
        end,
      ],
      edges: [
        seq('start', 'first'),
        seq('first', 'branch'),
        { type: 'branch-default', from: 'branch', to: 'end' },
      ],
      screens: [
        {
          slug: 'first',
          components: [
            {
              componentFamily: 'layout',
              template: 'button',
              props: { text: 'Continue' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('unavailable-reference');
  });
});

describe('severity', () => {
  it('assigns severity warning to unreferenced-screen', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'pg'), end],
      edges: [seq('start', 's1'), seq('s1', 'end')],
      screens: [
        { slug: 'pg', components: [] },
        { slug: 'unused', components: [] },
      ],
    };
    const errors = validateExperiment(flow);
    const unreferenced = errors.find((e) => e.code === 'unreferenced-screen');
    expect(unreferenced?.severity).toBe('warning');
  });

  it('leaves severity undefined (error) for structural errors', () => {
    const errors = validateExperiment({
      nodes: [end],
      edges: [],
      screens: [],
    });
    const structural = errors.find((e) => e.code === 'missing-start');
    expect(structural?.severity).toBeUndefined();
  });
});

describe('loop itemKey', () => {
  function loopFlow(
    props: Extract<
      ExperimentFlow['nodes'][number],
      { type: 'loop' }
    >['props'],
  ): ExperimentFlow {
    return {
      nodes: [
        start,
        { id: 'loop', type: 'loop', props },
        makeScreen('item', 'item'),
        end,
      ],
      edges: [
        seq('start', 'loop'),
        { type: 'loop-template', from: 'loop', to: 'item' },
        seq('loop', 'end'),
      ],
      screens: [{ slug: 'item', components: [] }],
    };
  }

  it('flags a static loop whose object value is missing the itemKey property', () => {
    const flow = loopFlow({
      type: 'static',
      values: [{ id: 'cat' }, { label: 'no-id-here' }],
      itemKey: 'id',
    });
    expect(codes(flow)).toContain('loop-item-key-missing');
  });

  it('flags a static loop whose itemKey property value is null or undefined', () => {
    // Present-but-nullish values fall back to the index at runtime, so they are
    // flagged the same as a fully missing property.
    expect(
      codes(
        loopFlow({
          type: 'static',
          values: [{ id: 'cat' }, { id: null }],
          itemKey: 'id',
        }),
      ),
    ).toContain('loop-item-key-missing');
    expect(
      codes(
        loopFlow({
          type: 'static',
          values: [{ id: undefined }],
          itemKey: 'id',
        }),
      ),
    ).toContain('loop-item-key-missing');
  });

  it('does not flag a static loop where every object has the itemKey property', () => {
    const flow = loopFlow({
      type: 'static',
      values: [{ id: 'cat' }, { id: 'dog' }],
      itemKey: 'id',
    });
    expect(codes(flow)).not.toContain('loop-item-key-missing');
  });

  it('does not flag string values when itemKey is set (no-op for strings)', () => {
    const flow = loopFlow({
      type: 'static',
      values: ['red', 'blue'],
      itemKey: 'id',
    });
    expect(codes(flow)).not.toContain('loop-item-key-missing');
  });

  it('does not flag object loops without an itemKey', () => {
    const flow = loopFlow({
      type: 'static',
      values: [{ label: 'a' }, { label: 'b' }],
    });
    expect(codes(flow)).not.toContain('loop-item-key-missing');
  });
});

describe('randomized for-each validation', () => {
  function flowWithForeach(props: Record<string, unknown>): ExperimentFlow {
    return {
      nodes: [start, makeScreen('s1', 'test'), end],
      edges: [seq('start', 's1'), seq('s1', 'end')],
      screens: [
        {
          slug: 'test',
          components: [
            {
              componentFamily: 'control',
              template: 'for-each',
              props: {
                id: 'items',
                component: {
                  componentFamily: 'content',
                  template: 'rich-text',
                  props: { content: '{{#items.value}}' },
                },
                ...props,
              },
            },
          ],
        },
      ],
    } as ExperimentFlow;
  }

  it('flags randomized:true on a $-prefixed dynamic for-each', () => {
    const flow = flowWithForeach({
      type: 'dynamic',
      dataKey: '$liveValues',
      randomized: true,
    });
    expect(codes(flow)).toContain('invalid-randomized-foreach');
    expect(categories(flow)).toContain('component');
  });

  it('allows randomized:true on a $$-prefixed dynamic for-each', () => {
    const flow = flowWithForeach({
      type: 'dynamic',
      dataKey: '$$items',
      randomized: true,
    });
    expect(codes(flow)).not.toContain('invalid-randomized-foreach');
  });

  it('allows randomized:true on @ and # prefixed dynamic for-each', () => {
    expect(
      codes(
        flowWithForeach({
          type: 'dynamic',
          dataKey: '@loopId',
          randomized: true,
        }),
      ),
    ).not.toContain('invalid-randomized-foreach');
    expect(
      codes(
        flowWithForeach({
          type: 'dynamic',
          dataKey: '#outerForeach',
          randomized: true,
        }),
      ),
    ).not.toContain('invalid-randomized-foreach');
  });

  it('allows randomized:true on a static for-each', () => {
    const flow = flowWithForeach({
      type: 'static',
      values: ['a', 'b'],
      randomized: true,
    });
    expect(codes(flow)).not.toContain('invalid-randomized-foreach');
  });

  it('does not flag a $-prefixed dynamic for-each that is not randomized', () => {
    const flow = flowWithForeach({
      type: 'dynamic',
      dataKey: '$liveValues',
    });
    expect(codes(flow)).not.toContain('invalid-randomized-foreach');
  });
});

describe('dictionary (i18n) references', () => {
  function flowWithDict(
    dictionary: ExperimentFlow['dictionary'],
    content: string,
    extra: Partial<ExperimentFlow> = {},
  ): ExperimentFlow {
    return {
      nodes: [start, makeScreen('s1', 'welcome'), end],
      edges: [seq('start', 's1'), seq('s1', 'end')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'content',
              template: 'rich-text',
              props: { content },
            },
          ],
        },
      ],
      dictionary,
      ...extra,
    };
  }

  it('accepts a [[key]] that exists in all locales', () => {
    const flow = flowWithDict(
      { en: { greeting: 'Hello' }, es: { greeting: 'Hola' } },
      '[[greeting]]',
      { defaultLocale: 'en' },
    );
    expect(codes(flow)).not.toContain('unknown-dictionary-key');
    expect(codes(flow)).not.toContain('dictionary-locale-mismatch');
  });

  it('flags a [[key]] absent from every locale', () => {
    const flow = flowWithDict(
      { en: { greeting: 'Hello' }, es: { greeting: 'Hola' } },
      '[[missing]]',
      { defaultLocale: 'en' },
    );
    expect(codes(flow)).toContain('unknown-dictionary-key');
  });

  it('flags a [[key]] when the experiment has no dictionary at all', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome'), end],
      edges: [seq('start', 's1'), seq('s1', 'end')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'content',
              template: 'rich-text',
              props: { content: '[[greeting]]' },
            },
          ],
        },
      ],
    };
    expect(codes(flow)).toContain('unknown-dictionary-key');
  });

  it('flags a key present in one locale but missing in another (parity)', () => {
    const flow = flowWithDict(
      { en: { greeting: 'Hello', footer: 'Bye' }, es: { greeting: 'Hola' } },
      '[[greeting]]',
      { defaultLocale: 'en' },
    );
    const found = validateExperiment(flow).find(
      (e) => e.code === 'dictionary-locale-mismatch',
    );
    expect(found).toBeDefined();
    expect(found?.message).toContain('footer');
    expect(found?.message).toContain('es');
  });

  it('does not flag parity when all locales share the same keys', () => {
    const flow = flowWithDict(
      { en: { a: '1', b: '2' }, es: { a: '1', b: '2' } },
      '[[a]] [[b]]',
      { defaultLocale: 'en' },
    );
    expect(codes(flow)).not.toContain('dictionary-locale-mismatch');
  });

  it('flags an unknown [[key]] referenced in a shared option label', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome'), end],
      edges: [seq('start', 's1'), seq('s1', 'end')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'radio',
              props: { label: 'Q', dataKey: 'q', options: '%scale' },
            },
          ],
        },
      ],
      options: { scale: [{ label: '[[opt.unknown]]', value: 'a' }] },
      dictionary: { en: { other: 'x' }, es: { other: 'y' } },
      defaultLocale: 'en',
    };
    expect(codes(flow)).toContain('unknown-dictionary-key');
  });

  it('accepts a [[key]] in a shared option label defined in all locales', () => {
    const flow: ExperimentFlow = {
      nodes: [start, makeScreen('s1', 'welcome'), end],
      edges: [seq('start', 's1'), seq('s1', 'end')],
      screens: [
        {
          slug: 'welcome',
          components: [
            {
              componentFamily: 'response',
              template: 'radio',
              props: { label: 'Q', dataKey: 'q', options: '%scale' },
            },
          ],
        },
      ],
      options: { scale: [{ label: '[[opt.yes]]', value: 'a' }] },
      dictionary: {
        en: { opt: { yes: 'Yes' } },
        es: { opt: { yes: 'Sí' } },
      },
      defaultLocale: 'en',
    };
    expect(codes(flow)).not.toContain('unknown-dictionary-key');
  });

  it('flags a defaultLocale that is not a key of the dictionary', () => {
    const flow = flowWithDict(
      { en: { greeting: 'Hello' }, es: { greeting: 'Hola' } },
      '[[greeting]]',
      { defaultLocale: 'fr' },
    );
    expect(codes(flow)).toContain('unknown-default-locale');
  });

  it('detects [[key]] references nested in dictionary messages', () => {
    const flow = flowWithDict(
      { en: { intro: 'Hi [[absent]]' }, es: { intro: 'Hola [[absent]]' } },
      '[[intro]]',
      { defaultLocale: 'en' },
    );
    expect(codes(flow)).toContain('unknown-dictionary-key');
  });

  it('emits no dictionary errors for an experiment without dictionary or [[ ]] refs', () => {
    expect(codes(minimalFlow)).not.toContain('unknown-dictionary-key');
    expect(codes(minimalFlow)).not.toContain('dictionary-locale-mismatch');
    expect(codes(minimalFlow)).not.toContain('unknown-default-locale');
  });

  it('accepts a nested-tree dictionary referenced by dotted key', () => {
    const flow = flowWithDict(
      {
        en: { welcome: { title: 'Hello' } },
        es: { welcome: { title: 'Hola' } },
      },
      '[[welcome.title]]',
      { defaultLocale: 'en' },
    );
    expect(codes(flow)).not.toContain('unknown-dictionary-key');
    expect(codes(flow)).not.toContain('dictionary-locale-mismatch');
  });

  it('flags an unknown dotted key against a nested-tree dictionary', () => {
    const flow = flowWithDict(
      {
        en: { welcome: { title: 'Hello' } },
        es: { welcome: { title: 'Hola' } },
      },
      '[[welcome.subtitle]]',
      { defaultLocale: 'en' },
    );
    expect(codes(flow)).toContain('unknown-dictionary-key');
  });

  it('flags a collision between a flat dotted key and a nested path', () => {
    const flow = flowWithDict(
      {
        en: { 'welcome.title': 'Flat', welcome: { title: 'Nested' } },
        es: { 'welcome.title': 'Plano', welcome: { title: 'Anidado' } },
      },
      '[[welcome.title]]',
      { defaultLocale: 'en' },
    );
    const found = validateExperiment(flow).find(
      (e) => e.code === 'dictionary-key-collision',
    );
    expect(found).toBeDefined();
    expect(found?.message).toContain('welcome.title');
    expect(found?.message).toContain('en');
  });

  it('does not flag collision for distinct nested and flat keys', () => {
    const flow = flowWithDict(
      {
        en: { welcome: { title: 'Hi' }, 'survey.cta': 'Go' },
        es: { welcome: { title: 'Hola' }, 'survey.cta': 'Ir' },
      },
      '[[welcome.title]] [[survey.cta]]',
      { defaultLocale: 'en' },
    );
    expect(codes(flow)).not.toContain('dictionary-key-collision');
  });

  it('detects parity gaps across nested trees (dotted key missing in a locale)', () => {
    const flow = flowWithDict(
      {
        en: { welcome: { title: 'Hello', footer: 'Bye' } },
        es: { welcome: { title: 'Hola' } },
      },
      '[[welcome.title]]',
      { defaultLocale: 'en' },
    );
    const found = validateExperiment(flow).find(
      (e) => e.code === 'dictionary-locale-mismatch',
    );
    expect(found?.message).toContain('welcome.footer');
  });

  it('accepts a dynamic [[ ]] key when the family exists in all locales', () => {
    const flow = flowWithDict(
      {
        en: { experience: { lsd: 'About LSD', marijuana: 'About weed' } },
        es: { experience: { lsd: 'Sobre LSD', marijuana: 'Sobre la maria' } },
      },
      '[[experience.{{$$screen.drug}}]]',
      { defaultLocale: 'en' },
    );
    expect(codes(flow)).not.toContain('unknown-dictionary-key');
    expect(codes(flow)).not.toContain('dictionary-locale-mismatch');
  });

  it('flags a dynamic [[ ]] key whose static stem matches no defined key', () => {
    const flow = flowWithDict(
      { en: { greeting: 'Hello' }, es: { greeting: 'Hola' } },
      '[[experience.{{$$screen.drug}}]]',
      { defaultLocale: 'en' },
    );
    expect(codes(flow)).toContain('unknown-dictionary-key');
  });

  it('matches a mid-key {{ }} token to a single nested segment only', () => {
    // [[a.{{ }}.b]] must match a.<seg>.b, not a flat a.b nor a.x.y.b
    const ok = flowWithDict(
      { en: { a: { lsd: { b: 'ok' } } }, es: { a: { lsd: { b: 'bien' } } } },
      '[[a.{{$$screen.x}}.b]]',
      { defaultLocale: 'en' },
    );
    expect(codes(ok)).not.toContain('unknown-dictionary-key');

    const bad = flowWithDict(
      { en: { a: { b: 'ok' } }, es: { a: { b: 'bien' } } },
      '[[a.{{$$screen.x}}.b]]',
      { defaultLocale: 'en' },
    );
    expect(codes(bad)).toContain('unknown-dictionary-key');
  });

  it('still reports a per-locale parity gap for a dynamic family', () => {
    // experience.lsd only in en, experience.marijuana only in es: the dynamic
    // family "exists" in the union, but static parity still flags each gap.
    const flow = flowWithDict(
      {
        en: { experience: { lsd: 'About LSD' } },
        es: { experience: { marijuana: 'Sobre la maria' } },
      },
      '[[experience.{{$$screen.drug}}]]',
      { defaultLocale: 'en' },
    );
    expect(codes(flow)).not.toContain('unknown-dictionary-key');
    expect(codes(flow)).toContain('dictionary-locale-mismatch');
  });
});

