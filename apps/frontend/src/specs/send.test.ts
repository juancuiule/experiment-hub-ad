import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { send } from '@/src/data/send';

const baseSubmission = {
  experimentSlug: 'ocean',
  sessionId: 'session-1',
  checkpointName: 'intro-complete',
  context: { data: { a: 1 } },
};

describe('send', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the checkpoint payload to the backend checkpoints endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 201 }));

    await send(baseSubmission);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/checkpoints$/);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual(baseSubmission);
  });

  it('throws when the backend responds with a non-ok status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));

    await expect(send(baseSubmission)).rejects.toThrow(/500/);
  });

  it('propagates a network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'));

    await expect(send(baseSubmission)).rejects.toThrow('network error');
  });
});
