import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableTimelineClipProps {
  id: string;
  left: number;
  width: number;
  colorClass: string;
  label: string;
  bmOffsetPct?: number;
  badge?: React.ReactNode;
}

export const SortableTimelineClip: React.FC<SortableTimelineClipProps> = ({
  id,
  left,
  width,
  colorClass,
  label,
  bmOffsetPct,
  badge
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${left}%`,
    width: `${width}%`,
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 10,
    opacity: isDragging ? 0.3 : 1,
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`h-full rounded-sm relative cursor-grab active:cursor-grabbing border-r border-slate-900 ${colorClass}`}
      title={label}
    >
      {badge && (
        <div className="absolute top-0.5 right-0.5 flex gap-0.5 pointer-events-none z-10">
          {badge}
        </div>
      )}
      {width > 2 && (
        <span className="absolute top-0 left-1 text-[9px] text-white font-light tracking-wide overflow-hidden whitespace-nowrap pointer-events-none z-[5] leading-tight pt-px">
          {label}
        </span>
      )}
      {bmOffsetPct !== undefined && (
        <div
          className="absolute flex flex-col items-center z-10 pointer-events-none"
          style={{
            left: `${bmOffsetPct}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="text-[12px] font-black drop-shadow-md text-yellow-400">
            <svg width="7.5" height="10.5" viewBox="0 0 10 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
              <path d="M0 0H10V10L5 14L0 10V0Z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

