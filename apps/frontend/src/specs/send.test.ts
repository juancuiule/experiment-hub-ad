import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { send } from '@/src/data/send';

function jsonResponse(status: number) {
  return new Response(null, { status });
}

describe('send', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('POSTs the checkpoint name and context to /api/checkpoints', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(201));
    const context = { data: { a: 1 } };

    await send(context, 'cp1');

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/checkpoints');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ name: 'cp1', context });
  });

  it('resolves without retrying on a successful response', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(201));

    await expect(send({}, 'cp1')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries a failed request and resolves once a retry succeeds', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(500))
      .mockResolvedValueOnce(jsonResponse(201));

    await expect(
      send({}, 'cp1', { retries: 2, retryDelayMs: 0 }),
    ).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(500));

    await expect(
      send({}, 'cp1', { retries: 2, retryDelayMs: 0 }),
    ).rejects.toThrow('Checkpoint POST failed with status 500');
    expect(fetch).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
  });

  it('propagates a network-level rejection after retries are exhausted', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      send({}, 'cp1', { retries: 1, retryDelayMs: 0 }),
    ).rejects.toThrow('Failed to fetch');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
