import { useEffect, useCallback } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

/**
 * Hook for keyboard shortcuts during live match tracking
 * Provides quick access to common actions
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger if user is typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const matchedShortcut = shortcuts.find(shortcut => {
        const keyMatches = shortcut.key.toLowerCase() === event.key.toLowerCase();
        const ctrlMatches = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatches = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatches = shortcut.alt ? event.altKey : !event.altKey;

        return keyMatches && ctrlMatches && shiftMatches && altMatches;
      });

      if (matchedShortcut) {
        event.preventDefault();
        matchedShortcut.action();
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);

  return { shortcuts };
}

/**
 * Pre-defined shortcuts for match tracking
 */
export function useMatchTrackerShortcuts(actions: {
  onRecordGoal?: () => void;
  onSubstitution?: () => void;
  onOtherEvent?: () => void;
  onUndo?: () => void;
  onStartPeriod?: () => void;
  onPausePeriod?: () => void;
}) {
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'g',
      action: () => actions.onRecordGoal?.(),
      description: 'Record goal',
    },
    {
      key: 's',
      action: () => actions.onSubstitution?.(),
      description: 'Make substitution',
    },
    {
      key: 'e',
      action: () => actions.onOtherEvent?.(),
      description: 'Record other event',
    },
    {
      key: 'z',
      ctrl: true,
      action: () => actions.onUndo?.(),
      description: 'Undo last action',
    },
    {
      key: ' ',
      action: () => {
        if (actions.onStartPeriod) {
          actions.onStartPeriod();
        } else if (actions.onPausePeriod) {
          actions.onPausePeriod();
        }
      },
      description: 'Start/Pause period',
    },
  ];

  return useKeyboardShortcuts(shortcuts);
}
