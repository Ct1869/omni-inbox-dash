import { useEffect } from 'react';

interface KeyboardShortcutsHandlers {
  onCompose?: () => void;
  onRefresh?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

export const useKeyboardShortcuts = (handlers: KeyboardShortcutsHandlers) => {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'c':
          handlers.onCompose?.();
          break;
        case 'r':
          handlers.onRefresh?.();
          break;
        case 'j':
          handlers.onNext?.();
          break;
        case 'k':
          handlers.onPrevious?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handlers]);
};
