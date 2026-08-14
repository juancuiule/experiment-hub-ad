import { ValidationError } from '@experiment-hub/engine/experiment-validation';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ValidationErrors } from '../ValidationErrors';

const edgeError: ValidationError = {
  code: 'EDGE_DANGLING_TARGET',
  category: 'edge',
  message: 'Edge e1 points at a node that does not exist',
};

describe('ValidationErrors', () => {
  it('renders one card per error with its code, message and category', () => {
    render(
      <ValidationErrors
        errors={[
          edgeError,
          {
            code: 'SCREEN_MISSING',
            category: 'screen',
            message: 'Screen intro is not defined',
          },
        ]}
      />,
    );

    expect(screen.getByText('Validation Errors')).toBeInTheDocument();
    expect(screen.getByText('EDGE_DANGLING_TARGET')).toBeInTheDocument();
    expect(
      screen.getByText('Edge e1 points at a node that does not exist'),
    ).toBeInTheDocument();
    expect(screen.getByText('SCREEN_MISSING')).toBeInTheDocument();
    expect(screen.getByText('edge')).toBeInTheDocument();
    expect(screen.getByText('screen')).toBeInTheDocument();
  });

  it('renders nothing but the heading for an empty error list', () => {
    render(<ValidationErrors errors={[]} />);
    expect(screen.getByText('Validation Errors')).toBeInTheDocument();
    expect(screen.queryByText('edge')).not.toBeInTheDocument();
  });

  it('shows a node-type badge when it differs from the category', () => {
    render(
      <ValidationErrors
        errors={[{ ...edgeError, nodeType: 'branch', category: 'edge' }]}
      />,
    );
    expect(screen.getByText('branch')).toBeInTheDocument();
    expect(screen.getByText('edge')).toBeInTheDocument();
  });

  it('does not duplicate the badge when node type and category match', () => {
    render(
      <ValidationErrors
        errors={[
          {
            code: 'BRANCH_NO_DEFAULT',
            category: 'branch',
            nodeType: 'branch',
            message: 'Branch b1 has no default edge',
          },
        ]}
      />,
    );
    expect(screen.getAllByText('branch')).toHaveLength(1);
  });

  it('distinguishes warnings from errors by severity styling', () => {
    const { container } = render(
      <ValidationErrors
        errors={[
          { ...edgeError, severity: 'warning' },
          { ...edgeError, code: 'OTHER', severity: 'error' },
        ]}
      />,
    );
    expect(container.querySelector('.text-warning')).not.toBeNull();
    expect(container.querySelector('.text-error')).not.toBeNull();
  });

  it('treats an error with no explicit severity as an error', () => {
    const { container } = render(<ValidationErrors errors={[edgeError]} />);
    expect(container.querySelector('.text-error')).not.toBeNull();
    expect(container.querySelector('.text-warning')).toBeNull();
  });
});
