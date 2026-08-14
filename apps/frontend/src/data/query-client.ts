import { QueryClient } from '@tanstack/react-query';

// Factory, not a singleton: a module-level instance would be created once on
// the server and shared across every participant's request (Next.js App
// Router evaluates 'use client' modules on the server too). QueryProvider
// calls this per-mount so each request/browser session gets its own cache.
// Defaults are conservative for a research app: participant-facing requests
// shouldn't retry indefinitely or refetch on window focus.
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 1,
      },
    },
  });
}
