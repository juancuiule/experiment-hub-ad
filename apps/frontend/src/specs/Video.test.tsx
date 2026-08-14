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

describe('Video', () => {
  it('renders a video element with the given url', () => {
    renderScreen([
      {
        componentFamily: 'content',
        template: 'video',
        props: { url: 'https://example.com/clip.mp4' },
      },
    ]);
    const video = document.querySelector('video');
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute('src', 'https://example.com/clip.mp4');
  });

  it('does not render controls unless explicitly enabled', () => {
    renderScreen([
      {
        componentFamily: 'content',
        template: 'video',
        props: { url: 'https://example.com/clip.mp4' },
      },
    ]);
    expect(document.querySelector('video')).not.toHaveAttribute('controls');
  });

  it('applies controls, autoplay, muted and loop props', () => {
    renderScreen([
      {
        componentFamily: 'content',
        template: 'video',
        props: {
          url: 'https://example.com/clip.mp4',
          controls: true,
          autoplay: true,
          muted: true,
          loop: true,
        },
      },
    ]);
    const video = document.querySelector('video');
    expect(video).toHaveAttribute('controls', '');
    expect(video).toHaveAttribute('autoplay', '');
    expect(video).toHaveProperty('muted', true);
    expect(video).toHaveAttribute('loop', '');
  });
});
