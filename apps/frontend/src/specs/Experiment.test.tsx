import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import Experiment from '../Experiment';
import { useExperimentStore } from '../data/store';
import { ExperimentFlow } from '@experiment-hub/engine/types';

const flowA: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    { id: 'screen-a', type: 'screen', props: { slug: 'screen-a' } },
  ],
  edges: [{ type: 'sequential', from: 'start', to: 'screen-a' }],
  screens: [
    {
      slug: 'screen-a',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: { content: 'Content from experiment A' },
        },
      ],
    },
  ],
};

const flowB: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    { id: 'screen-b', type: 'screen', props: { slug: 'screen-b' } },
  ],
  edges: [{ type: 'sequential', from: 'start', to: 'screen-b' }],
  screens: [
    {
      slug: 'screen-b',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: { content: 'Content from experiment B' },
        },
      ],
    },
  ],
};

describe('Experiment', () => {
  beforeEach(() => {
    useExperimentStore.setState({ step: null, isLoading: false, error: null });
  });

  it('restarts and shows new content when experiment prop changes', async () => {
    const { rerender } = render(<Experiment experiment={flowA} experimentSlug="experiment-a" />);
    await screen.findByText('Content from experiment A');

    rerender(<Experiment experiment={flowB} experimentSlug="experiment-b" />);

    await screen.findByText('Content from experiment B');
    expect(screen.queryByText('Content from experiment A')).not.toBeInTheDocument();
  });

  it('does not restart when the same experiment reference is rerendered', async () => {
    const { rerender } = render(<Experiment experiment={flowA} experimentSlug="experiment-a" />);
    await screen.findByText('Content from experiment A');
    const stepBefore = useExperimentStore.getState().step;

    rerender(<Experiment experiment={flowA} experimentSlug="experiment-a" />);

    await waitFor(() => {
      expect(useExperimentStore.getState().step).toBe(stepBefore);
    });
  });
});
