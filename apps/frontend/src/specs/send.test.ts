import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { send, sendCheckpoint, useSendCheckpointMutation } from '@/src/data/send';

const baseSubmission = {
  experimentSlug: 'ocean',
  sessionId: 'session-1',
  checkpointName: 'intro-complete',
  context: { data: { a: 1 } },
};

describe('sendCheckpoint / send', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POSTs the checkpoint payload to the backend checkpoints endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 201 }));

    await sendCheckpoint(baseSubmission);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/checkpoints$/);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual(baseSubmission);
  });

  it('throws when the backend responds with a non-ok status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));

    await expect(sendCheckpoint(baseSubmission)).rejects.toThrow(/500/);
  });

  it('propagates a network failure', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'));

    await expect(sendCheckpoint(baseSubmission)).rejects.toThrow('network error');
  });

  it('send is an alias for sendCheckpoint, for non-component callers like the store', () => {
    expect(send).toBe(sendCheckpoint);
  });
});

describe('useSendCheckpointMutation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  it('drives loading/success state around the checkpoint POST', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 201 }));

    const { result } = renderHook(() => useSendCheckpointMutation(), { wrapper });

    result.current.mutate(baseSubmission);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed POST as mutation error state', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));

    const { result } = renderHook(() => useSendCheckpointMutation(), { wrapper });

    result.current.mutate(baseSubmission);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/500/);
  });
});
