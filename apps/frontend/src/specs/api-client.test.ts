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

  it('surfaces the backend message from a JSON error body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ message: 'Validation failed', issues: ['field required'] }), {
        status: 400,
      }),
    );

    const error = await apiFetch('/checkpoints', { method: 'POST' }).catch((err) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.message).toBe('Validation failed');
    expect(error.details).toMatchObject({ issues: ['field required'] });
  });

  it('falls back to a status message when the error body is not JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not json', { status: 503 }));

    const error = await apiFetch('/checkpoints', { method: 'POST' }).catch((err) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(503);
    expect(error.message).toMatch(/503/);
    expect(error.details).toBeUndefined();
  });

  it('attaches the original TimeoutError as .cause', async () => {
    const timeoutError = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    vi.mocked(fetch).mockRejectedValue(timeoutError);

    const error = await apiFetch('/checkpoints', { method: 'POST' }).catch((err) => err);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toMatch(/timed out/);
    expect(error.cause).toBe(timeoutError);
  });

  it('propagates a network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'));

    await expect(apiFetch('/checkpoints', { method: 'POST' })).rejects.toThrow('network error');
  });
});
