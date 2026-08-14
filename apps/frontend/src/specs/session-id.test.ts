import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('getSessionId', () => {
  beforeEach(() => {
    vi.resetModules();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a stable id across repeated calls in the same module instance', async () => {
    const { getSessionId } = await import('@/src/data/session-id');
    const first = getSessionId();
    const second = getSessionId();
    expect(first).toBe(second);
  });

  it('reuses the id across separate module instances via sessionStorage (survives StrictMode double-invoke)', async () => {
    const { getSessionId: getSessionIdA } = await import('@/src/data/session-id');
    const first = getSessionIdA();

    vi.resetModules();
    const { getSessionId: getSessionIdB } = await import('@/src/data/session-id');
    const second = getSessionIdB();

    expect(second).toBe(first);
  });

  it('falls back to crypto.getRandomValues when randomUUID is unavailable (non-secure context)', async () => {
    const originalCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', {
      getRandomValues: originalCrypto.getRandomValues.bind(originalCrypto),
    });

    const { getSessionId } = await import('@/src/data/session-id');
    const id = getSessionId();

    expect(id).toMatch(UUID_RE);
  });

  it('falls back to Math.random when the Web Crypto API is entirely unavailable', async () => {
    vi.stubGlobal('crypto', undefined);

    const { getSessionId } = await import('@/src/data/session-id');
    const id = getSessionId();

    expect(id).toMatch(UUID_RE);
  });

  it('does not throw when sessionStorage access fails and still returns a usable id', async () => {
    const originalSessionStorage = globalThis.sessionStorage;
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('storage disabled');
      },
      setItem: () => {
        throw new Error('storage disabled');
      },
    });

    const { getSessionId } = await import('@/src/data/session-id');
    expect(() => getSessionId()).not.toThrow();
    expect(getSessionId()).toMatch(UUID_RE);

    vi.stubGlobal('sessionStorage', originalSessionStorage);
  });
});
