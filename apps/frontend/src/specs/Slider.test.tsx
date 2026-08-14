import { FrameworkScreen } from '@experiment-hub/engine/screen';
import { Context } from '@experiment-hub/engine/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Screen } from '../Screen';

function renderScreen(
  components: FrameworkScreen['components'],
  context: Context = {},
) {
  const onNext = vi.fn().mockResolvedValue(undefined);
  const { container } = render(
    <Screen
      screen={{ slug: 'test', components }}
      isLoading={false}
      onNext={onNext}
      context={context}
    />,
  );
  return { onNext, container };
}

const slider = (props: Record<string, unknown>) =>
  ({
    componentFamily: 'response',
    template: 'slider',
    props: { dataKey: 'rating', label: 'Rate it', ...props },
  }) as const;

const submit = {
  componentFamily: 'layout',
  template: 'button',
  props: { text: 'Submit' },
} as const;

/** Radix moves the thumb one step per arrow key press. */
async function nudgeRight(times = 1) {
  const thumb = screen.getByRole('slider');
  thumb.focus();
  for (let i = 0; i < times; i++) {
    await userEvent.keyboard('{ArrowRight}');
  }
}

describe('Slider', () => {
  it('bounds the thumb by min, max and step', () => {
    renderScreen([slider({ min: 1, max: 7, step: 2 })]);

    const thumb = screen.getByRole('slider');
    expect(thumb).toHaveAttribute('aria-valuemin', '1');
    expect(thumb).toHaveAttribute('aria-valuemax', '7');
    expect(thumb).toHaveAttribute('aria-valuenow', '1');
  });

  it('renders minLabel and maxLabel with context values piped in', () => {
    renderScreen([slider({ minLabel: 'Not at all', maxLabel: 'Very {{$$who}}' })], {
      data: { who: 'much' },
    });

    expect(screen.getByText('Not at all')).toBeInTheDocument();
    expect(screen.getByText('Very much')).toBeInTheDocument();
  });

  it('hides the thumb until the participant interacts', () => {
    const { container } = renderScreen([slider({})]);

    expect(container.querySelector('.opacity-0')).not.toBeNull();
  });

  it('shows a muted thumb at a configured defaultValue', () => {
    const { container } = renderScreen([slider({ min: 0, max: 10, defaultValue: 4 })]);

    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '4');
    expect(container.querySelector('.opacity-0')).toBeNull();
    expect(container.querySelector('.bg-content-secondary\\/60')).not.toBeNull();
  });

  it('sends null when optional and untouched', async () => {
    const { onNext } = renderScreen([slider({ required: false }), submit]);

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).toHaveBeenCalledWith({ rating: null });
  });

  it('blocks submit and shows an error when required and untouched', async () => {
    const { onNext } = renderScreen([slider({ required: true }), submit]);

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).not.toHaveBeenCalled();
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('submits the value the participant selected', async () => {
    const { onNext } = renderScreen([
      slider({ min: 0, max: 10, step: 1, required: true }),
      submit,
    ]);

    await nudgeRight(3);
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '3');
    expect(onNext).toHaveBeenCalledWith({ rating: 3 });
  });

  it('reveals the numeric read-out only after an interaction when showValue is set', async () => {
    renderScreen([slider({ min: 0, max: 10, showValue: true })]);

    expect(screen.queryByText('2')).not.toBeInTheDocument();

    await nudgeRight(2);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders a bare tooltip value when tooltip is true', async () => {
    renderScreen([slider({ min: 0, max: 10, tooltip: true })]);

    expect(screen.queryByText('1')).not.toBeInTheDocument();

    await nudgeRight();

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('wraps the tooltip value in the configured prefix and suffix', async () => {
    renderScreen([
      slider({ min: 0, max: 10, tooltip: { prefix: '$', suffix: ' USD' } }),
    ]);

    await nudgeRight(2);

    expect(screen.getByText('$2 USD')).toBeInTheDocument();
  });
});
