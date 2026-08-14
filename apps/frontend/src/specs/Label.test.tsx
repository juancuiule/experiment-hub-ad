import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Label } from '../components/Label';

describe('Label', () => {
  it('renders its text inside a label element without wrapping it in a paragraph', () => {
    const { container } = render(<Label htmlFor="age">How old are you?</Label>);

    const label = container.querySelector('label')!;
    expect(label).toHaveAttribute('for', 'age');
    expect(label.textContent).toBe('How old are you?');
    expect(label.querySelector('p')).toBeNull();
  });

  it('renders the allowed inline markdown elements', () => {
    render(<Label>{'A **bold** and an *italic* word'}</Label>);

    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('italic').tagName).toBe('EM');
  });

  it('styles inline code', () => {
    const { container } = render(<Label>{'Type `yes` to continue'}</Label>);

    const code = container.querySelector('code')!;
    expect(code.textContent).toBe('yes');
    expect(code.className).toContain('bg-content-primary/10');
  });

  it('pipes context values into the label text', () => {
    render(<Label context={{ data: { name: 'Ada' } }}>{'Hi {{$$name}}'}</Label>);

    expect(screen.getByText('Hi Ada')).toBeInTheDocument();
  });

  it('leaves tokens unresolved when no context is passed', () => {
    render(<Label>{'Hi {{$$name}}'}</Label>);

    expect(screen.getByText('Hi {{$$name}}')).toBeInTheDocument();
  });

  it('renders a tooltip alongside the label when one is provided', () => {
    render(
      <Label tooltip="Your age in years" htmlFor="age">
        Age
      </Label>,
    );

    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Your age in years')).toBeInTheDocument();
  });

  it('resolves context references inside the tooltip too', () => {
    render(
      <Label context={{ data: { unit: 'years' } }} tooltip={'In {{$$unit}}'}>
        Age
      </Label>,
    );

    expect(screen.getByText('In years')).toBeInTheDocument();
  });

  it('renders no tooltip markup when the tooltip prop is absent', () => {
    const { container } = render(<Label>Age</Label>);

    expect(container.querySelector('svg')).toBeNull();
  });
});
