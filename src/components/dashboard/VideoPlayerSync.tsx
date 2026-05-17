import { forwardRef } from 'react';

interface VideoPlayerSyncProps {
  src: string;
}

export const VideoPlayerSync = forwardRef<HTMLVideoElement, VideoPlayerSyncProps>(
  ({ src }, ref) => {
    return (
      <div className="w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl aspect-video relative">
        <video
          ref={ref}
          src={src}
          controls
          className="w-full h-full object-contain"
          crossOrigin="anonymous"
        />
      </div>
    );
  }
);
