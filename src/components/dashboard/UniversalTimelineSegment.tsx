import React from 'react';
import { SortableTimelineClip } from './SortableTimelineClip';
import type { UniversalClip } from '../../types/UniversalClip';

interface UniversalTimelineSegmentProps {
  clip: UniversalClip;
  mode: 'stringout' | 'director_cut';
  totalDuration: number;
}

export const UniversalTimelineSegment: React.FC<UniversalTimelineSegmentProps> = ({
  clip,
  mode,
  totalDuration
}) => {
  const left = (clip.displayStart / totalDuration) * 100;
  const width = ((clip.displayEnd - clip.displayStart) / totalDuration) * 100;
  
  const bmOffsetPct = clip.bestMoment !== undefined && clip.sourceEnd > clip.sourceStart 
    ? ((clip.bestMoment - clip.sourceStart) / (clip.sourceEnd - clip.sourceStart)) * 100 
    : undefined;

  return (
    <SortableTimelineClip
      id={clip.id}
      left={left}
      width={width}
      colorClass={clip.colorClass}
      label={clip.label ?? ''}
      bmOffsetPct={bmOffsetPct}
      // Mode-specific badges
      badge={mode === 'director_cut' ? (
        clip.isLocked ? (
          <span className="bg-blue-600 text-white px-1 py-0.5 rounded text-[8px] font-bold">L</span>
        ) : clip.isMoved ? (
          <span className="bg-orange-500 text-white px-1 py-0.5 rounded text-[8px] font-bold">M</span>
        ) : undefined
      ) : undefined}
    />
  );
};
