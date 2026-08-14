// Shared fetch wrapper for all backend calls (see apps/backend, docs/backend-service.md).
// Client-side code, so the origin var must be NEXT_PUBLIC_-prefixed to be
// inlined at build time.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';
const REQUEST_TIMEOUT_MS = 5000;

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type ApiFetchOptions = Omit<RequestInit, 'signal'> & {
  // Set true when the endpoint returns a JSON body to parse into T.
  // Defaults to false: most of this API's mutations return no body.
  parseJson?: boolean;
};

export async function apiFetch<T = void>(
  path: string,
  { parseJson = false, ...init }: ApiFetchOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new ApiError(`Request to ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw err;
  }

  if (!response.ok) {
    throw new ApiError(`Request to ${path} failed with status ${response.status}`, response.status);
  }

  return parseJson ? ((await response.json()) as T) : (undefined as T);
}
