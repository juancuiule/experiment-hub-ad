import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Screen } from '../Screen';
import { FrameworkScreen } from '@experiment-hub/engine/screen';

function renderScreen(
  components: FrameworkScreen['components'],
  context = {},
  onNext = vi.fn().mockResolvedValue(undefined),
) {
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

describe('TextArea', () => {
  it('renders a textarea with its label', () => {
    renderScreen([
      {
        componentFamily: 'response',
        template: 'text-area',
        props: { dataKey: 'feedback', label: 'Your feedback' },
      },
    ]);
    expect(screen.getByLabelText('Your feedback').tagName).toBe('TEXTAREA');
  });

  it('defaults to 4 rows when lines is not set', () => {
    renderScreen([
      {
        componentFamily: 'response',
        template: 'text-area',
        props: { dataKey: 'feedback', label: 'Feedback' },
      },
    ]);
    expect(screen.getByLabelText('Feedback')).toHaveAttribute('rows', '4');
  });

  it('respects a custom lines prop for the rows attribute', () => {
    renderScreen([
      {
        componentFamily: 'response',
        template: 'text-area',
        props: { dataKey: 'feedback', label: 'Feedback', lines: 8 },
      },
    ]);
    expect(screen.getByLabelText('Feedback')).toHaveAttribute('rows', '8');
  });

  it('resolves $$ references in the placeholder', () => {
    renderScreen(
      [
        {
          componentFamily: 'response',
          template: 'text-area',
          props: {
            dataKey: 'feedback',
            label: 'Feedback',
            placeholder: "Tell us about {{$$user.name}}'s experience",
          },
        },
      ],
      { data: { user: { name: 'Juan' } } },
    );
    expect(
      screen.getByPlaceholderText("Tell us about Juan's experience"),
    ).toBeInTheDocument();
  });

  it('collects the entered text on submit', async () => {
    const { onNext } = renderScreen([
      {
        componentFamily: 'response',
        template: 'text-area',
        props: { dataKey: 'feedback', label: 'Feedback', required: true },
      },
      {
        componentFamily: 'layout',
        template: 'button',
        props: { text: 'Submit' },
      },
    ]);

    await userEvent.type(screen.getByLabelText('Feedback'), 'Great study');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).toHaveBeenCalledWith({ feedback: 'Great study' });
  });

  it('blocks submit and shows an error when required and empty', async () => {
    const { onNext } = renderScreen([
      {
        componentFamily: 'response',
        template: 'text-area',
        props: { dataKey: 'feedback', label: 'Feedback', required: true },
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

  it('does not block submit for optional text-area left empty', async () => {
    const { onNext } = renderScreen([
      {
        componentFamily: 'response',
        template: 'text-area',
        props: { dataKey: 'feedback', label: 'Feedback', required: false },
      },
      {
        componentFamily: 'layout',
        template: 'button',
        props: { text: 'Submit' },
      },
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).toHaveBeenCalled();
  });
});
