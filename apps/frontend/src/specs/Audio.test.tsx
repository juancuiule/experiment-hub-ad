import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Screen } from '../Screen';
import { FrameworkScreen } from '@experiment-hub/engine/screen';

function renderScreen(components: FrameworkScreen['components']) {
  render(
    <Screen
      screen={{ slug: 'test', components }}
      isLoading={false}
      onNext={async () => {}}
      context={{}}
    />,
  );
}

describe('Audio', () => {
  it('renders an audio element with the given url', () => {
    renderScreen([
      {
        componentFamily: 'content',
        template: 'audio',
        props: { url: 'https://example.com/clip.mp3' },
      },
    ]);
    const audio = document.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio).toHaveAttribute('src', 'https://example.com/clip.mp3');
  });

  it('defaults controls to true when not specified', () => {
    renderScreen([
      {
        componentFamily: 'content',
        template: 'audio',
        props: { url: 'https://example.com/clip.mp3' },
      },
    ]);
    expect(document.querySelector('audio')).toHaveAttribute('controls', '');
  });

  it('omits controls when explicitly disabled', () => {
    renderScreen([
      {
        componentFamily: 'content',
        template: 'audio',
        props: { url: 'https://example.com/clip.mp3', controls: false },
      },
    ]);
    expect(document.querySelector('audio')).not.toHaveAttribute('controls');
  });

  it('applies autoplay and loop props', () => {
    renderScreen([
      {
        componentFamily: 'content',
        template: 'audio',
        props: {
          url: 'https://example.com/clip.mp3',
          autoplay: true,
          loop: true,
        },
      },
    ]);
    const audio = document.querySelector('audio');
    expect(audio).toHaveAttribute('autoplay', '');
    expect(audio).toHaveAttribute('loop', '');
  });
});
