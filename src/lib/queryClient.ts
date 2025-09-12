import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes - more aggressive caching
      gcTime: 5 * 60 * 1000, // 5 minutes for better memory management
      retry: (failureCount, error: any) => {
        // Don't retry network-related errors on mobile
        if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('NetworkError')) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: true, // Enable for dashboard data freshness
      refetchOnMount: false, // Prevent unnecessary refetches
      refetchOnReconnect: true, // Refetch when network reconnects
      networkMode: 'always', // Continue working in poor network conditions
    },
    mutations: {
      retry: 1,
      networkMode: 'always',
    },
  },
});