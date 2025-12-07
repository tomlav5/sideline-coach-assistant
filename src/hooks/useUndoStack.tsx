import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface UndoAction {
  id: string;
  type: 'event' | 'substitution' | 'period';
  description: string;
  undo: () => Promise<void>;
  timestamp: number;
}

const UNDO_WINDOW_MS = 30000; // 30 seconds

export function useUndoStack() {
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [isUndoing, setIsUndoing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Get the most recent undoable action
  const currentAction = undoStack[undoStack.length - 1];
  
  // Calculate remaining time in seconds
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Update remaining time
  useEffect(() => {
    if (!currentAction) {
      setRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      const elapsed = Date.now() - currentAction.timestamp;
      const remaining = Math.max(0, Math.ceil((UNDO_WINDOW_MS - elapsed) / 1000));
      setRemainingSeconds(remaining);

      if (remaining === 0) {
        // Remove expired action
        setUndoStack(prev => prev.filter(a => a.id !== currentAction.id));
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);

    return () => clearInterval(interval);
  }, [currentAction]);

  // Add an action to the undo stack
  const pushUndo = useCallback((action: Omit<UndoAction, 'timestamp' | 'id'>) => {
    const newAction: UndoAction = {
      ...action,
      id: `undo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    setUndoStack(prev => [...prev, newAction]);

    // Auto-remove after UNDO_WINDOW_MS
    const timeout = setTimeout(() => {
      setUndoStack(prev => prev.filter(a => a.id !== newAction.id));
    }, UNDO_WINDOW_MS);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = timeout;

    // Show toast notification
    toast.info(`Action recorded: ${action.description}`, {
      description: `You have ${UNDO_WINDOW_MS / 1000} seconds to undo`,
      duration: 3000,
    });

    return newAction.id;
  }, []);

  // Perform undo
  const performUndo = useCallback(async () => {
    if (!currentAction || isUndoing) return;

    setIsUndoing(true);
    
    try {
      await currentAction.undo();
      
      // Remove from stack
      setUndoStack(prev => prev.filter(a => a.id !== currentAction.id));
      
      toast.success('Action undone', {
        description: `Reverted: ${currentAction.description}`,
      });
    } catch (error: any) {
      console.error('Undo failed:', error);
      toast.error('Undo failed', {
        description: error?.message || 'Could not undo the action',
      });
    } finally {
      setIsUndoing(false);
    }
  }, [currentAction, isUndoing]);

  // Clear all undo actions
  const clearUndoStack = useCallback(() => {
    setUndoStack([]);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    canUndo: !!currentAction && !isUndoing,
    isUndoing,
    currentAction,
    remainingSeconds,
    undoCount: undoStack.length,
    
    // Actions
    pushUndo,
    performUndo,
    clearUndoStack,
  };
}
