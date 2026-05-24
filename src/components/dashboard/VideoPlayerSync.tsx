import { forwardRef } from 'react';

interface VideoPlayerSyncProps {
  src: string | string[];
  hideControls?: boolean;
}

export const VideoPlayerSync = forwardRef<HTMLVideoElement, VideoPlayerSyncProps>(
  ({ src, hideControls }, ref) => {
    return (
      <div className="w-full h-full max-h-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center relative">
        <video
          ref={ref}
          controls={!hideControls}
          className="w-full h-full object-contain"
          crossOrigin="anonymous"
        >
          {Array.isArray(src) ? (
            src.map((url) => <source key={url} src={url} />)
          ) : (
            <source src={src} />
          )}
        </video>
      </div>
    );
  }
);
