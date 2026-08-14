import { FrameworkScreen } from '@experiment-hub/engine/screen';
import { Context } from '@experiment-hub/engine/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Screen } from '../Screen';

// Rendered through Screen so the button gets the real react-hook-form
// instance it writes payloads into.
function renderScreen(
  components: FrameworkScreen['components'],
  { isLoading = false, context = {} }: { isLoading?: boolean; context?: Context } = {},
) {
  const onNext = vi.fn().mockResolvedValue(undefined);
  render(
    <Screen
      screen={{ slug: 'test', components }}
      isLoading={isLoading}
      onNext={onNext}
      context={context}
    />,
  );
  return { onNext };
}

const button = (props: Record<string, unknown> = {}) =>
  ({ componentFamily: 'layout', template: 'button', props }) as const;

describe('Button', () => {
  it('falls back to "Continue" when no text is configured', () => {
    renderScreen([button()]);
    expect(screen.getByRole('button')).toHaveTextContent('Continue');
  });

  it('pipes context values into the button text', () => {
    renderScreen([button({ text: 'Next, {{$$name}}' })], {
      context: { data: { name: 'Ada' } },
    });
    expect(screen.getByRole('button')).toHaveTextContent('Next, Ada');
  });

  it('is disabled and shows a placeholder label while loading', () => {
    renderScreen([button({ text: 'Continue' })], { isLoading: true });
    const submit = screen.getByRole('button');
    expect(submit).toBeDisabled();
    expect(submit).toHaveTextContent('…');
  });

  it('is disabled when the component is configured as disabled', () => {
    renderScreen([button({ text: 'Continue', disabled: true })]);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('submits the screen when clicked', async () => {
    const { onNext } = renderScreen([button()]);
    await userEvent.click(screen.getByRole('button'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('writes its payload into the submitted form data', async () => {
    const { onNext } = renderScreen([
      button({ text: 'Yes', payload: { dataKey: 'choice', value: 'yes' } }),
    ]);

    await userEvent.click(screen.getByRole('button'));

    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ choice: 'yes' }));
  });

  it('records which of several buttons was pressed', async () => {
    const { onNext } = renderScreen([
      button({ text: 'Yes', payload: { dataKey: 'choice', value: 'yes' } }),
      button({ text: 'No', payload: { dataKey: 'choice', value: 'no' } }),
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'No' }));

    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ choice: 'no' }));
  });

  it('resolves context references inside a string payload value', async () => {
    const { onNext } = renderScreen(
      [button({ text: 'Confirm', payload: { dataKey: 'echo', value: '{{$$name}}' } })],
      { context: { data: { name: 'Ada' } } },
    );

    await userEvent.click(screen.getByRole('button'));

    expect(onNext).toHaveBeenCalledWith(expect.objectContaining({ echo: 'Ada' }));
  });

  it('adds bottom spacing only when alignBottom is set', () => {
    const { container } = render(
      <Screen
        screen={{ slug: 'test', components: [button({ alignBottom: true })] }}
        isLoading={false}
        onNext={vi.fn()}
        context={{}}
      />,
    );
    expect(container.querySelector('.mt-auto')).not.toBeNull();
  });
});
