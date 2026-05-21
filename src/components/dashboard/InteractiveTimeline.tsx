import { useCallback, useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import type { PancakeClip } from '../../hooks/usePancakeData';

interface InteractiveTimelineProps {
  timeline: PancakeClip[];
  videoRef: React.RefObject<HTMLVideoElement>;
  duration: number;
  userConstraints: Record<string, Array<{ type: 'IN' | 'OUT' | 'BM' | 'AUDIO'; time: number }>>;
  clipOverrides?: Record<string, 'KEEP' | 'TRASH' | 'BROLL'>;
  audioWaveform?: number[];
  audioDuration?: number;
  markerNumbers?: Map<string, number>; // Global M# namespace from PancakeDashboard (Stringout-first)
}

// Per-type marker color palette
const MARKER_COLORS: Record<string, string> = {
  IN:    '#3b82f6', // blue-500
  OUT:   '#a855f7', // purple-500
  BM:    '#f97316', // orange-500 (user bookmark, distinct from native yellow BM)
  AUDIO: '#22c55e', // green-500
};

const MIN_ZOOM_WINDOW = 0.04; // minimum 4% of total duration visible
const HANDLE_SIZE_PX = 10;    // draggable edge zone in pixels

type DragType = 'left' | 'right' | 'pan';

interface DragState {
  type: DragType;
  startX: number;
  startWindow: [number, number];
  barWidth: number;
  playheadFrac?: number;
  playheadScreenFrac?: number;
}

export function InteractiveTimeline({ timeline, videoRef, duration, userConstraints, clipOverrides = {}, audioWaveform = [], audioDuration = 0, markerNumbers = new Map() }: InteractiveTimelineProps) {
  const playheadRef = useRef<HTMLDivElement>(null);
  const timeTextRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  // Zoom state: [startFraction, endFraction] of total duration, both in [0, 1]
  const [zoomWindow, setZoomWindow] = useState<[number, number]>([0, 1]);
  const dragStateRef = useRef<DragState | null>(null);

  // ─── Playhead RAF ────────────────────────────────────────────────────────────
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

  // ─── Auto-pan on Seek ────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleSeeked = () => {
      if (duration <= 0) return;
      const frac = video.currentTime / duration;
      setZoomWindow(prev => {
        const [start, end] = prev;
        if (frac >= start && frac <= end) return prev;

        const span = end - start;
        let newStart = frac - span / 2;
        let newEnd = frac + span / 2;

        if (newStart < 0) {
          newStart = 0;
          newEnd = span;
        } else if (newEnd > 1) {
          newEnd = 1;
          newStart = 1 - span;
        }
        return [newStart, newEnd];
      });
    };

    video.addEventListener('seeked', handleSeeked);
    return () => video.removeEventListener('seeked', handleSeeked);
  }, [videoRef, duration]);

  // ─── Scrollbar drag handlers ──────────────────────────────────────────────
  const handleScrollbarMouseMove = useCallback((e: MouseEvent) => {
    const drag = dragStateRef.current;
    if (!drag) return;

    const delta = (e.clientX - drag.startX) / drag.barWidth; // fraction
    const [s0, e0] = drag.startWindow;

    let nextWindow: [number, number];

    // If playhead was visible when dragging started, keep it anchored at the same screen position
    if (drag.playheadFrac !== undefined && drag.playheadScreenFrac !== undefined) {
      const playheadFrac = drag.playheadFrac;
      const playheadScreenFrac = drag.playheadScreenFrac;

      let newSpan: number;
      if (drag.type === 'left') {
        const targetS = Math.max(0, Math.min(s0 + delta, e0 - MIN_ZOOM_WINDOW));
        newSpan = e0 - targetS;
      } else if (drag.type === 'right') {
        const targetE = Math.min(1, Math.max(e0 + delta, s0 + MIN_ZOOM_WINDOW));
        newSpan = targetE - s0;
      } else {
        // pan
        const span = e0 - s0;
        const newS = Math.max(0, Math.min(s0 + delta, 1 - span));
        nextWindow = [newS, newS + span];
        setZoomWindow(nextWindow);
        return;
      }

      newSpan = Math.min(1, Math.max(MIN_ZOOM_WINDOW, newSpan));
      let newStart = playheadFrac - newSpan * playheadScreenFrac;
      newStart = Math.max(0, Math.min(newStart, 1 - newSpan));
      nextWindow = [newStart, newStart + newSpan];
    } else {
      // Standard zoom (no visible playhead, anchor on opposite edge)
      if (drag.type === 'left') {
        const newS = Math.max(0, Math.min(s0 + delta, e0 - MIN_ZOOM_WINDOW));
        nextWindow = [newS, e0];
      } else if (drag.type === 'right') {
        const newE = Math.min(1, Math.max(e0 + delta, s0 + MIN_ZOOM_WINDOW));
        nextWindow = [s0, newE];
      } else {
        // pan
        const span = e0 - s0;
        const newS = Math.max(0, Math.min(s0 + delta, 1 - span));
        nextWindow = [newS, newS + span];
      }
    }

    setZoomWindow(nextWindow);
  }, []);

  const handleScrollbarMouseUp = useCallback(() => {
    dragStateRef.current = null;
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', handleScrollbarMouseMove);
    window.removeEventListener('mouseup', handleScrollbarMouseUp);
  }, [handleScrollbarMouseMove]);

  const handleScrollbarMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const bar = scrollbarRef.current;
    if (!bar) return;
    const barRect = bar.getBoundingClientRect();
    const barWidth = barRect.width;

    // Determine where in the thumb the user clicked
    const thumbLeft = zoomWindow[0] * barWidth;
    const thumbRight = zoomWindow[1] * barWidth;
    const clickX = e.clientX - barRect.left;

    let type: DragType;

    // Boundary-tolerant check: click is near left handle (within 10px of thumbLeft)
    if (Math.abs(clickX - thumbLeft) <= HANDLE_SIZE_PX) {
      type = 'left';
    }
    // Boundary-tolerant check: click is near right handle (within 10px of thumbRight)
    else if (Math.abs(clickX - thumbRight) <= HANDLE_SIZE_PX) {
      type = 'right';
    }
    // Click is inside thumb
    else if (clickX >= thumbLeft && clickX <= thumbRight) {
      type = 'pan';
    }
    // Click is completely outside thumb -> jump pan to center on click
    else {
      const clickFrac = clickX / barWidth;
      const span = zoomWindow[1] - zoomWindow[0];
      const newS = Math.max(0, Math.min(clickFrac - span / 2, 1 - span));
      setZoomWindow([newS, newS + span]);
      return;
    }

    // Capture playhead status at click start to anchor zoom dynamically
    const currentTime = videoRef.current ? videoRef.current.currentTime : 0;
    const playheadFrac = currentTime / duration;
    const [s, en] = zoomWindow;
    const isPlayheadVisible = playheadFrac >= s && playheadFrac <= en;

    dragStateRef.current = {
      type,
      startX: e.clientX,
      startWindow: [...zoomWindow] as [number, number],
      barWidth,
      playheadFrac: isPlayheadVisible ? playheadFrac : undefined,
      playheadScreenFrac: isPlayheadVisible ? (playheadFrac - s) / (en - s) : undefined,
    };

    // Lock cursor globally to prevent drag indicator loss and flashes
    if (type === 'left' || type === 'right') {
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.cursor = 'grabbing';
    }

    window.addEventListener('mousemove', handleScrollbarMouseMove);
    window.addEventListener('mouseup', handleScrollbarMouseUp);
  }, [zoomWindow, handleScrollbarMouseMove, handleScrollbarMouseUp, duration, videoRef]);

  // ─── Wheel zoom on track ──────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!videoRef.current) return;

    const [s, en] = zoomWindow;
    const currentTime = videoRef.current.currentTime;
    const playheadFrac = currentTime / duration;

    // Check if playhead is currently within the visible zoom window
    const isPlayheadVisible = playheadFrac >= s && playheadFrac <= en;

    let anchorFrac: number;
    let screenFrac: number;

    if (isPlayheadVisible) {
      // Anchor on the playhead's screen position
      anchorFrac = playheadFrac;
      screenFrac = (playheadFrac - s) / (en - s);
    } else {
      // If playhead is off-screen, anchor on the mouse cursor position to zoom where the user is looking
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const cursorFrac = (e.clientX - rect.left) / rect.width;
      anchorFrac = s + cursorFrac * (en - s);
      screenFrac = cursorFrac;
    }

    const zoomFactor = e.deltaY > 0 ? 1.15 : 0.85;
    const newSpan = Math.min(1, Math.max(MIN_ZOOM_WINDOW, (en - s) * zoomFactor));
    const newS = Math.max(0, Math.min(anchorFrac - newSpan * screenFrac, 1 - newSpan));
    setZoomWindow([newS, newS + newSpan]);
  }, [zoomWindow, duration]);

  if (!timeline || duration <= 0) return null;

  // ─── Timeline click (remapped through zoom window) ────────────────────────
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const screenFrac = (e.clientX - rect.left) / rect.width;
    const [s, en] = zoomWindow;
    const absoluteFrac = s + screenFrac * (en - s);
    const seekTime = absoluteFrac * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }
  };

  // ─── Zoom viewport math ───────────────────────────────────────────────────
  const [zoomStart, zoomEnd] = zoomWindow;
  const zoomSpan = zoomEnd - zoomStart;
  const scale = 1 / zoomSpan;           // e.g. 2.5x
  const panOffset = zoomStart * 100;    // in % relative to the scaled container

  const getSegmentColor = (tag: string, isUsable?: boolean, override?: 'KEEP' | 'TRASH' | 'BROLL') => {
    let finalUsable = isUsable !== false;
    let isBroll = tag.includes('B-ROLL');

    if (override === 'KEEP') { finalUsable = true; isBroll = false; }
    if (override === 'TRASH') { finalUsable = false; }
    if (override === 'BROLL') { finalUsable = true; isBroll = true; }

    if (!finalUsable) {
      if (override === 'TRASH') return 'bg-red-600 border-2 border-red-400 hover:bg-red-500 z-10';
      return 'bg-red-500/80 hover:bg-red-400';
    }

    if (override === 'KEEP') return 'bg-emerald-400 border-2 border-emerald-300 hover:bg-emerald-300 z-10';
    if (override === 'BROLL') return 'bg-blue-400 border-2 border-blue-300 hover:bg-blue-300 z-10';

    if (isBroll) return 'bg-blue-500/80 hover:bg-blue-400';
    return 'bg-emerald-500/80 hover:bg-emerald-400';
  };

  // Cursor style for scrollbar thumb based on drag state
  const getThumbCursorStyle = (): React.CSSProperties => {
    const drag = dragStateRef.current;
    if (drag) {
      if (drag.type === 'left' || drag.type === 'right') {
        return { cursor: 'col-resize' };
      }
      return { cursor: 'grabbing' };
    }
    return { cursor: 'grab' };
  };


  return (
    <div className="w-full flex flex-col gap-1.5">
      {/* ── Time ruler row ─────────────────────────────────────────────── */}
      <div className="flex justify-between items-center text-xs text-slate-400 font-mono relative z-[100]">
        <span ref={timeTextRef} className="text-blue-400 font-bold">00:00</span>

        {/* Info Popup — now a minimal ⓘ icon, no label text */}
        <div className="relative flex items-center justify-center">
          <button
            onClick={() => setIsPopupOpen(!isPopupOpen)}
            className="text-slate-500 hover:text-slate-300 transition-colors focus:outline-none p-1 rounded hover:bg-slate-800/50"
            title="Keyboard Shortcuts"
          >
            <Info size={13} className="opacity-70" />
          </button>

          {isPopupOpen && (
            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-[280px] p-4 bg-slate-900 border border-slate-700 rounded-lg shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[100]">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-slate-200 font-bold text-[11px] uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Keyboard Shortcuts
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
                <div className="flex justify-between items-center"><span className="text-green-400">Marker Audio (♪)</span><kbd className="bg-green-900/50 px-1.5 py-0.5 rounded text-green-400 font-mono border border-green-800/50">A</kbd></div>
                <div className="flex justify-between items-center"><span>Remove Single Marker</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">X / Backspace</kbd></div>
                <div className="flex justify-between items-center"><span>Remove All Markers</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">Shift + X</kbd></div>
                <div className="w-full h-px bg-slate-800 my-1" />
                <div className="flex justify-between items-center"><span>Force Status: KEEP</span><kbd className="bg-emerald-900/50 px-1.5 py-0.5 rounded text-emerald-400 font-mono border border-emerald-800/50">K</kbd></div>
                <div className="flex justify-between items-center"><span>Force Status: TRASH</span><kbd className="bg-red-900/50 px-1.5 py-0.5 rounded text-red-400 font-mono border border-red-800/50">T</kbd></div>
                <div className="flex justify-between items-center"><span>Force Status: B-ROLL</span><kbd className="bg-blue-900/50 px-1.5 py-0.5 rounded text-blue-400 font-mono border border-blue-800/50">B</kbd></div>
                <div className="w-full h-px bg-slate-800 my-1" />
                <div className="flex justify-between items-center"><span>Zoom (Ctrl+Scroll)</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">⌃ + Scroll</kbd></div>
              </div>
            </div>
          )}
        </div>

        <span>{formatTime(duration)}</span>
      </div>

      {/* ── Track ─────────────────────────────────────────────────────────── */}
      <div
        ref={trackRef}
        className="relative w-full h-[64px] bg-slate-900 border border-slate-800 rounded-lg overflow-hidden cursor-pointer group shadow-inner"
        onClick={handleTimelineClick}
        onWheel={handleWheel}
      >
        {/* Static, non-zoomed background bar for the ruler labels area at the top */}
        <div className="absolute top-0 left-0 right-0 h-[24px] bg-black/75 border-b border-slate-800/80 z-[10] pointer-events-none" />

        {/* Inner scaled+panned div — all segments and zoomed labels live here */}
        <div
          className="absolute top-0 bottom-0 h-full z-[20]"
          style={{
            width: `${scale * 100}%`,
            transform: `translateX(-${panOffset}%)`,
          }}
        >
          {/* Zoomed Ruler Pills Container (rendered on top of static background bar) */}
          {duration > 0 && (
            <div className="absolute top-0 left-0 right-0 h-[24px] z-[26]">
              {timeline.map((clip) => {
                const constraints = userConstraints[clip.start.toString()] || [];

                // userConstraint pills (IN / OUT / BM-user / AUDIO)
                const constraintPills = constraints.map((constraint, cIdx) => {
                  const markerNum = markerNumbers.get(`${clip.start.toFixed(3)}_${cIdx}`);
                  const markerColor = MARKER_COLORS[constraint.type] ?? '#ffffff';
                  const typeLabel = constraint.type === 'IN' ? 'IN' : constraint.type === 'OUT' ? 'OUT' : constraint.type === 'BM' ? 'M' : 'A';
                  const leftPct = (constraint.time / duration) * 100;
                  return (
                    <button
                      key={`ruler-${clip.start}-${cIdx}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (videoRef.current) videoRef.current.currentTime = constraint.time;
                      }}
                      className="absolute bottom-1 -translate-x-1/2 flex items-center justify-center gap-[2px] px-1 py-0.5 rounded text-[7px] font-black font-mono cursor-pointer hover:brightness-125 transition-all"
                      style={{
                        left: `${leftPct}%`,
                        backgroundColor: `${markerColor}30`,
                        color: markerColor,
                        border: `1px solid ${markerColor}66`,
                      }}
                      title={`${typeLabel}${markerNum !== undefined ? markerNum : ''} — ${formatTime(constraint.time)} — click to seek`}
                    >
                      {typeLabel}{markerNum !== undefined ? markerNum : ''}
                    </button>
                  );
                });

                // Native BM pill (yellow best_moment)
                const bmPill = clip.best_moment && clip.best_moment > clip.start && clip.best_moment < clip.end ? (() => {
                  const leftPct = (clip.best_moment / duration) * 100;
                  return (
                    <button
                      key={`ruler-bm-${clip.start}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (videoRef.current) videoRef.current.currentTime = clip.best_moment as number;
                      }}
                      className="absolute bottom-1 -translate-x-1/2 flex items-center justify-center gap-[2px] px-1 py-0.5 rounded text-[7px] font-black font-mono cursor-pointer hover:brightness-125 transition-all"
                      style={{
                        left: `${leftPct}%`,
                        backgroundColor: '#eab30830',
                        color: '#eab308',
                        border: '1px solid #eab30866',
                      }}
                      title={`BM — ${formatTime(clip.best_moment as number)} — click to seek`}
                    >
                      BM
                    </button>
                  );
                })() : null;

                return [constraintPills, bmPill];
              })}
            </div>
          )}

          {/* Segments (shifted down by 24px) */}
          {timeline.map((clip, idx) => {
            const left = (clip.start / duration) * 100;
            const width = ((clip.end - clip.start) / duration) * 100;
            const override = clipOverrides[clip.start.toString()];
            const clipName = clip.clip_name ?? '';

            return (
              <div
                key={idx}
                className={`absolute top-[24px] bottom-0 border-r border-slate-950 transition-colors overflow-hidden ${getSegmentColor(clip.tag, clip.is_usable, override)}`}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`[${clip.tag}] ${clipName ? clipName + ' · ' : ''}${formatTime(clip.start)} - ${formatTime(clip.end)}`}
              >
                {/* Clip Label — Premiere-style hard clip, no ellipsis */}
                {clipName && (
                  <span className="absolute top-0 left-1 text-[9px] text-white font-light tracking-wide overflow-hidden whitespace-nowrap pointer-events-none z-[5] leading-tight pt-px">
                    {clipName}
                  </span>
                )}

                {/* Best Moment (BM) Native Indicator — clickable, seeks to best_moment */}
                {clip.best_moment && clip.best_moment > clip.start && clip.best_moment < clip.end && override !== 'TRASH' && (
                  <button
                    type="button"
                    className="absolute flex flex-col items-center z-10 cursor-pointer"
                    style={{
                      left: `${((clip.best_moment - clip.start) / (clip.end - clip.start)) * 100}%`,
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoRef.current) videoRef.current.currentTime = clip.best_moment as number;
                    }}
                    title={`Best Moment — ${(clip.best_moment as number).toFixed(2)}s`}
                  >
                    <div className="text-[12px] font-black drop-shadow-md text-yellow-400 hover:brightness-125 transition-all">
                      <svg width="7.5" height="10.5" viewBox="0 0 10 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
                        <path d="M0 0H10V10L5 14L0 10V0Z" />
                      </svg>
                    </div>
                  </button>
                )}
              </div>
            );
          })}

          {/* ── Marker Overlay — z-[20], above waveform, below playhead
               Each pin is clickable — seeks videoRef to the marker time. */}
          <div className="absolute top-[24px] bottom-0 left-0 right-0 z-[20] pointer-events-none">
            {timeline.map((clip) => {
              const constraints = userConstraints[clip.start.toString()] || [];
              return constraints.map((constraint, cIdx) => {
                const markerColor = MARKER_COLORS[constraint.type] ?? '#ffffff';
                // Absolute position within the inner (scaled) div
                const absoluteLeftPct = (constraint.time / duration) * 100;
                return (
                  <button
                    key={`${clip.start}-${cIdx}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoRef.current) videoRef.current.currentTime = constraint.time;
                    }}
                    className="absolute top-0 bottom-0 flex flex-col items-center cursor-pointer group/pin pointer-events-auto"
                    style={{
                      left: `${absoluteLeftPct}%`,
                      transform: 'translateX(-50%)',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                    }}
                  >
                    {/* Pin: colored line only, no label text (labels live in ruler bar above) */}
                    <div
                      className="w-px h-full pointer-events-none"
                      style={{
                        backgroundColor: markerColor,
                        boxShadow: `0 0 4px 1px ${markerColor}99`,
                      }}
                    />
                  </button>
                );
              });
            })}
          </div>

          {/* Hover overlay */}
          <div className="absolute top-[24px] bottom-0 left-0 right-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

          {/* Audio Waveform Overlay */}
          {audioWaveform.length > 0 && audioDuration > 0 && (() => {
            const pointsPerSecond = audioWaveform.length / audioDuration;
            const pointsToShow = Math.ceil(duration * pointsPerSecond);
            const visibleWaveform = audioWaveform.slice(0, pointsToShow);

            if (visibleWaveform.length === 0) return null;

            const svgWidth = 1000;
            const svgHeight = 100;
            const step = svgWidth / visibleWaveform.length;

            let pathD = `M 0,${svgHeight}`;
            visibleWaveform.forEach((val, i) => {
              const x = (i * step).toFixed(2);
              const y = (svgHeight - (val * svgHeight)).toFixed(2);
              pathD += ` L ${x},${y}`;
            });
            pathD += ` L ${svgWidth},${svgHeight} Z`;

            return (
              <div className="absolute top-[24px] bottom-0 left-0 right-0 opacity-40 pointer-events-none z-[15] mix-blend-screen overflow-hidden">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none" className="w-full h-full fill-emerald-400">
                  <path d={pathD} />
                </svg>
              </div>
            );
          })()}


          {/* Playhead — DC-style: SVG pentagon + thin centered line, white + dark glow */}
          <div
            ref={playheadRef}
            className="absolute top-[24px] bottom-0 z-[30] pointer-events-none flex flex-col items-center"
            style={{
              left: '0%',
              transform: 'translateX(-50%)',
            }}
          >
            {/* Thin pin line */}
            <div
              className="w-px flex-1"
              style={{
                backgroundColor: 'white',
                boxShadow: '0 0 5px 2px rgba(255,255,255,0.4), 0 0 1px 0px rgba(0,0,0,1)',
              }}
            />
            {/* Pentagon handle — pointing up */}
            <svg
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

      {/* ── Premiere-style Zoom Scrollbar ─────────────────────────────────── */}
      <div
        ref={scrollbarRef}
        className="relative w-full h-[10px] bg-slate-900/80 rounded-full cursor-pointer select-none border border-slate-800/60"
        onMouseDown={handleScrollbarMouseDown}
      >
        {/* Track fill indicator (dim background) */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          {/* Thumb */}
          <div
            className="absolute top-0 bottom-0 rounded-full bg-slate-500 hover:bg-slate-400 transition-colors"
            style={{
              left: `${zoomStart * 100}%`,
              width: `${zoomSpan * 100}%`,
              ...getThumbCursorStyle(),
            }}
          >
            {/* Left handle grip */}
            <div className="absolute left-0 top-0 bottom-0 w-[10px] rounded-l-full bg-slate-300/30 hover:bg-slate-200/50 transition-colors cursor-col-resize flex items-center justify-center">
              <div className="w-px h-3 bg-slate-200/60 rounded-full" />
            </div>
            {/* Right handle grip */}
            <div className="absolute right-0 top-0 bottom-0 w-[10px] rounded-r-full bg-slate-300/30 hover:bg-slate-200/50 transition-colors cursor-col-resize flex items-center justify-center">
              <div className="w-px h-3 bg-slate-200/60 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="flex gap-4 items-center justify-center text-[10px] uppercase font-bold tracking-wider text-slate-500">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500/80"></span> Valid (MAIN)</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500/80"></span> B-ROLL</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500/80"></span> Trash (Rejected)</div>
        {zoomSpan < 0.99 && (
          <button
            onClick={() => setZoomWindow([0, 1])}
            className="text-slate-500 hover:text-slate-300 transition-colors normal-case font-mono text-[9px] border border-slate-700 px-1.5 py-0.5 rounded"
          >
            Reset Zoom
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

