import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from '../ThemeToggle';

const setTheme = vi.fn();
let resolvedTheme: string | undefined = 'light';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme, setTheme }),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    setTheme.mockClear();
    resolvedTheme = 'light';
  });

  it('offers to switch to dark mode while the light theme is active', () => {
    render(<ThemeToggle />);
    expect(
      screen.getByRole('button', { name: 'Switch to dark mode' }),
    ).toBeInTheDocument();
  });

  it('switches to dark when clicked in light mode', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button'));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('switches to light when clicked in dark mode', async () => {
    resolvedTheme = 'dark';
    render(<ThemeToggle />);
    expect(
      screen.getByRole('button', { name: 'Switch to light mode' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button'));
    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('treats an unresolved theme as dark so the first click enables light mode', async () => {
    resolvedTheme = undefined;
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button'));
    expect(setTheme).toHaveBeenCalledWith('light');
  });
});
