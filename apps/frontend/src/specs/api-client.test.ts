import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from '@/src/data/api-client';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves without parsing a body by default', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 201 }));

    await expect(apiFetch('/checkpoints', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('parses JSON when parseJson is requested', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: 'abc' }), { status: 200 }),
    );

    await expect(apiFetch('/things/abc', { parseJson: true })).resolves.toEqual({ id: 'abc' });
  });

  it('throws an ApiError carrying the status on a non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));

    const error = await apiFetch('/checkpoints', { method: 'POST' }).catch((err) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
    expect(error.message).toMatch(/500/);
  });

  it('propagates a network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'));

    await expect(apiFetch('/checkpoints', { method: 'POST' })).rejects.toThrow('network error');
  });
});
