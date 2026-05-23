export interface UniversalClip {
  id: string;             // clip.start.toString() (SO) | `${source_clip_start}_${source_in}` (DC)
  displayStart: number;   // clip.start (SO) | clip.timeline_in (DC)
  displayEnd: number;     // clip.end (SO) | clip.timeline_out (DC)
  colorClass: string;     // getSegmentColor() resolved by Dashboard
  label?: string;         // clip_name (SO) | seqLabel P#/F# (DC)
  isLocked?: boolean;     // false (SO) | clip.locked (DC)
  isMoved?: boolean;      // false (SO) | manuallyMovedIds.has(id) (DC)
  bestMoment?: number;    // clip.best_moment (SO) | undefined (DC)
  isTrash?: boolean;      // mapped from usability or TRASH override
  // Raw source mapping for constraints, waveform, and pin overlay
  sourceStart: number;    // clip.start (SO) | clip.source_in (DC)
  sourceEnd: number;      // clip.end (SO) | clip.source_out (DC)
  sourceClipStart: number;// clip.start (SO) | clip.source_clip_start (DC)
}
