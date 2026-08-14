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

describe('TimeInput', () => {
  it('renders a native time input with its label', () => {
    renderScreen([
      {
        componentFamily: 'response',
        template: 'time-input',
        props: { dataKey: 'wake-up', label: 'Wake-up time' },
      },
    ]);
    const input = screen.getByLabelText('Wake-up time');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'time');
  });

  it('collects the entered time on submit', async () => {
    const { onNext } = renderScreen([
      {
        componentFamily: 'response',
        template: 'time-input',
        props: { dataKey: 'wake-up', label: 'Wake-up time', required: true },
      },
      {
        componentFamily: 'layout',
        template: 'button',
        props: { text: 'Submit' },
      },
    ]);

    await userEvent.type(screen.getByLabelText('Wake-up time'), '07:30');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onNext).toHaveBeenCalledWith({ 'wake-up': '07:30' });
  });

  it('blocks submit and shows an error when required and empty', async () => {
    const { onNext } = renderScreen([
      {
        componentFamily: 'response',
        template: 'time-input',
        props: { dataKey: 'wake-up', label: 'Wake-up time', required: true },
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
