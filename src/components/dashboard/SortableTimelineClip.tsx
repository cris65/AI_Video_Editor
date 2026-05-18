import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FinalCutClip } from '../../hooks/usePancakeData';
import type { UserConstraint } from './PancakeDashboard';

interface SortableTimelineClipProps {
  id: string;
  clip: FinalCutClip;
  clipIndex: number;
  widthPct: number;
  nearestMarker: string | null;
  constraints: UserConstraint[];
}

export const SortableTimelineClip: React.FC<SortableTimelineClipProps> = ({
  id,
  clip,
  clipIndex,
  widthPct,
  nearestMarker,
  constraints,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    flex: `0 0 ${widthPct}%`,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.25 : 1,
    position: 'relative',
    touchAction: 'none',
    height: '100%',
  };

  let bgColor = 'bg-emerald-600';
  if (clip.role === 'PILLAR') bgColor = 'bg-amber-500';
  else if (clip.tag === 'B-ROLL') bgColor = 'bg-blue-500';

  const renderedMarkers: { type: string; pct: number; mIdx: number }[] = [];
  constraints.forEach((c, mIdx) => {
    if (c.type === 'BM' || c.type === 'IN' || c.type === 'OUT') {
      const relativePos =
        ((c.time - clip.source_in) / (clip.source_out - clip.source_in)) * 100;
      if (relativePos >= 0 && relativePos <= 100) {
        renderedMarkers.push({ type: c.type, pct: relativePos, mIdx });
      }
    }
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`${bgColor} border-r border-slate-900 opacity-80 hover:opacity-100 flex items-center justify-center cursor-grab active:cursor-grabbing z-10`}
      title={`[${clip.role}] ${clip.tag}`}
    >
      {renderedMarkers.map((marker, idx) => {
        const isClosest = nearestMarker === `${clipIndex}-${marker.mIdx}`;
        return (
          <div
            key={`marker-${idx}`}
            className={`absolute top-1/2 text-[12px] font-black pointer-events-none transition-all duration-150 ${
              isClosest
                ? 'drop-shadow-[0_0_5px_rgba(255,255,255,1)] z-30'
                : 'drop-shadow-md z-20'
            }`}
            style={{
              left: `${marker.pct}%`,
              transform: `translate(-50%, -50%) ${isClosest ? 'scale(1.3)' : 'scale(1)'}`,
              color:
                marker.type === 'IN'
                  ? '#3b82f6'
                  : marker.type === 'OUT'
                  ? '#a855f7'
                  : isClosest
                  ? '#fbbf24'
                  : '#ffffff',
            }}
          >
            {marker.type === 'IN' && '['}
            {marker.type === 'OUT' && ']'}
            {marker.type === 'BM' && (
              <svg
                width="7.5"
                height="10.5"
                viewBox="0 0 10 14"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-md"
              >
                <path d="M0 0H10V10L5 14L0 10V0Z" />
              </svg>
            )}
          </div>
        );
      })}
      {widthPct > 5 && renderedMarkers.length === 0 && (
        <span className="text-[10px] font-bold text-white/50 tracking-wider select-none pointer-events-none">
          {clip.role === 'PILLAR' ? 'PILLAR' : 'C'}
        </span>
      )}
    </div>
  );
};

// Static preview used by DragOverlay (no useSortable)
interface StaticClipPreviewProps {
  clip: FinalCutClip;
  widthPx: number;
}

export const StaticClipPreview: React.FC<StaticClipPreviewProps> = ({ clip, widthPx }) => {
  let bgColor = 'bg-emerald-600';
  if (clip.role === 'PILLAR') bgColor = 'bg-amber-500';
  else if (clip.tag === 'B-ROLL') bgColor = 'bg-blue-500';

  return (
    <div
      style={{ width: `${widthPx}px`, height: '48px' }}
      className={`${bgColor} rounded-sm opacity-95 shadow-2xl flex items-center justify-center border border-white/20`}
    >
      <span className="text-[10px] font-bold text-white/80 tracking-wider select-none">
        {clip.role === 'PILLAR' ? '⚓ PILLAR' : clip.tag === 'B-ROLL' ? '🎬 B-ROLL' : '✂️ CUT'}
      </span>
    </div>
  );
};
