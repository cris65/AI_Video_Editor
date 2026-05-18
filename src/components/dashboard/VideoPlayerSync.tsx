import { forwardRef } from 'react';

interface VideoPlayerSyncProps {
  src: string;
  hideControls?: boolean;
}

export const VideoPlayerSync = forwardRef<HTMLVideoElement, VideoPlayerSyncProps>(
  ({ src, hideControls }, ref) => {
    return (
      <div className="w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl aspect-video relative">
        <video
          ref={ref}
          src={src}
          controls={!hideControls}
          className="w-full h-full object-contain"
          crossOrigin="anonymous"
        />
      </div>
    );
  }
);
