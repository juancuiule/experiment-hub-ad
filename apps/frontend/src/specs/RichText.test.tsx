import { Context } from '@experiment-hub/engine/types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RichText } from '../components/content/RichText';

function renderRichText(content: string, context: Context = {}) {
  return render(
    <RichText
      component={{
        componentFamily: 'content',
        template: 'rich-text',
        props: { content },
      }}
      context={context}
    />,
  );
}

describe('RichText', () => {
  it('renders markdown headings at their matching level', () => {
    renderRichText('# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five');

    expect(screen.getByRole('heading', { level: 1, name: 'One' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Two' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Three' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Four' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 5, name: 'Five' })).toBeInTheDocument();
  });

  it('renders paragraphs, emphasis and links', () => {
    renderRichText('A **bold** word and a [link](https://example.com).');

    expect(screen.getByText('bold').tagName).toBe('STRONG');
    const link = screen.getByRole('link', { name: 'link' });
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('renders bulleted and numbered lists', () => {
    const { container } = renderRichText('- one\n- two\n\n1. first\n2. second');

    expect(container.querySelector('ul')).not.toBeNull();
    expect(container.querySelector('ol')).not.toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('renders blockquotes, inline code and code blocks', () => {
    const { container } = renderRichText(
      '> quoted\n\nInline `code` here.\n\n```\nblock\n```',
    );

    expect(container.querySelector('blockquote')).not.toBeNull();
    expect(screen.getByText('code').tagName).toBe('CODE');
    expect(container.querySelector('pre > code')).not.toBeNull();
  });

  it('pipes answers from context into the content', () => {
    renderRichText('Hello {{$$name}}, you are {{$$age}}.', {
      data: { name: 'Ada', age: 36 },
    });

    expect(screen.getByText('Hello Ada, you are 36.')).toBeInTheDocument();
  });

  it('leaves unresolvable tokens untouched', () => {
    renderRichText('Hello {{$$name}}');
    expect(screen.getByText('Hello {{$$name}}')).toBeInTheDocument();
  });
});
