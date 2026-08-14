'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { queryClient } from '@/src/data/query-client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
