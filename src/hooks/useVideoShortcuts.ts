import { useEffect } from 'react';
import type { PancakeClip } from './usePancakeData';

export function useVideoShortcuts(
  videoRef: React.RefObject<HTMLVideoElement>,
  timeline: PancakeClip[],
  fps: number,
  onConstraint: (type: 'IN' | 'OUT' | 'BM' | 'AUDIO' | 'CLEAR' | 'CLEAR_ALL', time: number) => void,
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
          if (e.repeat) break;
          e.preventDefault();
          if (video.paused) {
            video.play();
          } else {
            video.pause();
          }
          break;

        case 'ArrowLeft': {
          e.preventDefault();
          const leftSkip = e.altKey ? 30 * frameDuration : (e.shiftKey ? frameDuration : 10 * frameDuration);
          if (isPreviewMode && seekToTimelineTime) {
            seekToTimelineTime(Math.max(0, currentTimelineTime - leftSkip));
          } else {
            video.currentTime = Math.max(0, video.currentTime - leftSkip);
          }
          break;
        }

        case 'ArrowRight': {
          e.preventDefault();
          const rightSkip = e.altKey ? 30 * frameDuration : (e.shiftKey ? frameDuration : 10 * frameDuration);
          if (isPreviewMode && seekToTimelineTime) {
            seekToTimelineTime(currentTimelineTime + rightSkip);
          } else {
            video.currentTime = Math.min(video.duration, video.currentTime + rightSkip);
          }
          break;
        }

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
          if (e.repeat) break;
          e.preventDefault();
          if (e.shiftKey) {
            onConstraint('CLEAR_TYPE_IN', video.currentTime);
          } else {
            onConstraint('IN', video.currentTime);
          }
          break;

        case 'KeyO':
          if (e.repeat) break;
          e.preventDefault();
          if (e.shiftKey) {
            onConstraint('CLEAR_TYPE_OUT', video.currentTime);
          } else {
            onConstraint('OUT', video.currentTime);
          }
          break;

        case 'KeyM':
          if (e.repeat) break;
          e.preventDefault();
          if (e.shiftKey) {
            onConstraint('CLEAR_TYPE_BM', video.currentTime);
          } else {
            onConstraint('BM', video.currentTime);
          }
          break;

        case 'KeyX':
        case 'Backspace':
          if (e.repeat) break;
          e.preventDefault();
          if (e.shiftKey) {
            onConstraint('CLEAR_ALL', video.currentTime);
            onOverride('CLEAR', video.currentTime);
          } else {
            onConstraint('CLEAR', video.currentTime);
          }
          break;

        case 'KeyK':
          if (e.repeat) break;
          e.preventDefault();
          onOverride('KEEP', video.currentTime);
          break;

        case 'KeyT':
          if (e.repeat) break;
          e.preventDefault();
          onOverride('TRASH', video.currentTime);
          break;

        case 'KeyB':
          if (e.repeat) break;
          e.preventDefault();
          onOverride('BROLL', video.currentTime);
          break;
        case 'KeyA':
          if (e.repeat) break;
          e.preventDefault();
          if (e.shiftKey) {
            onConstraint('CLEAR_TYPE_AUDIO', video.currentTime);
          } else {
            onConstraint('AUDIO', video.currentTime);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [videoRef, timeline, fps, onConstraint, onOverride, isPreviewMode, currentTimelineTime, seekToTimelineTime]);
}
