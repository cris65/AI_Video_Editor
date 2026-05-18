import { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import type { PancakeClip } from '../../hooks/usePancakeData';

interface InteractiveTimelineProps {
  timeline: PancakeClip[];
  videoRef: React.RefObject<HTMLVideoElement>;
  duration: number;
  userConstraints: Record<string, Array<{ type: 'IN' | 'OUT' | 'BM'; time: number }>>;
  clipOverrides?: Record<string, 'KEEP' | 'TRASH' | 'BROLL'>;
  audioWaveform?: number[];
  audioDuration?: number;
  markerNumbers?: Map<string, number>; // Global M# namespace from PancakeDashboard (Stringout-first)
}

export function InteractiveTimeline({ timeline, videoRef, duration, userConstraints, clipOverrides = {}, audioWaveform = [], audioDuration = 0, markerNumbers = new Map() }: InteractiveTimelineProps) {
  const playheadRef = useRef<HTMLDivElement>(null);
  const timeTextRef = useRef<HTMLSpanElement>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

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
      <div className="flex justify-between items-center text-xs text-slate-400 font-mono relative z-[100]">
        <span ref={timeTextRef} className="text-blue-400 font-bold">00:00</span>
        
        {/* Info Popup - Cliccabile e posizionato in alto */}
        <div className="relative flex items-center justify-center">
          <button 
            onClick={() => setIsPopupOpen(!isPopupOpen)}
            className="text-slate-400 flex items-center gap-2 hover:text-slate-300 transition-colors focus:outline-none"
          >
            STRINGOUT PREVIEW
            <Info size={14} className="opacity-70" />
          </button>
          
          {isPopupOpen && (
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-[280px] p-4 bg-slate-900 border border-slate-700 rounded-lg shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[100]">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-slate-200 font-bold text-[11px] uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Keyboard Shortcuts
                </h4>
                <button onClick={() => setIsPopupOpen(false)} className="text-slate-500 hover:text-slate-300">✕</button>
              </div>
              <div className="space-y-2 text-slate-400 text-[10px] font-sans">
                <div className="flex justify-between items-center"><span>Play / Pause</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">Space</kbd></div>
                <div className="flex justify-between items-center"><span>10 Frames</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">← / →</kbd></div>
                <div className="flex justify-between items-center"><span>1 Frame</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">Shift + ← / →</kbd></div>
                <div className="flex justify-between items-center"><span>30 Frames</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">Alt + ← / →</kbd></div>
                <div className="flex justify-between items-center"><span>Previous / Next Clip</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">↑ / ↓</kbd></div>
                <div className="w-full h-px bg-slate-800 my-1" />
                <div className="flex justify-between items-center"><span>Marker IN / OUT</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">I / O</kbd></div>
                <div className="flex justify-between items-center"><span>Marker Bookmark (M#)</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">M</kbd></div>
                <div className="flex justify-between items-center"><span>Remove Single Marker</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">X / Backspace</kbd></div>
                <div className="flex justify-between items-center"><span>Remove All Markers</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">Shift + X</kbd></div>
                <div className="w-full h-px bg-slate-800 my-1" />
                <div className="flex justify-between items-center"><span>Force Status: KEEP</span><kbd className="bg-emerald-900/50 px-1.5 py-0.5 rounded text-emerald-400 font-mono border border-emerald-800/50">K</kbd></div>
                <div className="flex justify-between items-center"><span>Force Status: TRASH</span><kbd className="bg-red-900/50 px-1.5 py-0.5 rounded text-red-400 font-mono border border-red-800/50">T</kbd></div>
                <div className="flex justify-between items-center"><span>Force Status: B-ROLL</span><kbd className="bg-blue-900/50 px-1.5 py-0.5 rounded text-blue-400 font-mono border border-blue-800/50">B</kbd></div>
              </div>
            </div>
          )}
        </div>

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
              {/* Constraint Markers with global M# label */}
              {constraints.map((constraint, cIdx) => {
                const markerNum = markerNumbers.get(`${clip.start.toFixed(3)}_${cIdx}`);
                return (
                  <div
                    key={cIdx}
                    className="absolute flex flex-col items-center z-20 pointer-events-none"
                    style={{
                      left: `${((constraint.time - clip.start) / (clip.end - clip.start)) * 100}%`,
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div
                      className="text-[12px] font-black drop-shadow-md"
                      style={{ color: constraint.type === 'IN' ? '#3b82f6' : (constraint.type === 'OUT' ? '#a855f7' : '#ffffff') }}
                    >
                      {constraint.type === 'IN' && '['}
                      {constraint.type === 'OUT' && ']'}
                      {constraint.type === 'BM' && (
                        <svg width="7.5" height="10.5" viewBox="0 0 10 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
                          <path d="M0 0H10V10L5 14L0 10V0Z" />
                        </svg>
                      )}
                    </div>
                    {markerNum !== undefined && (
                      <span
                        className="text-[9px] font-bold font-mono leading-none mt-[2px]"
                        style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
                      >
                        M{markerNum}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Hover overlay for entire timeline */}
        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        {/* Audio Waveform Overlay */}
        {audioWaveform.length > 0 && audioDuration > 0 && (() => {
          const pointsPerSecond = audioWaveform.length / audioDuration;
          const pointsToShow = Math.ceil(duration * pointsPerSecond);
          const visibleWaveform = audioWaveform.slice(0, pointsToShow);
          
          if (visibleWaveform.length === 0) return null;
          
          // Generate SVG Path for Premiere-like dense waveform
          const width = 1000;
          const height = 100;
          const step = width / visibleWaveform.length;
          
          let pathD = `M 0,${height}`;
          visibleWaveform.forEach((val, idx) => {
            const x = (idx * step).toFixed(2);
            const y = (height - (val * height)).toFixed(2);
            pathD += ` L ${x},${y}`;
          });
          pathD += ` L ${width},${height} Z`;
          
          return (
            <div className="absolute inset-0 opacity-40 pointer-events-none z-[15] mix-blend-screen overflow-hidden">
              <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full fill-emerald-400">
                <path d={pathD} />
              </svg>
            </div>
          );
        })()}

        {/* Playhead controlled by requestAnimationFrame */}
        <div 
          ref={playheadRef}
          className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-[30] pointer-events-none drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]"
          style={{ left: '0%' }}
        >
          {/* Playhead handle (triangle) */}
          <div className="absolute top-0 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-500 drop-shadow-md" />
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
