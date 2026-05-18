import { useEffect } from 'react';
import type { PancakeClip } from './usePancakeData';

export function useVideoShortcuts(
  videoRef: React.RefObject<HTMLVideoElement>,
  timeline: PancakeClip[],
  fps: number,
  onConstraint: (type: 'IN' | 'OUT' | 'BM' | 'CLEAR' | 'CLEAR_ALL', time: number) => void,
  onOverride: (type: 'KEEP' | 'TRASH' | 'BROLL' | 'CLEAR', time: number) => void,
  isPreviewMode: boolean = false,
  currentTimelineTime: number = 0,
  seekToTimelineTime?: (time: number) => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se l'utente sta digitando in un input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      const frameDuration = 1 / (fps || 25);

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
          if (isPreviewMode && seekToTimelineTime) {
            seekToTimelineTime(Math.max(0, currentTimelineTime - (e.shiftKey ? frameDuration : 10 * frameDuration)));
          } else {
            video.currentTime = Math.max(0, video.currentTime - (e.shiftKey ? frameDuration : 10 * frameDuration));
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (isPreviewMode && seekToTimelineTime) {
            seekToTimelineTime(currentTimelineTime + (e.shiftKey ? frameDuration : 10 * frameDuration));
          } else {
            video.currentTime = Math.min(video.duration, video.currentTime + (e.shiftKey ? frameDuration : 10 * frameDuration));
          }
          break;

        case 'ArrowUp': {
          e.preventDefault();
          if (isPreviewMode) return;
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
          if (isPreviewMode) return;
          const currentTime = video.currentTime;
          const nextClip = timeline.find(c => c.start > currentTime + 0.1);
          if (nextClip) {
            video.currentTime = nextClip.start;
          }
          break;
        }

        case 'KeyI':
          e.preventDefault();
          if (isPreviewMode) return;
          onConstraint('IN', video.currentTime);
          break;

        case 'KeyO':
          e.preventDefault();
          if (isPreviewMode) return;
          onConstraint('OUT', video.currentTime);
          break;

        case 'KeyM':
          e.preventDefault();
          if (isPreviewMode) return;
          onConstraint('BM', video.currentTime);
          break;

        case 'KeyX':
        case 'Backspace':
          e.preventDefault();
          if (isPreviewMode) return;
          if (e.shiftKey) {
            onConstraint('CLEAR_ALL', video.currentTime);
            onOverride('CLEAR', video.currentTime);
          } else {
            onConstraint('CLEAR', video.currentTime);
          }
          break;

        case 'KeyK':
          e.preventDefault();
          if (isPreviewMode) return;
          onOverride('KEEP', video.currentTime);
          break;

        case 'KeyT':
          e.preventDefault();
          if (isPreviewMode) return;
          onOverride('TRASH', video.currentTime);
          break;

        case 'KeyB':
          e.preventDefault();
          if (isPreviewMode) return;
          onOverride('BROLL', video.currentTime);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [videoRef, timeline, fps, onConstraint, onOverride, isPreviewMode, currentTimelineTime, seekToTimelineTime]);
}
