import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  Modifier,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import type { FinalCutClip } from '../../hooks/usePancakeData';
import type { UserConstraint } from './PancakeDashboard';
import { SortableTimelineClip, StaticClipPreview } from './SortableTimelineClip';
import { Save, Info } from 'lucide-react';

interface Props {
  timeline: FinalCutClip[];
  originalTimeline: FinalCutClip[]; // Immutable Gemma source — used for stable P#/F# labels
  markerNumbers: Map<string, number>; // Global M# from PancakeDashboard (Stringout-first namespace)
  currentTime: number;
  onSeek: (time: number) => void;
  onReorder: (newTimeline: FinalCutClip[], seekToTimelineIn?: number) => void;
  onSaveOrder: () => void;
  userConstraints?: Record<string, UserConstraint[]>;
  audioWaveform?: number[];
  audioDuration?: number;
}

export const FinalCutTimeline: React.FC<Props> = ({
  timeline,
  originalTimeline,
  markerNumbers,
  currentTime,
  onSeek,
  onReorder,
  onSaveOrder,
  userConstraints = {},
  audioWaveform = [],
  audioDuration = 0,
}) => {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [zoomFactor, setZoomFactor] = useState<number>(1);

  // Track IDs of clips explicitly dragged by the user
  const [manuallyMovedIds, setManuallyMovedIds] = useState<Set<string>>(new Set());

  // Clear tracking when the original timeline updates (e.g. after SAVE ORDER)
  useEffect(() => {
    setManuallyMovedIds(new Set());
  }, [originalTimeline]);

  // LAW 10: MouseSensor + TouchSensor only. No PointerSensor.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const handleSaveClick = () => {
    setManuallyMovedIds(new Set());
    if (onSaveOrder) onSaveOrder();
  };

  const totalDuration = useMemo(() => {
    if (!timeline.length) return 0;
    return timeline[timeline.length - 1].timeline_out;
  }, [timeline]);

  // Stable IDs based on source properties (invariant across reorders)
  const items = useMemo(
    () => timeline.map(clip => `${clip.source_clip_start}_${clip.source_in}`),
    [timeline]
  );

  // Nearest marker to currentTime (drives highlight glow)
  const nearestMarker = useMemo(() => {
    let closestId: string | null = null;
    let minDiff = 0.5;
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

  // Zoom via Ctrl+Scroll
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoomFactor((prev) => {
          let next = prev - e.deltaY * 0.01;
          return Math.max(1, Math.min(50, next));
        });
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Playhead Tracking Auto-Scroll
  useEffect(() => {
    if (activeDragId !== null) return;
    const container = scrollContainerRef.current;
    if (!container || totalDuration === 0) return;
    
    const playheadPct = currentTime / totalDuration;
    const playheadPx = playheadPct * container.scrollWidth;
    
    const viewportWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;
    
    // Dead zone: 30% to 70% of the visible viewport
    const leftBound = scrollLeft + viewportWidth * 0.3;
    const rightBound = scrollLeft + viewportWidth * 0.7;
    
    if (playheadPx > rightBound) {
      container.scrollLeft = playheadPx - viewportWidth * 0.7;
    } else if (playheadPx < leftBound) {
      container.scrollLeft = playheadPx - viewportWidth * 0.3;
    }
  }, [currentTime, totalDuration, activeDragId]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      // Functional arrayMove — pure, no stale closure risk
      const oldIndex = timeline.findIndex(
        c => `${c.source_clip_start}_${c.source_in}` === String(active.id)
      );
      const newIndex = timeline.findIndex(
        c => `${c.source_clip_start}_${c.source_in}` === String(over.id)
      );
      if (oldIndex === -1 || newIndex === -1) return;

      const oldClip = timeline[oldIndex];
      const offset = (currentTime >= oldClip.timeline_in && currentTime <= oldClip.timeline_out)
        ? (currentTime - oldClip.timeline_in)
        : 0.01;

      // Traccia la clip esplicitamente mossa
      setManuallyMovedIds(prev => {
        const next = new Set(prev);
        next.add(String(active.id));
        return next;
      });

      const newTimeline = arrayMove(timeline, oldIndex, newIndex);

      // Sposta la playhead alla nuova posizione mantenendo l'offset relativo se eravamo sulla clip
      let newTimelineIn = 0;
      for (let i = 0; i < newIndex; i++) {
        const c = newTimeline[i];
        newTimelineIn += (c.source_out - c.source_in);
      }
      
      onReorder(newTimeline, newTimelineIn + offset);
    },
    [timeline, currentTime, onReorder]
  );

  // Anti-seek guard: disabled during active drag
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (activeDragId !== null) return;
      if (totalDuration === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      onSeek(percentage * totalDuration);
    },
    [activeDragId, totalDuration, onSeek]
  );

  // Clip being dragged (for DragOverlay preview)
  const activeDragClip = useMemo(
    () =>
      activeDragId
        ? (timeline.find(
            c => `${c.source_clip_start}_${c.source_in}` === activeDragId
          ) ?? null)
        : null,
    [activeDragId, timeline]
  );

  // Pixel width of the dragged clip for DragOverlay sizing
  const activeDragWidthPx = useMemo(() => {
    if (!activeDragClip || totalDuration === 0 || !trackRef.current) return 0;
    const widthPct = (activeDragClip.timeline_out - activeDragClip.timeline_in) / totalDuration;
    const rawWidth = trackRef.current.clientWidth * widthPct;
    return Math.min(rawWidth, 350); // MAX-WIDTH clamp per UX su timeline super-zoomate
  }, [activeDragClip, totalDuration]);

  // Centra il DragOverlay esattamente sotto il puntatore del mouse calcolando la posizione reale
  const snapToCursorModifier: Modifier = useCallback(
    ({ transform, activeNodeRect, activatorEvent }) => {
      if (!activeNodeRect || !activatorEvent) {
        return transform;
      }

      let initialX = 0;
      let initialY = 0;

      if ('touches' in activatorEvent && (activatorEvent as TouchEvent).touches.length > 0) {
        initialX = (activatorEvent as TouchEvent).touches[0].clientX;
        initialY = (activatorEvent as TouchEvent).touches[0].clientY;
      } else if ('clientX' in activatorEvent && 'clientY' in activatorEvent) {
        initialX = (activatorEvent as MouseEvent).clientX;
        initialY = (activatorEvent as MouseEvent).clientY;
      } else {
        return transform;
      }

      const currentX = initialX + transform.x;
      const currentY = initialY + transform.y;

      return {
        ...transform,
        x: currentX - activeNodeRect.left - (activeDragWidthPx / 2),
        y: currentY - activeNodeRect.top - 24, // 24px = metà altezza (h-12 = 48px)
      };
    },
    [activeDragWidthPx]
  );

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const [isPopupOpen, setIsPopupOpen] = useState(false);

  if (!timeline.length) return null;

  return (
    <div className="w-full bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
      {/* Header row */}
      <div className="flex justify-between items-center text-xs text-slate-400 font-mono font-medium relative">
        <span className="text-blue-400 font-bold">{formatTime(currentTime)}</span>
        
        {/* Info Popup - Ora con click e posizionato in alto */}
        <div className="relative flex items-center justify-center">
          <button 
            onClick={() => setIsPopupOpen(!isPopupOpen)}
            className="text-amber-500 flex items-center gap-2 hover:text-amber-400 transition-colors focus:outline-none"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            DIRECTOR&apos;S CUT PREVIEW
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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-2">
            <span className="text-[9px] uppercase tracking-widest text-slate-500">Zoom</span>
            <input
              type="range"
              min="1"
              max="50"
              step="0.1"
              value={zoomFactor}
              onChange={(e) => setZoomFactor(parseFloat(e.target.value))}
              className="w-20 accent-emerald-500 cursor-ew-resize"
              title="Ctrl + Scroll"
            />
            <span className="text-[10px] text-slate-400 w-6">{Math.round(zoomFactor)}x</span>
          </div>
          <span className="text-[10px] text-slate-400">{totalDuration.toFixed(1)}s</span>
          <button
            onClick={handleSaveClick}
            className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-md transition-colors text-[10px] font-bold tracking-wider"
            title="Salva l'ordine corrente nel file HITL (clip_order_override)"
          >
            <Save size={10} />
            SAVE ORDER
          </button>
        </div>
      </div>

      {/* DnD Context wraps only the track area */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        autoScroll={true}
      >
        {/* Layer 1: Scroll Container */}
        <div
          ref={scrollContainerRef}
          className="w-full overflow-x-auto overflow-y-hidden rounded-md shadow-inner bg-slate-800 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
        >
          {/* Layer 2: Zoom Container */}
          <div
            ref={trackRef}
            className="relative h-12 bg-slate-800 cursor-pointer"
            style={{ width: `${zoomFactor * 100}%`, minWidth: '100%' }}
            onClick={handleTimelineClick}
          >
            {/* Layer 3: FLEX CLIP TRACK — replaces absolute-positioned clips */}
            <SortableContext items={items} strategy={horizontalListSortingStrategy}>
              <div className="flex flex-row h-full w-full">
              {timeline.map((clip) => {
                const widthPct =
                  totalDuration > 0
                    ? ((clip.timeline_out - clip.timeline_in) / totalDuration) * 100
                    : 0;

                // Stable label: look up position in ORIGINAL Gemma order (immutable)
                const origIdx = originalTimeline.findIndex(
                  c => Math.abs(c.source_clip_start - clip.source_clip_start) < 0.1
                    && Math.abs(c.source_in - clip.source_in) < 0.01
                );
                let pCount = 0; let fCount = 0;
                for (let k = 0; k <= origIdx && k < originalTimeline.length; k++) {
                  if (originalTimeline[k].role === 'PILLAR') pCount++;
                  else fCount++;
                }
                const seqLabel = clip.role === 'PILLAR' ? `P${pCount}` : `F${fCount}`;
                
                const clipId = `${clip.source_clip_start}_${clip.source_in}`;
                const isMoved = manuallyMovedIds.has(clipId);

                return (
                  <SortableTimelineClip
                    key={clipId}
                    id={clipId}
                    clip={clip}
                    widthPct={widthPct}
                    seqLabel={seqLabel}
                    isMoved={isMoved}
                  />
                );
              })}
            </div>
          </SortableContext>

          {/* MARKER OVERLAY — z-[20]: above waveform (z-[15]), below playhead (z-[25]).
              Markers positioned absolutely on the TRACK. markerNumbers from PancakeDashboard
              (Stringout-first namespace): key = `${clip.start.toFixed(3)}_${mIdx}`. */}
          <div className="absolute inset-0 z-[20] pointer-events-none">
            {timeline.map((clip, cIdx) => {
              const clipStartPct = totalDuration > 0 ? (clip.timeline_in / totalDuration) * 100 : 0;
              const clipWidthPct = totalDuration > 0 ? ((clip.timeline_out - clip.timeline_in) / totalDuration) * 100 : 0;

              let constraints: UserConstraint[] = [];
              for (const key of Object.keys(userConstraints)) {
                if (Math.abs(parseFloat(key) - clip.source_clip_start) < 0.1) {
                  constraints = userConstraints[key];
                  break;
                }
              }

              return constraints.map((c, mIdx) => {
                if (c.type !== 'BM' && c.type !== 'IN' && c.type !== 'OUT') return null;
                const relativePos = (clip.source_out - clip.source_in) > 0
                  ? ((c.time - clip.source_in) / (clip.source_out - clip.source_in))
                  : 0;
                if (relativePos < 0 || relativePos > 1) return null;
                const absoluteLeftPct = clipStartPct + relativePos * clipWidthPct;
                const isClosest = nearestMarker === `${cIdx}-${mIdx}`;
                // Lookup via Stringout-aligned key: source_clip_start matches clip.start
                const markerNum = markerNumbers.get(`${clip.source_clip_start.toFixed(3)}_${mIdx}`);
                return (
                  <div
                    key={`overlay-marker-${cIdx}-${mIdx}`}
                    className="absolute flex flex-col items-center pointer-events-none"
                    style={{
                      left: `${absoluteLeftPct}%`,
                      top: '50%',
                      transform: `translate(-50%, -50%) ${isClosest ? 'scale(1.3)' : 'scale(1)'}`,
                      transition: 'transform 150ms',
                    }}
                  >
                    {/* Marker icon */}
                    <div
                      className={`text-[12px] font-black transition-all duration-150 ${
                        isClosest ? 'drop-shadow-[0_0_5px_rgba(255,255,255,1)]' : 'drop-shadow-md'
                      }`}
                      style={{
                        color:
                          c.type === 'IN' ? '#3b82f6'
                          : c.type === 'OUT' ? '#a855f7'
                          : isClosest ? '#fbbf24' : '#ffffff',
                      }}
                    >
                      {c.type === 'IN' && '['}
                      {c.type === 'OUT' && ']'}
                      {c.type === 'BM' && (
                        <svg width="7.5" height="10.5" viewBox="0 0 10 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
                          <path d="M0 0H10V10L5 14L0 10V0Z" />
                        </svg>
                      )}
                    </div>
                    {/* M# label — 9px, visible above the track center */}
                    {markerNum !== undefined && (
                      <span
                        className="text-[9px] font-bold font-mono leading-none mt-[2px]"
                        style={{
                          color: isClosest ? '#fbbf24' : 'rgba(255,255,255,0.85)',
                          textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                        }}
                      >
                        M{markerNum}
                      </span>
                    )}
                  </div>
                );
              });
            })}
          </div>

          {/* Audio Waveform Overlay — pointer-events-none, non-participant in DnD */}
          {audioWaveform.length > 0 && audioDuration > 0 && (() => {
            const pointsPerSecond = audioWaveform.length / audioDuration;
            const pointsToShow = Math.ceil(totalDuration * pointsPerSecond);
            const visibleWaveform = audioWaveform.slice(0, pointsToShow);
            if (visibleWaveform.length === 0) return null;
            const svgW = 1000;
            const svgH = 100;
            const step = svgW / visibleWaveform.length;
            let pathD = `M 0,${svgH}`;
            visibleWaveform.forEach((val, idx) => {
              pathD += ` L ${(idx * step).toFixed(2)},${(svgH - val * svgH).toFixed(2)}`;
            });
            pathD += ` L ${svgW},${svgH} Z`;
            return (
              <div className="absolute inset-0 opacity-40 pointer-events-none z-[15] mix-blend-screen overflow-hidden">
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  preserveAspectRatio="none"
                  className="w-full h-full fill-emerald-400"
                >
                  <path d={pathD} />
                </svg>
              </div>
            );
          })()}

          {/* Premiere-style Playhead — z-[25], pointer-events-none, RAF-driven via prop */}
          <div
            className="absolute top-0 bottom-0 z-[25] pointer-events-none transition-all duration-75 ease-linear flex flex-col items-center"
            style={{
              left: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <svg
              width="11"
              height="12"
              viewBox="0 0 11 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-blue-500 drop-shadow-[0_0_4px_rgba(59,130,246,0.8)]"
            >
              <path d="M0 0H11V6L5.5 12L0 6V0Z" fill="currentColor" />
            </svg>
            <div className="w-[2px] h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,1)]" />
          </div>
          </div>
        </div>

        {/* DragOverlay — Anti-Rubber-Band (dropAnimation null), renders in portal */}
        <DragOverlay dropAnimation={null} modifiers={[snapToCursorModifier]}>
          {activeDragClip ? (
            <StaticClipPreview clip={activeDragClip} widthPx={activeDragWidthPx} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Legend */}
      <div className="flex gap-4 mt-1 text-[10px] font-mono text-slate-500 justify-center">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-amber-500 rounded" /> PILLARS (BM)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-emerald-600 rounded" /> FILLER (MAIN)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-blue-500 rounded" /> FILLER (B-ROLL)
        </span>
      </div>
    </div>
  );
};
