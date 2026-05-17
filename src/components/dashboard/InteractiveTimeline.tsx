import { useEffect, useRef } from 'react';
import type { PancakeClip } from '../../hooks/usePancakeData';

interface InteractiveTimelineProps {
  timeline: PancakeClip[];
  videoRef: React.RefObject<HTMLVideoElement>;
  duration: number;
  userConstraints: Record<string, Array<{ type: 'IN' | 'OUT' | 'BM'; time: number }>>;
  clipOverrides?: Record<string, 'KEEP' | 'TRASH' | 'BROLL'>;
}

export function InteractiveTimeline({ timeline, videoRef, duration, userConstraints, clipOverrides = {} }: InteractiveTimelineProps) {
  const playheadRef = useRef<HTMLDivElement>(null);
  const timeTextRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let animationFrameId: number;
    const updatePlayhead = () => {
      if (videoRef.current && playheadRef.current && duration > 0) {
        const currentTime = videoRef.current.currentTime;
        const percentage = (currentTime / duration) * 100;
        playheadRef.current.style.left = `${percentage}%`;
        if (timeTextRef.current) {
          timeTextRef.current.innerText = formatTime(currentTime);
        }
      }
      animationFrameId = requestAnimationFrame(updatePlayhead);
    };

    animationFrameId = requestAnimationFrame(updatePlayhead);
    return () => cancelAnimationFrame(animationFrameId);
  }, [videoRef, duration]);

  if (!timeline || timeline.length === 0 || duration <= 0) return null;

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const seekTime = percentage * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }
  };

  const getSegmentColor = (tag: string, isUsable?: boolean, override?: 'KEEP' | 'TRASH' | 'BROLL') => {
    let finalUsable = isUsable !== false;
    let isBroll = tag.includes('B-ROLL');

    if (override === 'KEEP') { finalUsable = true; isBroll = false; }
    if (override === 'TRASH') { finalUsable = false; }
    if (override === 'BROLL') { finalUsable = true; isBroll = true; }
    
    if (!finalUsable) {
      if (override === 'TRASH') return 'bg-red-600 border-2 border-red-400 hover:bg-red-500 z-10'; // Forced trash
      return 'bg-red-500/80 hover:bg-red-400'; // Native trash
    }
    
    if (override === 'KEEP') return 'bg-emerald-400 border-2 border-emerald-300 hover:bg-emerald-300 z-10'; // Forced keep
    if (override === 'BROLL') return 'bg-blue-400 border-2 border-blue-300 hover:bg-blue-300 z-10'; // Forced B-Roll

    if (isBroll) return 'bg-blue-500/80 hover:bg-blue-400';
    return 'bg-emerald-500/80 hover:bg-emerald-400'; // MAIN_A or default Valid
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
        <span ref={timeTextRef}>00:00</span>
        <span>{formatTime(duration)}</span>
      </div>

      <div 
        className="relative w-full h-12 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden cursor-pointer group shadow-inner"
        onClick={handleTimelineClick}
      >
        {/* Segments */}
        {timeline.map((clip, idx) => {
          const left = (clip.start / duration) * 100;
          const width = ((clip.end - clip.start) / duration) * 100;
          const constraints = userConstraints[clip.start.toString()] || [];

          const override = clipOverrides[clip.start.toString()];

          return (
            <div
              key={idx}
              className={`absolute top-0 bottom-0 border-r border-slate-950 transition-colors ${getSegmentColor(clip.tag, clip.is_usable, override)}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`[${clip.tag}] ${formatTime(clip.start)} - ${formatTime(clip.end)}`}
            >
              {/* Constraint Markers */}
              {constraints.map((constraint, cIdx) => (
                <div 
                  key={cIdx}
                  className="absolute top-1/2 text-[12px] font-black drop-shadow-md z-20 pointer-events-none transition-transform"
                  style={{ 
                    left: `${((constraint.time - clip.start) / (clip.end - clip.start)) * 100}%`, 
                    transform: 'translate(-50%, -50%)',
                    color: constraint.type === 'IN' ? '#3b82f6' : (constraint.type === 'OUT' ? '#a855f7' : '#eab308')
                  }}
                >
                  {constraint.type === 'IN' && '['}
                  {constraint.type === 'OUT' && ']'}
                  {constraint.type === 'BM' && '★'}
                </div>
              ))}
            </div>
          );
        })}

        {/* Hover overlay for entire timeline */}
        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        {/* Playhead controlled by requestAnimationFrame */}
        <div 
          ref={playheadRef}
          className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] z-10 pointer-events-none"
          style={{ left: '0%' }}
        >
          {/* Playhead handle (triangle) */}
          <div className="absolute top-0 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-white drop-shadow-md" />
        </div>
        
      </div>
      
      {/* Legenda */}
      <div className="flex gap-4 items-center justify-center mt-2 text-[10px] uppercase font-bold tracking-wider text-slate-500">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500/80"></span> Valid (MAIN)</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500/80"></span> B-ROLL</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500/80"></span> Trash (Rejected)</div>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
