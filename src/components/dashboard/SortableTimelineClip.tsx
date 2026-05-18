import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FinalCutClip } from '../../hooks/usePancakeData';

interface SortableTimelineClipProps {
  id: string;
  clip: FinalCutClip;
  widthPct: number;
  seqLabel: string;
  isMoved?: boolean;
}

export const SortableTimelineClip: React.FC<SortableTimelineClipProps> = ({
  id,
  clip,
  widthPct,
  seqLabel,
  isMoved = false,
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


  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`${bgColor} flex items-center justify-center cursor-grab active:cursor-grabbing relative transition-all duration-300 ${
        isMoved 
          ? 'z-10 opacity-60 before:absolute before:inset-0 before:bg-black/60 before:shadow-[inset_0_0_8px_rgba(255,255,255,0.8)] before:pointer-events-none border-transparent' 
          : 'border-r border-slate-900 z-10'
      }`}
      title={`[${clip.role}] ${clip.tag}`}
    >
      {widthPct > 4 && (
        <span className="text-[10px] font-bold text-white/70 tracking-wider select-none pointer-events-none font-mono">
          {seqLabel}
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
