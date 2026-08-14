import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Screen } from '../Screen';
import { FrameworkScreen } from '@experiment-hub/engine/screen';

function renderScreen(
  components: FrameworkScreen['components'],
  onNext = vi.fn().mockResolvedValue(undefined),
) {
  render(
    <Screen
      screen={{ slug: 'test', components }}
      isLoading={false}
      onNext={onNext}
      context={{}}
    />,
  );
  return { onNext };
}

describe('RangeSlider', () => {
  it('renders the label and two thumbs bounded by min/max', () => {
    renderScreen([
      {
        componentFamily: 'response',
        template: 'range-slider',
        props: { dataKey: 'range', label: 'Pick a range', min: 0, max: 50 },
      },
    ]);
    expect(screen.getByText('Pick a range')).toBeInTheDocument();
    const thumbs = screen.getAllByRole('slider');
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0]).toHaveAttribute('aria-valuemin', '0');
    expect(thumbs[0]).toHaveAttribute('aria-valuemax', '50');
  });

  it('renders minLabel and maxLabel when provided', () => {
    renderScreen([
      {
        componentFamily: 'response',
        template: 'range-slider',
        props: {
          dataKey: 'range',
          label: 'Range',
          minLabel: 'Low',
          maxLabel: 'High',
        },
      },
    ]);
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('does not block submit and sends null when optional and untouched', async () => {
    const { onNext } = renderScreen([
      {
        componentFamily: 'response',
        template: 'range-slider',
        props: { dataKey: 'range', label: 'Range', required: false },
      },
      {
        componentFamily: 'layout',
        template: 'button',
        props: { text: 'Submit' },
      },
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).toHaveBeenCalledWith({ range: null });
  });

  it('blocks submit and shows an error when required and untouched', async () => {
    const { onNext } = renderScreen([
      {
        componentFamily: 'response',
        template: 'range-slider',
        props: { dataKey: 'range', label: 'Range', required: true },
      },
      {
        componentFamily: 'layout',
        template: 'button',
        props: { text: 'Submit' },
      },
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).not.toHaveBeenCalled();
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('applies a configured defaultValue tuple as the initial thumb positions', () => {
    renderScreen([
      {
        componentFamily: 'response',
        template: 'range-slider',
        props: {
          dataKey: 'range',
          label: 'Range',
          min: 0,
          max: 100,
          defaultValue: [20, 80],
        },
      },
    ]);
    const thumbs = screen.getAllByRole('slider');
    expect(thumbs[0]).toHaveAttribute('aria-valuenow', '20');
    expect(thumbs[1]).toHaveAttribute('aria-valuenow', '80');
  });
});
