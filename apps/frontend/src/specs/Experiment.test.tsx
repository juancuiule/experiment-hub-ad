import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    useExperimentStore.setState({ step: null, history: [], isLoading: false, error: null });
  });

  it('restarts and shows new content when experiment prop changes', async () => {
    const { rerender } = render(<Experiment experiment={flowA} />);
    await screen.findByText('Content from experiment A');

    rerender(<Experiment experiment={flowB} />);

    await screen.findByText('Content from experiment B');
    expect(screen.queryByText('Content from experiment A')).not.toBeInTheDocument();
  });

  it('does not restart when the same experiment reference is rerendered', async () => {
    const { rerender } = render(<Experiment experiment={flowA} />);
    await screen.findByText('Content from experiment A');
    const stepBefore = useExperimentStore.getState().step;

    rerender(<Experiment experiment={flowA} />);

    await waitFor(() => {
      expect(useExperimentStore.getState().step).toBe(stepBefore);
    });
  });
});

const flowTwoScreens: ExperimentFlow = {
  nodes: [
    { id: 'start', type: 'start' },
    { id: 'screen-1', type: 'screen', props: { slug: 'one' } },
    { id: 'screen-2', type: 'screen', props: { slug: 'two' } },
  ],
  edges: [
    { type: 'sequential', from: 'start', to: 'screen-1' },
    { type: 'sequential', from: 'screen-1', to: 'screen-2' },
  ],
  screens: [
    {
      slug: 'one',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: { content: 'Screen one' },
        },
        { componentFamily: 'layout', template: 'button', props: {} },
      ],
    },
    {
      slug: 'two',
      components: [
        {
          componentFamily: 'content',
          template: 'rich-text',
          props: { content: 'Screen two' },
        },
      ],
    },
  ],
};

describe('Experiment: back navigation', () => {
  beforeEach(() => {
    useExperimentStore.setState({ step: null, history: [], isLoading: false, error: null });
  });

  it('hides the Back button on the first screen', async () => {
    render(<Experiment experiment={flowTwoScreens} />);
    await screen.findByText('Screen one');
    expect(screen.queryByText('← Back')).not.toBeInTheDocument();
  });

  it('shows Back after advancing, and returns to the previous screen on click', async () => {
    render(<Experiment experiment={flowTwoScreens} />);
    await screen.findByText('Screen one');

    fireEvent.click(screen.getByText('Continue'));
    await screen.findByText('Screen two');
    expect(screen.getByText('← Back')).toBeInTheDocument();

    fireEvent.click(screen.getByText('← Back'));
    await screen.findByText('Screen one');
    expect(screen.queryByText('← Back')).not.toBeInTheDocument();
  });
});
