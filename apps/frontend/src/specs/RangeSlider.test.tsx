import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Screen } from '../Screen';
import { FrameworkScreen } from '@experiment-hub/engine/screen';

function renderScreen(
  components: FrameworkScreen['components'],
  onNext = vi.fn().mockResolvedValue(undefined),
) {
  const { container } = render(
    <Screen
      screen={{ slug: 'test', components }}
      isLoading={false}
      onNext={onNext}
      context={{}}
    />,
  );
  return { onNext, container };
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

  it('submits the tuple the participant selected', async () => {
    const { onNext } = renderScreen([
      {
        componentFamily: 'response',
        template: 'range-slider',
        props: {
          dataKey: 'range',
          label: 'Range',
          min: 0,
          max: 10,
          defaultValue: [2, 8],
          required: true,
        },
      },
      {
        componentFamily: 'layout',
        template: 'button',
        props: { text: 'Submit' },
      },
    ]);

    screen.getAllByRole('slider')[0].focus();
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).toHaveBeenCalledWith({ range: [3, 8] });
  });

  it('reveals the range read-out only after an interaction when showValue is set', async () => {
    renderScreen([
      {
        componentFamily: 'response',
        template: 'range-slider',
        props: {
          dataKey: 'range',
          label: 'Range',
          min: 0,
          max: 10,
          defaultValue: [2, 8],
          showValue: true,
        },
      },
    ]);

    expect(screen.queryByText('2 – 8')).not.toBeInTheDocument();

    screen.getAllByRole('slider')[1].focus();
    await userEvent.keyboard('{ArrowLeft}');

    expect(screen.getByText('2 – 7')).toBeInTheDocument();
  });

  it('renders one tooltip per thumb, formatted with prefix and suffix', async () => {
    renderScreen([
      {
        componentFamily: 'response',
        template: 'range-slider',
        props: {
          dataKey: 'range',
          label: 'Range',
          min: 0,
          max: 10,
          defaultValue: [2, 8],
          tooltip: { prefix: '$', suffix: 'k' },
        },
      },
    ]);

    expect(screen.queryByText('$2k')).not.toBeInTheDocument();

    screen.getAllByRole('slider')[0].focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(screen.getByText('$3k')).toBeInTheDocument();
    expect(screen.getByText('$8k')).toBeInTheDocument();
  });

  it('renders bare tooltip values when tooltip is true', async () => {
    renderScreen([
      {
        componentFamily: 'response',
        template: 'range-slider',
        props: {
          dataKey: 'range',
          label: 'Range',
          min: 0,
          max: 10,
          defaultValue: [2, 8],
          tooltip: true,
        },
      },
    ]);

    screen.getAllByRole('slider')[0].focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('flags the focused thumb so only its tooltip is shown, and clears it on blur', () => {
    const { container } = renderScreen([
      {
        componentFamily: 'response',
        template: 'range-slider',
        props: { dataKey: 'range', label: 'Range', tooltip: true },
      },
    ]);
    const track = container.querySelector('[data-slider]')!;
    const thumbs = screen.getAllByRole('slider');

    thumbs[0].focus();
    expect(track).toHaveAttribute('data-active-thumb', '0');

    thumbs[1].focus();
    expect(track).toHaveAttribute('data-active-thumb', '1');

    thumbs[1].blur();
    expect(track).not.toHaveAttribute('data-active-thumb');
  });
});
