import React, { Fragment, useMemo } from 'react';
import { SortableContext } from '@dnd-kit/sortable';
import { UniversalTimelineSegment } from './UniversalTimelineSegment';
import { TimelineWaveform } from './TimelineWaveform';
import type { UniversalClip } from '../../types/UniversalClip';

const MARKER_COLORS: Record<string, string> = {
  IN: '#4CAF50',
  OUT: '#E53935',
  BM: '#FF6D00',
  AUDIO: '#FFC107',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────


interface UniversalTimelineTrackProps {
  mode: 'stringout' | 'director_cut';
  displayClips: UniversalClip[];
  sortableItems: string[];
  totalDuration: number;
  zoomWindow: [number, number];
  playheadRef: React.RefObject<HTMLDivElement>;
  audioWaveforms?: { amplitude: number[], energy: number[] } | null;
  waveformView?: 'amplitude' | 'energy';
  audioDuration?: number;
  audioBeats?: { time: number; energy: number; type: string }[];
  audioBpm?: number | null;
  audioMarkerFilters?: { types: string[]; minEnergy: number };
  userConstraints: Record<string, Array<{ type: 'IN' | 'OUT' | 'BM' | 'AUDIO'; time: number }>>;
  markerNumbers?: Map<string, number>;
  hiddenMarkers: string[];
  isModifying?: boolean;
}

export const UniversalTimelineTrack: React.FC<UniversalTimelineTrackProps> = ({
  mode,
  displayClips,
  sortableItems,
  totalDuration,
  zoomWindow,
  playheadRef,
  audioWaveforms,
  waveformView = 'amplitude',
  audioDuration = 0,
  audioBeats = [],
  audioBpm = null,
  audioMarkerFilters,
  userConstraints,
  markerNumbers,
  hiddenMarkers,
  isModifying
}) => {
  const [zoomStart, zoomEnd] = zoomWindow;
  const zoomScale = 1 / (zoomEnd - zoomStart);
  const panOffset = zoomStart * 100;

  // ─── BPM Grid Extension (Scelta B — Tile matematico) ──────────────────────
  // Real beats cover [0, audioDuration]. Synthetic beats tile the pattern
  // beyond audioDuration up to totalDuration using the BPM interval.
  // Visually distinct: real = opaque, synthetic = semi-transparent + dashed.
  const extendedBpmBeats = useMemo(() => {
    if (!audioBeats.length || audioDuration <= 0 || audioDuration >= totalDuration) return audioBeats;
    const interval = audioBpm && audioBpm > 0
      ? 60 / audioBpm
      : audioDuration / Math.max(audioBeats.filter(b => b.type.includes('beat')).length, 1);
    if (interval <= 0) return audioBeats;
    const synthetic: { time: number; energy: number; type: string }[] = [...audioBeats];
    let t = audioDuration + interval;
    while (t <= totalDuration + interval) {
      synthetic.push({ time: t, energy: 0, type: 'beat_synthetic' });
      t += interval;
    }
    return synthetic;
  }, [audioBeats, audioBpm, audioDuration, totalDuration]);

  // Pre-compute audio scale fraction (waveform-aligned)
  const audioScaleFrac = audioDuration > 0 ? Math.min(audioDuration, totalDuration) / totalDuration : 1;

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-900">
      {/* Static, non-zoomed background bar for the ruler labels area at the top */}
      <div className="absolute top-0 left-0 right-0 h-[24px] bg-black/75 border-b border-slate-800/80 z-[10] pointer-events-none" />

      <div 
        className="absolute inset-y-0 left-0 h-full z-[20]"
        style={{ 
          width: `${zoomScale * 100}%`,
          transform: `translateX(-${panOffset}%)`
        }}
      >
        <div className="absolute inset-0">
          
          {/* Ruler Pills & AI YOLO Markers */}
          <div className="absolute top-0 left-0 right-0 h-[24px] z-[40] pointer-events-none">
            {displayClips.map((clip) => {
              const clipLen = clip.sourceEnd - clip.sourceStart;
              if (clipLen <= 0) return null;

              const constraintKey = clip.sourceClipStart.toString();
              const constraints = (userConstraints[constraintKey] ?? []).filter(c => !hiddenMarkers.includes(c.type));
              const yoloVisible = !hiddenMarkers.includes('YOLO_BM');
              const bm = yoloVisible && clip.bestMoment !== undefined ? clip.bestMoment : null;

              return (
                <Fragment key={`ruler-${clip.id}`}>
                  {constraints.map((c, i) => {
                    const pct = ((c.time - clip.sourceStart) / clipLen) * 100;
                    if (pct < 0 || pct > 100) return null;
                    const absoluteLeft = ((clip.displayStart + (clip.displayEnd - clip.displayStart) * (pct / 100)) / totalDuration) * 100;
                    let label: string = c.type;
                    if (c.type === 'BM') {
                      const num = markerNumbers?.get(`${constraintKey}_${c.time.toFixed(2)}`);
                      label = num ? `M${num}` : 'M#';
                    } else if (c.type === 'AUDIO') {
                      label = '♪';
                    }

                    return (
                      <div
                        key={`c-${i}`}
                        className="absolute bottom-1 -translate-x-1/2 flex items-center justify-center gap-[2px] px-1 py-0.5 rounded text-[7px] font-black font-mono pointer-events-auto cursor-help hover:brightness-125 transition-all"
                        style={{
                          left: `${absoluteLeft}%`,
                          backgroundColor: `${MARKER_COLORS[c.type]}30`,
                          color: MARKER_COLORS[c.type],
                          border: `1px solid ${MARKER_COLORS[c.type]}66`,
                        }}
                        title={`${c.type} Marker`}
                      >
                        {label}
                      </div>
                    );
                  })}
                  
                  {bm !== null && (
                    <div
                      className="absolute bottom-1 -translate-x-1/2 flex items-center justify-center gap-[2px] px-1 py-0.5 rounded text-[7px] font-black font-mono pointer-events-auto cursor-help hover:brightness-125 transition-all"
                      style={{
                        left: `${(((clip.displayStart + (clip.displayEnd - clip.displayStart) * (((bm - clip.sourceStart) / clipLen) * 100) / 100)) / totalDuration) * 100}%`,
                        backgroundColor: '#FF6D0030',
                        color: '#FF6D00',
                        border: '1px solid #FF6D0066',
                      }}
                      title="AI Best Moment"
                    >
                      BM
                    </div>
                  )}
                </Fragment>
              );
            })}
            
            {/* Audio Beat Markers (Filtered for UI) */}
            {audioBeats && audioMarkerFilters && audioBeats.map((beat, i) => {
              const isBeat = beat.type.includes('beat') && audioMarkerFilters.types.includes('beat');
              const isHarmonic = beat.type.includes('harmonic') && audioMarkerFilters.types.includes('harmonic');
              const isPercussive = beat.type.includes('percussive') && audioMarkerFilters.types.includes('percussive');

              const showFlag = (isBeat || isHarmonic || isPercussive) && (beat.energy >= audioMarkerFilters.minEnergy);
              if (!showFlag) return null;

              // Fix: scale beat.time relative to audio duration (not total duration)
              const leftPct = audioDuration > 0
                ? (beat.time / audioDuration) * audioScaleFrac * 100
                : (beat.time / totalDuration) * 100;

              return (
                <Fragment key={`audio-bm-${i}`}>
                  {showFlag && (() => {
                    let colorClasses = 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/60';
                    if (isHarmonic) colorClasses = 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/60';
                    else if (isPercussive) colorClasses = 'bg-slate-200/20 text-white border border-slate-300/60';

                    return (
                      <div
                          className={`absolute bottom-1 -translate-x-1/2 flex items-center justify-center gap-[2px] px-1 py-0.5 rounded text-[7px] font-black font-mono pointer-events-auto cursor-help hover:brightness-125 transition-all ${colorClasses} z-[40]`}
                          style={{ left: `${leftPct}%` }}
                        title={`AM — ${beat.time.toFixed(2)}s (${beat.type})`}
                      >
                        A
                      </div>
                    );
                  })()}
                </Fragment>
              );
            })}
          </div>

          {/* D&D Segments */}
          <div className={`absolute top-[24px] bottom-0 left-0 right-0 z-[20] ${isModifying ? 'pointer-events-none' : ''}`}>
            <SortableContext items={sortableItems}>
              {displayClips.map((clip) => (
                <UniversalTimelineSegment 
                  key={clip.id} 
                  clip={clip} 
                  mode={mode} 
                  totalDuration={totalDuration} 
                />
              ))}
            </SortableContext>
          </div>

          {/* Marker Pin Overlay */}
          <div className="absolute top-[24px] bottom-0 left-0 right-0 z-[35] pointer-events-none">
            {displayClips.map((clip) => {
              const clipLen = clip.sourceEnd - clip.sourceStart;
              if (clipLen <= 0) return null;
              
              const constraintKey = clip.sourceClipStart.toString();
              const constraints = (userConstraints[constraintKey] ?? []).filter(c => !hiddenMarkers.includes(c.type));
              const yoloVisible = !hiddenMarkers.includes('YOLO_BM');
              const bm = yoloVisible && clip.bestMoment !== undefined && !clip.isTrash ? clip.bestMoment : null;

              return (
                <Fragment key={`pin-${clip.id}`}>
                  {constraints.map((c, i) => {
                    const pct = ((c.time - clip.sourceStart) / clipLen) * 100;
                    if (pct < 0 || pct > 100) return null;
                    const absoluteLeft = ((clip.displayStart + (clip.displayEnd - clip.displayStart) * (pct / 100)) / totalDuration) * 100;
                    return (
                      <div key={`p-${i}`} className="absolute top-0 bottom-0 w-px"
                           style={{ left: `${absoluteLeft}%`, backgroundColor: MARKER_COLORS[c.type], boxShadow: `0 0 4px 1px ${MARKER_COLORS[c.type]}99` }} />
                    );
                  })}
                  {bm !== null && (
                    <div className="absolute top-0 bottom-0 w-px border-l border-dashed opacity-60"
                         style={{ left: `${(((clip.displayStart + (clip.displayEnd - clip.displayStart) * (((bm - clip.sourceStart) / clipLen) * 100) / 100)) / totalDuration) * 100}%`, borderColor: '#FF6D00', boxShadow: '0 0 4px 1px #FF6D0099' }} />
                  )}
                </Fragment>
              );
            })}
          </div>

          {/* BPM Grid Overlay — spans full clip height, Scelta B: synthetic beats tile beyond audio */}
          {audioMarkerFilters && audioMarkerFilters.types.includes('bpm_grid') && (
            <div className="absolute top-[24px] bottom-0 left-0 right-0 z-[36] pointer-events-none">
              {extendedBpmBeats.map((beat, i) => {
                if (!beat.type.includes('beat')) return null;
                const isSynthetic = beat.type === 'beat_synthetic';
                // Real beats: scale to waveform-aligned audio fraction
                // Synthetic beats: already in timeline space [audioDuration, totalDuration]
                const leftPct = isSynthetic
                  ? (beat.time / totalDuration) * 100
                  : (beat.time / audioDuration) * audioScaleFrac * 100;
                if (leftPct < 0 || leftPct > 100) return null;
                return (
                  <div
                    key={`bpm-line-${i}`}
                    className={`absolute top-0 bottom-0 pointer-events-none ${
                      isSynthetic
                        ? 'w-[1px] bg-white/10 border-l border-white/20 border-dashed'
                        : 'w-[1px] bg-white/30'
                    }`}
                    style={{ left: `${leftPct}%` }}
                  />
                );
              })}
            </div>
          )}

          {/* Waveform */}
          {audioWaveforms && audioDuration > 0 && (
            <TimelineWaveform
              audioWaveforms={audioWaveforms}
              waveformView={waveformView}
              videoDuration={totalDuration}
              audioDuration={audioDuration}
              className={`absolute left-0 right-0 opacity-80 pointer-events-none z-[15] mix-blend-screen overflow-hidden top-[24px] bottom-0`}
            />
          )}

          {/* Playhead */}
          <div
            ref={playheadRef}
            className="absolute top-[24px] bottom-0 z-[50] pointer-events-none w-px"
            style={{
              left: '0%',
              backgroundColor: 'white',
              boxShadow: '0 0 5px 2px rgba(255,255,255,0.4), 0 0 1px 0px rgba(0,0,0,1)',
            }}
          >
            {/* Pentagon handle — pointing up */}
            <svg
              className="absolute bottom-0 left-1/2 -translate-x-1/2"
              width="10"
              height="11"
              viewBox="0 0 10 11"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.9)) drop-shadow(0 2px 6px rgba(0,0,0,0.95))' }}
            >
              <path d="M0 11H10V6L5 0L0 6V11Z" fill="white" />
            </svg>
          </div>

        </div>
      </div>
    </div>
  );
};
