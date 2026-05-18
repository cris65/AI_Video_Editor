import { useEffect, useRef, useState, useCallback } from 'react';
import type { FinalCutClip } from './usePancakeData';

export function useSequencePlayer(
  videoRef: React.RefObject<HTMLVideoElement>,
  audioRef: React.RefObject<HTMLAudioElement>,
  finalCutTimeline: FinalCutClip[],
  isPreviewMode: boolean
) {
  const [currentTimelineTime, setCurrentTimelineTime] = useState(0);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const rafRef = useRef<number>();
  const isSeeking = useRef(false);


  // Reset sequence when timeline is regenerated
  useEffect(() => {
    if (finalCutTimeline.length > 0) {
      setActiveClipIndex(0);
      setCurrentTimelineTime(0);
      if (videoRef.current) {
        videoRef.current.currentTime = finalCutTimeline[0].source_in;
      }
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
    }
  }, [finalCutTimeline, videoRef, audioRef]);

  // Mute video and handle play/pause sync
  useEffect(() => {
    if (!isPreviewMode || finalCutTimeline.length === 0) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (videoRef.current) {
        videoRef.current.muted = false;
      }
      return;
    }

    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    video.muted = true; // Director Mode mutes source audio

    const handlePlay = () => {
      if (audio && !isSeeking.current) {
        audio.play().catch(e => console.warn("Audio play blocked", e));
      }
    };
    
    const handlePause = () => {
      if (audio) {
        audio.pause();
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      if (audio) audio.pause();
    };
  }, [isPreviewMode, finalCutTimeline]);

  // Main Sequence Loop (60fps)
  useEffect(() => {
    if (!isPreviewMode || finalCutTimeline.length === 0) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    const loop = () => {
      if (!isSeeking.current) {
        const vTime = video.currentTime;
        
        let currentIndex = activeClipIndex;
        let currentClip = finalCutTimeline[currentIndex];

        // 1. Calculate global timeline time
        const elapsed = vTime - currentClip.source_in;
        setCurrentTimelineTime(currentClip.timeline_in + elapsed);

        // 2. Audio sync watchdog
        if (audio && !audio.paused && !video.paused) {
           const expectedAudioTime = currentClip.timeline_in + elapsed;
           if (Math.abs(audio.currentTime - expectedAudioTime) > 0.15) {
               audio.currentTime = expectedAudioTime;
           }
        }

        // 3. TRIGGER CUT (Hot Swap)
        if (vTime >= currentClip.source_out - 0.05) { // 50ms di anticipo per mitigare il micro-lag
          const nextIndex = currentIndex + 1;
          if (nextIndex < finalCutTimeline.length) {
            isSeeking.current = true;
            setActiveClipIndex(nextIndex);
            const nextClip = finalCutTimeline[nextIndex];
            
            video.currentTime = nextClip.source_in;
            if (audio) {
              audio.currentTime = nextClip.timeline_in;
            }
            
            const onSeeked = () => {
              isSeeking.current = false;
              video.removeEventListener('seeked', onSeeked);
              if (!video.paused && audio) audio.play();
            };
            video.addEventListener('seeked', onSeeked, { once: true });
          } else {
            // End of sequence
            video.pause();
            if (audio) audio.pause();
          }
        }
      }
      
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPreviewMode, finalCutTimeline, activeClipIndex]);

  // Esponiamo un metodo per fare seek direttamente sulla timeline finale
  const seekToTimelineTime = useCallback((targetTime: number) => {
    if (!videoRef.current) return;
    const clipIndex = finalCutTimeline.findIndex(c => targetTime >= c.timeline_in && targetTime < c.timeline_out);
    
    if (clipIndex !== -1) {
      const clip = finalCutTimeline[clipIndex];
      const elapsed = targetTime - clip.timeline_in;
      const targetSource = clip.source_in + elapsed;
      
      isSeeking.current = true;
      setActiveClipIndex(clipIndex);
      setCurrentTimelineTime(targetTime);
      
      videoRef.current.currentTime = targetSource;
      if (audioRef.current) {
        audioRef.current.currentTime = targetTime;
      }
      
      const onSeeked = () => {
        isSeeking.current = false;
        videoRef.current?.removeEventListener('seeked', onSeeked);
      };
      videoRef.current.addEventListener('seeked', onSeeked, { once: true });
    }
  }, [finalCutTimeline, videoRef, audioRef]);

  return { currentTimelineTime, activeClipIndex, seekToTimelineTime };
}
