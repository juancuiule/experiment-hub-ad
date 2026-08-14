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
  render(
    <Screen
      screen={{ slug: 'test', components }}
      isLoading={false}
      onNext={onNext}
      context={context}
    />,
  );
  return { onNext };
}

const numericInput = (props: Record<string, unknown> = {}) =>
  ({
    componentFamily: 'response',
    template: 'numeric-input',
    props: { dataKey: 'age', label: 'Your age', ...props },
  }) as const;

const submit = {
  componentFamily: 'layout',
  template: 'button',
  props: { text: 'Submit' },
} as const;

describe('NumericInput', () => {
  it('associates the label with a number input constrained by min, max and step', () => {
    renderScreen([numericInput({ min: 18, max: 99, step: 1 })]);

    const input = screen.getByLabelText('Your age');
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('id', 'age');
    expect(input).toHaveAttribute('min', '18');
    expect(input).toHaveAttribute('max', '99');
    expect(input).toHaveAttribute('step', '1');
  });

  it('omits the range attributes when they are not configured', () => {
    renderScreen([numericInput()]);

    const input = screen.getByLabelText('Your age');
    expect(input).not.toHaveAttribute('min');
    expect(input).not.toHaveAttribute('max');
    expect(input).not.toHaveAttribute('step');
  });

  it('pipes context values into the placeholder', () => {
    renderScreen([numericInput({ placeholder: 'e.g. {{$$hint}}' })], {
      data: { hint: '42' },
    });

    expect(screen.getByPlaceholderText('e.g. 42')).toBeInTheDocument();
  });

  it('renders no placeholder when none is configured', () => {
    renderScreen([numericInput()]);

    expect(screen.getByLabelText('Your age')).not.toHaveAttribute('placeholder');
  });

  it('submits the entry as a number rather than a string', async () => {
    const { onNext } = renderScreen([numericInput({ required: true }), submit]);

    await userEvent.type(screen.getByLabelText('Your age'), '30');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).toHaveBeenCalledWith({ age: 30 });
  });

  it('blocks submit and shows an error when required and left empty', async () => {
    const { onNext } = renderScreen([numericInput({ required: true }), submit]);

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).not.toHaveBeenCalled();
    expect(await screen.findByText('This field is required')).toBeInTheDocument();
  });

  it('submits null when optional and left empty', async () => {
    const { onNext } = renderScreen([
      numericInput({ required: false }),
      submit,
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).toHaveBeenCalledWith({ age: null });
  });

  it('keeps an out-of-range entry from being submitted', async () => {
    const { onNext } = renderScreen([numericInput({ min: 18 }), submit]);

    const input = screen.getByLabelText('Your age');
    await userEvent.type(input, '5');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    // The `min` attribute makes native constraint validation reject the form
    // before react-hook-form runs, so no zod message is rendered.
    expect(input).toHaveAttribute('min', '18');
    expect(onNext).not.toHaveBeenCalled();
  });

  it('blurs the input on wheel so scrolling never changes the answer', async () => {
    renderScreen([numericInput()]);
    const input = screen.getByLabelText('Your age');

    input.focus();
    expect(input).toHaveFocus();
    await userEvent.type(input, '25');
    input.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));

    expect(input).not.toHaveFocus();
    expect(input).toHaveValue(25);
  });
});
