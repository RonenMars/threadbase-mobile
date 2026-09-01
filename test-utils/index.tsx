import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DirectionRoot } from '@/lib/direction-root'

export function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <DirectionRoot>{children}</DirectionRoot>
    </QueryClientProvider>
  )
}
