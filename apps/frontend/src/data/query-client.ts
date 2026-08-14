import { QueryClient } from '@tanstack/react-query';

// Singleton shared by the QueryProvider (component tree) and by non-component
// callers that need to run a mutation outside React (e.g. the Zustand store
// in store.ts). Defaults are conservative for a research app: participant-
// facing requests shouldn't retry indefinitely or refetch on window focus.
export const queryClient = new QueryClient({
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
