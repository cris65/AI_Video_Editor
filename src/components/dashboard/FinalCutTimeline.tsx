import React, { useMemo } from 'react';
import type { FinalCutClip } from '../../hooks/usePancakeData';
import type { UserConstraint } from './PancakeDashboard';

interface Props {
  timeline: FinalCutClip[];
  currentTime: number;
  onSeek: (time: number) => void;
  userConstraints?: Record<string, UserConstraint[]>;
  audioWaveform?: number[];
  audioDuration?: number;
}

export const FinalCutTimeline: React.FC<Props> = ({ timeline, currentTime, onSeek, userConstraints = {}, audioWaveform = [], audioDuration = 0 }) => {
  const totalDuration = useMemo(() => {
    if (!timeline.length) return 0;
    return timeline[timeline.length - 1].timeline_out;
  }, [timeline]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (totalDuration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    onSeek(percentage * totalDuration);
  };

  if (!timeline.length) return null;

  return (
    <div className="w-full bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
      <div className="flex justify-between text-xs text-slate-400 font-mono font-medium">
        <span>00:00.0</span>
        <span className="text-amber-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          DIRECTOR'S CUT PREVIEW
        </span>
        <span>{totalDuration.toFixed(1)}s</span>
      </div>
      
      <div 
        className="relative h-12 w-full bg-slate-800 rounded-md overflow-hidden cursor-pointer shadow-inner"
        onClick={handleTimelineClick}
      >
        {/* Render Clips */}
        {timeline.map((clip, i) => {
          const startPct = (clip.timeline_in / totalDuration) * 100;
          const widthPct = ((clip.timeline_out - clip.timeline_in) / totalDuration) * 100;
          
          let bgColor = 'bg-emerald-600'; // Default FILLER MAIN
          if (clip.role === 'PILLAR') bgColor = 'bg-amber-500';
          else if (clip.tag === 'B-ROLL') bgColor = 'bg-blue-500';

          let bmMarkers: number[] = [];
          if (clip.role === 'PILLAR') {
            let constraints: UserConstraint[] = [];
            // Fuzzy match the key to bypass floating point string rounding mismatches
            for (const key of Object.keys(userConstraints)) {
              if (Math.abs(parseFloat(key) - clip.source_clip_start) < 0.1) {
                constraints = userConstraints[key];
                break;
              }
            }
            
            const bmConstraints = constraints.filter(c => c.type === 'BM');
            bmConstraints.forEach(c => {
              const relativePos = ((c.time - clip.source_in) / (clip.source_out - clip.source_in)) * 100;
              bmMarkers.push(relativePos);
            });
          }

          return (
            <div
              key={`fc-${i}`}
              className={`absolute top-0 bottom-0 ${bgColor} border-r border-slate-900 transition-colors opacity-80 hover:opacity-100 flex items-center justify-center overflow-hidden z-10`}
              style={{
                left: `${startPct}%`,
                width: `${widthPct}%`
              }}
              title={`[${clip.role}] ${clip.tag}`}
            >
              {bmMarkers.map((pct, idx) => (
                <div 
                  key={`bm-${idx}`}
                  className="absolute top-1/2 text-[12px] font-black drop-shadow-md z-20 pointer-events-none transition-transform"
                  style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)', color: '#ffffff' }}
                >
                  <svg width="7.5" height="10.5" viewBox="0 0 10 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
                    <path d="M0 0H10V10L5 14L0 10V0Z" />
                  </svg>
                </div>
              ))}
              {widthPct > 5 && bmMarkers.length === 0 && (
                <span className="text-[10px] font-bold text-white/50 tracking-wider">
                  {clip.role === 'PILLAR' ? 'PILLAR' : 'C'}
                </span>
              )}
            </div>
          );
        })}

        {/* Audio Waveform Overlay */}
        {audioWaveform.length > 0 && audioDuration > 0 && (() => {
          const pointsPerSecond = audioWaveform.length / audioDuration;
          const pointsToShow = Math.ceil(totalDuration * pointsPerSecond);
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

        {/* Playhead */}
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,1)] z-10 pointer-events-none transition-all duration-75 ease-linear"
          style={{ left: `${(currentTime / totalDuration) * 100}%` }}
        />
      </div>
      
      <div className="flex gap-4 mt-1 text-[10px] font-mono text-slate-500 justify-center">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded"></span> PILLARS (BM)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-600 rounded"></span> FILLER (MAIN)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded"></span> FILLER (B-ROLL)</span>
      </div>
    </div>
  );
};
