'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { makeQueryClient } from '@/src/data/query-client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(makeQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
