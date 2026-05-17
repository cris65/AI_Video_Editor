import { useEffect } from 'react';
import type { PancakeClip } from './usePancakeData';

export function useVideoShortcuts(
  videoRef: React.RefObject<HTMLVideoElement>,
  timeline: PancakeClip[]
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se l'utente sta digitando in un input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (video.paused) {
            video.play();
          } else {
            video.pause();
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 2);
          break;

        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(video.duration, video.currentTime + 2);
          break;

        case 'ArrowUp': {
          e.preventDefault();
          // Cerca la prima clip il cui 'start' è minore del currentTime corrente (con un buffer per permettere doppi salti rapidi)
          const currentTime = video.currentTime;
          const prevClip = timeline.slice().reverse().find(c => c.start < currentTime - 0.5);
          if (prevClip) {
            video.currentTime = prevClip.start;
          } else {
            video.currentTime = 0;
          }
          break;
        }

        case 'ArrowDown': {
          e.preventDefault();
          // Cerca la prima clip il cui 'start' è maggiore del currentTime corrente
          const currentTime = video.currentTime;
          const nextClip = timeline.find(c => c.start > currentTime + 0.1);
          if (nextClip) {
            video.currentTime = nextClip.start;
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [videoRef, timeline]);
}
