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

describe('DateInput', () => {
  it('renders a native date input with its label', () => {
    renderScreen([
      {
        componentFamily: 'response',
        template: 'date-input',
        props: { dataKey: 'birthday', label: 'Your birthday' },
      },
    ]);
    const input = screen.getByLabelText('Your birthday');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'date');
  });

  it('collects the entered date on submit', async () => {
    const { onNext } = renderScreen([
      {
        componentFamily: 'response',
        template: 'date-input',
        props: { dataKey: 'birthday', label: 'Birthday', required: true },
      },
      {
        componentFamily: 'layout',
        template: 'button',
        props: { text: 'Submit' },
      },
    ]);

    await userEvent.type(screen.getByLabelText('Birthday'), '2020-01-15');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).toHaveBeenCalledWith({ birthday: '2020-01-15' });
  });

  it('blocks submit and shows an error when required and empty', async () => {
    const { onNext } = renderScreen([
      {
        componentFamily: 'response',
        template: 'date-input',
        props: { dataKey: 'birthday', label: 'Birthday', required: true },
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
});
