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
  isLocked?: boolean;
}

export const SortableTimelineClip: React.FC<SortableTimelineClipProps> = ({
  id,
  clip,
  widthPct,
  seqLabel,
  isMoved = false,
  isLocked = false,
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

  // Color hierarchy: locked (manual human anchor) > pillar > b-roll > filler
  let bgColor = 'bg-emerald-600';
  if (isLocked) bgColor = 'bg-blue-600';
  else if (clip.role === 'PILLAR') bgColor = 'bg-amber-500';
  else if (clip.tag === 'B-ROLL') bgColor = 'bg-blue-500';

  const lockedGlow = isLocked
    ? 'shadow-[inset_0_0_0_1px_rgba(96,165,250,0.8),0_0_8px_rgba(59,130,246,0.5)]'
    : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`${bgColor} ${lockedGlow} flex items-center justify-center cursor-grab active:cursor-grabbing relative transition-all duration-300 ${
        isMoved && !isLocked
          ? 'z-10 opacity-60 before:absolute before:inset-0 before:bg-black/60 before:shadow-[inset_0_0_8px_rgba(255,255,255,0.8)] before:pointer-events-none border-transparent'
          : 'border-r border-slate-900 z-10'
      }`}
      title={`${isLocked ? '🔒 LOCKED — ' : ''}[${clip.role}] ${clip.tag}`}
    >
      {/* Lock badge — top-right corner on locked clips */}
      {isLocked && (
        <span
          className="absolute top-0.5 right-0.5 text-[9px] leading-none pointer-events-none select-none"
          aria-label="Locked clip"
        >
          🔒
        </span>
      )}
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
  if (clip.locked) bgColor = 'bg-blue-600';
  else if (clip.role === 'PILLAR') bgColor = 'bg-amber-500';
  else if (clip.tag === 'B-ROLL') bgColor = 'bg-blue-500';

  return (
    <div
      style={{ width: `${widthPx}px`, height: '48px' }}
      className={`${bgColor} rounded-sm opacity-95 shadow-2xl flex items-center justify-center border border-white/20`}
    >
      <span className="text-[10px] font-bold text-white/80 tracking-wider select-none">
        {clip.locked
          ? '🔒 LOCKED'
          : clip.role === 'PILLAR'
          ? '⚓ PILLAR'
          : clip.tag === 'B-ROLL'
          ? '🎬 B-ROLL'
          : '✂️ CUT'}
      </span>
    </div>
  );
};
