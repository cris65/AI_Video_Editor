import React, { useMemo, useState, useCallback, useRef } from 'react';
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
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import type { FinalCutClip } from '../../hooks/usePancakeData';
import type { UserConstraint } from './PancakeDashboard';
import { SortableTimelineClip, StaticClipPreview } from './SortableTimelineClip';
import { Save } from 'lucide-react';

interface Props {
  timeline: FinalCutClip[];
  currentTime: number;
  onSeek: (time: number) => void;
  onReorder: (newTimeline: FinalCutClip[]) => void;
  onSaveOrder: () => void;
  userConstraints?: Record<string, UserConstraint[]>;
  audioWaveform?: number[];
  audioDuration?: number;
}

export const FinalCutTimeline: React.FC<Props> = ({
  timeline,
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

  // LAW 10: MouseSensor + TouchSensor only. No PointerSensor.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

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

      onReorder(arrayMove(timeline, oldIndex, newIndex));
    },
    [timeline, onReorder]
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
    return trackRef.current.clientWidth * widthPct;
  }, [activeDragClip, totalDuration]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  if (!timeline.length) return null;

  return (
    <div className="w-full bg-slate-900 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
      {/* Header row */}
      <div className="flex justify-between items-center text-xs text-slate-400 font-mono font-medium">
        <span className="text-blue-400 font-bold">{formatTime(currentTime)}</span>
        <span className="text-amber-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          DIRECTOR&apos;S CUT PREVIEW
        </span>
        <div className="flex items-center gap-3">
          <span>{totalDuration.toFixed(1)}s</span>
          <button
            onClick={onSaveOrder}
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
      >
        {/* Outer wrapper: relative for playhead + waveform overlays */}
        <div
          ref={trackRef}
          className="relative h-12 w-full bg-slate-800 rounded-md overflow-hidden shadow-inner cursor-pointer"
          onClick={handleTimelineClick}
        >
          {/* FLEX CLIP TRACK — replaces absolute-positioned clips */}
          <SortableContext items={items} strategy={horizontalListSortingStrategy}>
            <div className="flex flex-row h-full w-full">
              {timeline.map((clip, i) => {
                const widthPct =
                  totalDuration > 0
                    ? ((clip.timeline_out - clip.timeline_in) / totalDuration) * 100
                    : 0;

                let constraints: UserConstraint[] = [];
                for (const key of Object.keys(userConstraints)) {
                  if (Math.abs(parseFloat(key) - clip.source_clip_start) < 0.1) {
                    constraints = userConstraints[key];
                    break;
                  }
                }

                return (
                  <SortableTimelineClip
                    key={`${clip.source_clip_start}_${clip.source_in}`}
                    id={`${clip.source_clip_start}_${clip.source_in}`}
                    clip={clip}
                    clipIndex={i}
                    widthPct={widthPct}
                    nearestMarker={nearestMarker}
                    constraints={constraints}
                  />
                );
              })}
            </div>
          </SortableContext>

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

        {/* DragOverlay — Anti-Rubber-Band (dropAnimation null), renders in portal */}
        <DragOverlay dropAnimation={null}>
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
