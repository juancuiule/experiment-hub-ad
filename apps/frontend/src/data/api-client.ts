// Shared fetch wrapper for all backend calls (see apps/backend, docs/backend-service.md).
// Client-side code, so the origin var must be NEXT_PUBLIC_-prefixed to be
// inlined at build time.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
const REQUEST_TIMEOUT_MS = 5000;

export class ApiError extends Error {
  readonly status?: number;
  readonly details?: unknown;

  constructor(message: string, status?: number, options?: { cause?: unknown; details?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = 'ApiError';
    this.status = status;
    this.details = options?.details;
  }
}

export type ApiFetchOptions = Omit<RequestInit, 'signal'> & {
  parseJson?: boolean;
};

// Overload: parseJson: true — returns the parsed response body as T.
export async function apiFetch<T>(
  path: string,
  options: Omit<ApiFetchOptions, 'parseJson'> & { parseJson: true },
): Promise<T>;
// Overload: no parseJson (or parseJson: false) — returns void.
export async function apiFetch(
  path: string,
  options?: Omit<ApiFetchOptions, 'parseJson'> & { parseJson?: false },
): Promise<void>;
export async function apiFetch<T>(
  path: string,
  { parseJson = false, ...init }: ApiFetchOptions = {},
): Promise<T | void> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new ApiError(
        `Request to ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`,
        undefined,
        { cause: err },
      );
    }
    throw err;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : `Request to ${path} failed with status ${response.status}`;
    throw new ApiError(message, response.status, { details: body ?? undefined });
  }

  return parseJson ? ((await response.json()) as T) : undefined;
}
