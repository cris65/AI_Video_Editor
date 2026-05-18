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

  const nearestMarker = useMemo(() => {
    let closestId: string | null = null;
    let minDiff = 0.5; // mezzo secondo di tolleranza
    
    timeline.forEach((clip, cIdx) => {
      let matchedKey: string | null = null;
      for (const key of Object.keys(userConstraints)) {
        if (Math.abs(parseFloat(key) - clip.source_clip_start) < 0.1) {
          matchedKey = key;
          break;
        }
      }
      if (matchedKey && userConstraints[matchedKey]) {
        userConstraints[matchedKey].forEach((c, mIdx) => {
          if (c.type === 'BM' || c.type === 'IN' || c.type === 'OUT') {
            if (c.time >= clip.source_in && c.time <= clip.source_out) {
              const globalTime = clip.timeline_in + (c.time - clip.source_in);
              const diff = Math.abs(globalTime - currentTime);
              if (diff < minDiff) {
                minDiff = diff;
                closestId = `${cIdx}-${mIdx}`;
              }
            }
          }
        });
      }
    });
    return closestId;
  }, [timeline, userConstraints, currentTime]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (totalDuration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    onSeek(percentage * totalDuration);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  if (!timeline.length) return null;

  return (
    <div className="w-full bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
      <div className="flex justify-between text-xs text-slate-400 font-mono font-medium">
        <span className="text-blue-400 font-bold">{formatTime(currentTime)}</span>
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

          let renderedMarkers: { type: string, pct: number, mIdx: number }[] = [];
          
          let constraints: UserConstraint[] = [];
          // Fuzzy match the key to bypass floating point string rounding mismatches
          for (const key of Object.keys(userConstraints)) {
            if (Math.abs(parseFloat(key) - clip.source_clip_start) < 0.1) {
              constraints = userConstraints[key];
              break;
            }
          }
          
          constraints.forEach((c, mIdx) => {
            if (c.type === 'BM' || c.type === 'IN' || c.type === 'OUT') {
              const relativePos = ((c.time - clip.source_in) / (clip.source_out - clip.source_in)) * 100;
              // Mostra solo i marker che cadono dentro il taglio effettivo visibile della clip
              if (relativePos >= 0 && relativePos <= 100) {
                renderedMarkers.push({ type: c.type, pct: relativePos, mIdx });
              }
            }
          });

          return (
            <div
              key={`fc-${i}`}
              className={`absolute top-0 bottom-0 ${bgColor} border-r border-slate-900 transition-colors opacity-80 hover:opacity-100 flex items-center justify-center z-10`}
              style={{
                left: `${startPct}%`,
                width: `${widthPct}%`
              }}
              title={`[${clip.role}] ${clip.tag}`}
            >
              {renderedMarkers.map((marker, idx) => {
                const isClosest = nearestMarker === `${i}-${marker.mIdx}`;
                return (
                  <div 
                    key={`marker-${idx}`}
                    className={`absolute top-1/2 text-[12px] font-black pointer-events-none transition-all duration-150 ${isClosest ? 'drop-shadow-[0_0_5px_rgba(255,255,255,1)] z-30' : 'drop-shadow-md z-20'}`}
                    style={{ 
                      left: `${marker.pct}%`, 
                      transform: `translate(-50%, -50%) ${isClosest ? 'scale(1.3)' : 'scale(1)'}`,
                      color: marker.type === 'IN' ? '#3b82f6' : (marker.type === 'OUT' ? '#a855f7' : (isClosest ? '#fbbf24' : '#ffffff'))
                    }}
                  >
                    {marker.type === 'IN' && '['}
                    {marker.type === 'OUT' && ']'}
                    {marker.type === 'BM' && (
                      <svg width="7.5" height="10.5" viewBox="0 0 10 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
                        <path d="M0 0H10V10L5 14L0 10V0Z" />
                      </svg>
                    )}
                  </div>
                );
              })}
              {widthPct > 5 && renderedMarkers.length === 0 && (
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

        {/* Premiere-style Playhead */}
        <div 
          className="absolute top-0 bottom-0 z-[25] pointer-events-none transition-all duration-75 ease-linear flex flex-col items-center"
          style={{ 
            left: `${(currentTime / totalDuration) * 100}%`,
            transform: 'translateX(-50%)' 
          }}
        >
          {/* Playhead Top Triangle */}
          <svg width="11" height="12" viewBox="0 0 11 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-500 drop-shadow-[0_0_4px_rgba(59,130,246,0.8)]">
            <path d="M0 0H11V6L5.5 12L0 6V0Z" fill="currentColor"/>
          </svg>
          {/* Playhead Line */}
          <div className="w-[2px] h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,1)]" />
        </div>
      </div>
      
      <div className="flex gap-4 mt-1 text-[10px] font-mono text-slate-500 justify-center">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded"></span> PILLARS (BM)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-600 rounded"></span> FILLER (MAIN)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded"></span> FILLER (B-ROLL)</span>
      </div>
    </div>
  );
};
