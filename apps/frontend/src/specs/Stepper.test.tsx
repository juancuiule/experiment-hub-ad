import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Stepper from '../components/Stepper';

describe('Stepper', () => {
  it('interpolates {index} as a 1-based position and {total}', () => {
    render(
      <Stepper
        config={{ style: 'continuous', label: 'Step {index} of {total}' }}
        step={0}
        total={4}
      />,
    );
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
  });

  it('renders no label when the config omits one', () => {
    const { container } = render(
      <Stepper config={{ style: 'continuous' }} step={1} total={3} />,
    );
    expect(container.querySelector('p')).toBeNull();
  });

  it('sizes the continuous bar to the completed fraction', () => {
    const { container } = render(
      <Stepper config={{ style: 'continuous' }} step={1} total={4} />,
    );
    const bar = container.querySelector('.bg-content-active') as HTMLElement;
    expect(bar.style.width).toBe('50%');
  });

  it('fills the continuous bar on the last step', () => {
    const { container } = render(
      <Stepper config={{ style: 'continuous' }} step={3} total={4} />,
    );
    const bar = container.querySelector('.bg-content-active') as HTMLElement;
    expect(bar.style.width).toBe('100%');
  });

  it('renders one dash per step and marks the completed ones as active', () => {
    const { container } = render(
      <Stepper config={{ style: 'dashed' }} step={1} total={3} />,
    );
    const dashes = Array.from(container.querySelectorAll('.flex-1'));
    expect(dashes).toHaveLength(3);
    expect(dashes[0].className).toContain('bg-content-active');
    expect(dashes[1].className).toContain('bg-content-active');
    expect(dashes[2].className).toContain('bg-foreground');
  });
});
