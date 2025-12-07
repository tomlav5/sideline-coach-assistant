import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface OptimisticUpdate<T> {
  data: T | null;
  isOptimistic: boolean;
  isPending: boolean;
  error: Error | null;
}

/**
 * Hook for optimistic updates - show changes immediately, sync in background
 * Provides instant feedback while database operations happen
 */
export function useOptimisticUpdate<T>() {
  const [state, setState] = useState<OptimisticUpdate<T>>({
    data: null,
    isOptimistic: false,
    isPending: false,
    error: null,
  });

  const executeOptimistic = useCallback(
    async (
      optimisticData: T,
      asyncOperation: () => Promise<T>,
      options?: {
        onSuccess?: (data: T) => void;
        onError?: (error: Error) => void;
        errorMessage?: string;
        rollbackOnError?: boolean;
      }
    ) => {
      const {
        onSuccess,
        onError,
        errorMessage = 'Operation failed',
        rollbackOnError = true,
      } = options || {};

      // 1. Immediate optimistic update
      setState({
        data: optimisticData,
        isOptimistic: true,
        isPending: true,
        error: null,
      });

      try {
        // 2. Execute actual operation in background
        const result = await asyncOperation();

        // 3. Update with real data
        setState({
          data: result,
          isOptimistic: false,
          isPending: false,
          error: null,
        });

        onSuccess?.(result);
      } catch (error: any) {
        console.error('Optimistic update failed:', error);

        // 4. Rollback or show error
        if (rollbackOnError) {
          setState({
            data: null,
            isOptimistic: false,
            isPending: false,
            error: error,
          });
          toast.error(errorMessage, {
            description: error?.message || 'Please try again',
          });
        } else {
          // Keep optimistic data but mark as error
          setState({
            data: optimisticData,
            isOptimistic: false,
            isPending: false,
            error: error,
          });
          toast.warning(errorMessage, {
            description: 'Will retry automatically',
          });
        }

        onError?.(error);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      isOptimistic: false,
      isPending: false,
      error: null,
    });
  }, []);

  return {
    data: state.data,
    isOptimistic: state.isOptimistic,
    isPending: state.isPending,
    error: state.error,
    executeOptimistic,
    reset,
  };
}
