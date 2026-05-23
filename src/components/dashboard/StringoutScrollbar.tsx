import React, { useRef, useCallback } from 'react';

const MIN_ZOOM_WINDOW = 0.04; // Minimum 4% of total duration visible
const HANDLE_SIZE_PX = 10;    // Draggable edge zone in pixels

type DragType = 'left' | 'right' | 'pan';

interface DragState {
  type: DragType;
  startX: number;
  startWindow: [number, number];
  barWidth: number;
  playheadFrac?: number;
  playheadScreenFrac?: number;
}

interface StringoutScrollbarProps {
  /** Current zoom window [startFraction, endFraction] of total duration [0, 1]. */
  zoomWindow: [number, number];
  setZoomWindow: (w: [number, number]) => void;
  /** Ref to the video element — playhead position is read from currentTime. */
  videoRef: React.RefObject<HTMLVideoElement>;
  /**
   * Total video duration in seconds (float, agnostic from FPS).
   * Used only for computing playheadFrac = currentTime / duration.
   */
  duration: number;
  /** Total timeline zoom span for the "Reset Zoom" button visibility. */
  zoomSpan: number;
}

/**
 * Premiere-style zoom scrollbar for the Stringout timeline.
 * Handles: pan drag, left-edge resize, right-edge resize, jump-click,
 * and a "Reset Zoom" button when zoomed in.
 *
 * FPS-AGNOSTIC: all calculations use duration (seconds float). No FPS constants.
 */
export const StringoutScrollbar: React.FC<StringoutScrollbarProps> = ({
  zoomWindow,
  setZoomWindow,
  videoRef,
  duration,
  zoomSpan,
}) => {
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);

  const [zoomStart] = zoomWindow;

  const getThumbCursorStyle = (): React.CSSProperties => {
    if (!dragStateRef.current) return {};
    if (dragStateRef.current.type === 'left' || dragStateRef.current.type === 'right') {
      return { cursor: 'col-resize' };
    }
    return { cursor: 'grabbing' };
  };

  const handleScrollbarMouseMove = useCallback((e: MouseEvent) => {
    const drag = dragStateRef.current;
    if (!drag) return;

    const delta = (e.clientX - drag.startX) / drag.barWidth;
    const [s0, e0] = drag.startWindow;

    let nextWindow: [number, number];

    if (drag.playheadFrac !== undefined && drag.playheadScreenFrac !== undefined) {
      const { playheadFrac, playheadScreenFrac } = drag;

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
        setZoomWindow([newS, newS + span]);
        return;
      }

      newSpan = Math.min(1, Math.max(MIN_ZOOM_WINDOW, newSpan));
      let newStart = playheadFrac - newSpan * playheadScreenFrac;
      newStart = Math.max(0, Math.min(newStart, 1 - newSpan));
      nextWindow = [newStart, newStart + newSpan];
    } else {
      if (drag.type === 'left') {
        const newS = Math.max(0, Math.min(s0 + delta, e0 - MIN_ZOOM_WINDOW));
        nextWindow = [newS, e0];
      } else if (drag.type === 'right') {
        const newE = Math.min(1, Math.max(e0 + delta, s0 + MIN_ZOOM_WINDOW));
        nextWindow = [s0, newE];
      } else {
        const span = e0 - s0;
        const newS = Math.max(0, Math.min(s0 + delta, 1 - span));
        nextWindow = [newS, newS + span];
      }
    }

    setZoomWindow(nextWindow);
  }, [setZoomWindow]);

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
    const thumbLeft = zoomWindow[0] * barWidth;
    const thumbRight = zoomWindow[1] * barWidth;
    const clickX = e.clientX - barRect.left;

    let type: DragType;

    if (Math.abs(clickX - thumbLeft) <= HANDLE_SIZE_PX) {
      type = 'left';
    } else if (Math.abs(clickX - thumbRight) <= HANDLE_SIZE_PX) {
      type = 'right';
    } else if (clickX >= thumbLeft && clickX <= thumbRight) {
      type = 'pan';
    } else {
      // Jump pan: center on click position
      const clickFrac = clickX / barWidth;
      const span = zoomWindow[1] - zoomWindow[0];
      const newS = Math.max(0, Math.min(clickFrac - span / 2, 1 - span));
      setZoomWindow([newS, newS + span]);
      return;
    }

    // Capture playhead state at drag start to anchor zoom dynamically
    const currentTime = videoRef.current ? videoRef.current.currentTime : 0;
    const playheadFrac = duration > 0 ? currentTime / duration : 0;
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

    document.body.style.cursor = type === 'pan' ? 'grabbing' : 'col-resize';
    window.addEventListener('mousemove', handleScrollbarMouseMove);
    window.addEventListener('mouseup', handleScrollbarMouseUp);
  }, [zoomWindow, setZoomWindow, handleScrollbarMouseMove, handleScrollbarMouseUp, duration, videoRef]);

  return (
    <div className="mt-1 px-0 flex flex-col gap-1">
      {/* ── Premiere-style thumb scrollbar ─────────────────────────────────── */}
      <div
        ref={scrollbarRef}
        className="relative w-full h-[10px] bg-slate-900/80 rounded-full cursor-pointer select-none border border-slate-800/60"
        onMouseDown={handleScrollbarMouseDown}
      >
        <div className="absolute inset-0 rounded-full overflow-hidden">
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

    </div>
  );
};

