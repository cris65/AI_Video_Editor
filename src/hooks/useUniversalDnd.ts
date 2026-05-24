import { useState, useMemo, useCallback } from 'react';
import { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { UniversalClip } from '../types/UniversalClip';
import type { PancakeClip } from './usePancakeData';

interface UseUniversalDndOptions {
  mode: 'stringout' | 'director_cut';
  clips: UniversalClip[];
  
  // stringout-specific
  globalTimeline?: PancakeClip[];
  onSaveStringoutOrder?: (validClips: PancakeClip[]) => void;
  
  // director_cut-specific
  onDirectExportDC?: (newOrderedClips?: UniversalClip[]) => void;
}

export function useUniversalDnd({
  mode,
  clips,
  globalTimeline,
  onSaveStringoutOrder,
  onDirectExportDC
}: UseUniversalDndOptions) {
  // We keep an optimistic ID array for immediate rendering during/after drag
  const [optimisticIds, setOptimisticIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Keep optimisticIds in sync when upstream clips change
  useMemo(() => {
    setOptimisticIds(clips.map(c => c.id));
  }, [clips]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOptimisticIds((items) => {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      const newOrder = arrayMove(items, oldIndex, newIndex);

      if (mode === 'stringout' && globalTimeline && onSaveStringoutOrder) {
        // Stringout mode: Reorder global timeline and trigger full save
        const orderedGlobal = newOrder.map(id => globalTimeline.find(c => c.start.toString() === id)!);
        onSaveStringoutOrder(orderedGlobal);
      } else if (mode === 'director_cut' && onDirectExportDC) {
        // DC mode: Reorder UniversalClip[] directly and trigger bypass LLM
        const orderedDC = newOrder.map(id => clips.find(c => c.id === id)!);
        onDirectExportDC(orderedDC);
      }

      return newOrder;
    });
  }, [mode, globalTimeline, clips, onSaveStringoutOrder, onDirectExportDC]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  // Compute the visually sorted display clips
  const sortableItems = optimisticIds;
  const displayClips = useMemo(() => {
    let result = optimisticIds.map(id => clips.find(c => c.id === id)!).filter(Boolean);

    // Universal Ripple Edit: pack clips gapless for ALL modes (DRY — UI-006)
    let cursor = 0;
    result = result.map(clip => {
      const duration = clip.sourceEnd - clip.sourceStart;
      const newClip = {
        ...clip,
        displayStart: cursor,
        displayEnd: cursor + duration
      };
      cursor += duration;
      return newClip;
    });

    return result;
  }, [clips, optimisticIds]);

  // Map for 1-based badges (SO mode only, ignores trash)
  const exportOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    if (mode === 'director_cut') return map;
    
    let counter = 1;
    for (const id of optimisticIds) {
      const clip = clips.find(c => c.id === id);
      if (clip && !clip.isTrash) {
        map.set(id, counter++);
      }
    }
    return map;
  }, [optimisticIds, clips, mode]);

  return {
    activeId,
    sortableItems,
    displayClips,
    exportOrderMap,
    handleDragStart,
    handleDragEnd,
    handleDragCancel
  };
}
