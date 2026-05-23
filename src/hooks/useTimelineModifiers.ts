import { useRef, useState, useEffect } from 'react';

type ModifyingState = 'pan' | 'scrub' | null;

export interface UseTimelineModifiersReturn {
  /** Current modifier state: 'pan' = P held, 'scrub' = P+L held, null = neither. */
  isModifying: ModifyingState;
  /** Shared ref of currently pressed modifier keys — consumers may read this to resolve conflicts. */
  keysDownRef: React.MutableRefObject<Set<string>>;
}

/**
 * Shared hook that tracks the P and L "Left-Handed Modifier" keys used for
 * pan and scrub interactions on both timeline modes.
 *
 * P only  → 'pan'  (drag pans the zoom window / scroll container)
 * P + L   → 'scrub' (drag pans AND scrubs video.currentTime)
 *
 * The returned `keysDownRef` is shared with the consumer so DC mode can
 * still use `L` alone for the lock-clip shortcut without conflict.
 */
export function useTimelineModifiers(): UseTimelineModifiersReturn {
  const keysDownRef = useRef<Set<string>>(new Set());
  const [isModifying, setIsModifying] = useState<ModifyingState>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code !== 'KeyP' && e.code !== 'KeyL') return;

      keysDownRef.current.add(e.code);

      if (keysDownRef.current.has('KeyP') && keysDownRef.current.has('KeyL')) {
        setIsModifying('scrub');
      } else if (keysDownRef.current.has('KeyP')) {
        setIsModifying('pan');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'KeyP' && e.code !== 'KeyL') return;

      keysDownRef.current.delete(e.code);

      if (keysDownRef.current.has('KeyP') && keysDownRef.current.has('KeyL')) {
        setIsModifying('scrub');
      } else if (keysDownRef.current.has('KeyP')) {
        setIsModifying('pan');
      } else {
        setIsModifying(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return { isModifying, keysDownRef };
}
