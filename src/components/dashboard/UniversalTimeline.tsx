import React, { useRef, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay, closestCenter } from '@dnd-kit/core';
import { useUniversalDnd } from '../../hooks/useUniversalDnd';
import { useTimelineModifiers } from '../../hooks/useTimelineModifiers';
import { UniversalTimelineHeader } from './UniversalTimelineHeader';
import { UniversalTimelineTrack } from './UniversalTimelineTrack';
import { UniversalTimelineSegment } from './UniversalTimelineSegment';
import { StringoutScrollbar } from './StringoutScrollbar';
import type { UniversalClip } from '../../types/UniversalClip';
import type { PancakeClip } from '../../hooks/usePancakeData';

interface UniversalTimelineProps {
  mode: 'stringout' | 'director_cut';
  clips: UniversalClip[];
  // Shared
  videoRef: React.RefObject<HTMLVideoElement>;
  duration: number;
  userConstraints: Record<string, Array<{ type: 'IN' | 'OUT' | 'BM' | 'AUDIO'; time: number }>>;
  hiddenMarkers: string[];
  toggleMarkerVisibility: (type: string) => void;
  // RAF playhead
  virtualTimeRef?: React.MutableRefObject<number>;
  // Mode specific overrides
  globalTimeline?: PancakeClip[]; // SO only
  onSaveStringoutOrder?: (validClips: PancakeClip[]) => void; // SO only
  dcActions?: { // DC only
    onBookendStart: () => void;
    onBookendEnd: () => void;
    onLockToggle: () => void;
    onDirectExportDC: (newOrderedClips?: UniversalClip[]) => void;
    onSeek: (time: number) => void;
  };
  // Audio
  audioWaveforms?: { amplitude: number[], energy: number[] } | null;
  waveformView?: 'amplitude' | 'energy';
  setWaveformView?: (view: 'amplitude' | 'energy') => void;
  audioDuration?: number;
  audioBeats?: { time: number; energy: number; type: string }[];
  audioBpm?: number | null;
  markerNumbers?: Map<string, number>;
  audioMarkerFilters?: { types: string[]; minEnergy: number };
  setAudioMarkerFilters?: (filters: { types: string[]; minEnergy: number }) => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

export function UniversalTimeline(props: UniversalTimelineProps) {
  const { mode, clips, videoRef, duration, userConstraints, virtualTimeRef, hiddenMarkers, toggleMarkerVisibility } = props;
  
  // Total timeline duration (visual bounds)
  const totalDuration = mode === 'stringout' 
    ? duration 
    : (clips.length > 0 ? clips[clips.length - 1].displayEnd : duration);

  // States
  const playheadRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomWindow, setZoomWindow] = useState<[number, number]>([0, 1]);
  const [showShortcutsPopup, setShowShortcutsPopup] = useState(false);
  const [currentTimeFormatted, setCurrentTimeFormatted] = useState('00:00.00');

  // Absolute drag tracking to prevent state batching drift
  const panDragRef = useRef<{ startX: number; startWindow: [number, number] } | null>(null);
  const scrubDragRef = useRef<{ startX: number; startWindow: [number, number]; startAbsoluteFrac: number } | null>(null);
  const lastClickTimeRef = useRef<number>(0);

  const { isModifying, keysDownRef } = useTimelineModifiers();

  // ─── P/L Modifiers Mouse Move Logic ───────────────────────────────────────
  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const isP = keysDownRef.current.has('KeyP');
    const isL = keysDownRef.current.has('KeyL');

    if (isP && isL) {
      panDragRef.current = null; // Clear pan if they switch to scrub
      const track = containerRef.current;
      if (!track || !videoRef.current) return;
      
      if (!scrubDragRef.current) {
        const currentAbsoluteFrac = (mode === 'director_cut' && virtualTimeRef ? virtualTimeRef.current : videoRef.current.currentTime) / totalDuration;
        scrubDragRef.current = {
          startX: e.clientX,
          startWindow: [...zoomWindow],
          startAbsoluteFrac: currentAbsoluteFrac
        };
        return;
      }
      
      const drag = scrubDragRef.current;
      const deltaX = e.clientX - drag.startX;
      if (deltaX === 0) return;
      
      const rect = track.getBoundingClientRect();
      const span = drag.startWindow[1] - drag.startWindow[0];
      const deltaFrac = (-deltaX / rect.width) * span;
      
      const newAbsoluteFrac = Math.max(0, Math.min(drag.startAbsoluteFrac + deltaFrac, 1));
      const newS = Math.max(0, Math.min(drag.startWindow[0] + deltaFrac, 1 - span));
      
      // Update DOM synchronously to prevent 1-frame wobble
      flushSync(() => {
        setZoomWindow([newS, newS + span]);
      });
      
      const newTime = newAbsoluteFrac * totalDuration;
      if (mode === 'director_cut' && virtualTimeRef) {
        virtualTimeRef.current = newTime;
      } else if (videoRef.current) {
        videoRef.current.currentTime = newTime;
      }
      
      // Manually update playhead DOM instantly in the same paint cycle
      if (playheadRef.current && totalDuration > 0) {
        let pct = 0;
        if (mode === 'stringout') {
          const hostClip = displayClips.find(c => newTime >= c.sourceStart && newTime < c.sourceEnd);
          if (hostClip) {
            pct = ((hostClip.displayStart + (newTime - hostClip.sourceStart)) / totalDuration) * 100;
          }
        } else {
          pct = (newTime / totalDuration) * 100;
        }
        playheadRef.current.style.left = `${pct}%`;
      }
      
    } else if (isP) {
      scrubDragRef.current = null; // Clear scrub if they switch to pan
      const track = containerRef.current;
      if (!track) return;
      
      if (!panDragRef.current) {
        panDragRef.current = {
          startX: e.clientX,
          startWindow: [...zoomWindow]
        };
        return;
      }
      
      const drag = panDragRef.current;
      const deltaX = e.clientX - drag.startX;
      if (deltaX === 0) return;
      
      const rect = track.getBoundingClientRect();
      const span = drag.startWindow[1] - drag.startWindow[0];
      const deltaFrac = (-deltaX / rect.width) * span;
      const newS = Math.max(0, Math.min(drag.startWindow[0] + deltaFrac, 1 - span));
      setZoomWindow([newS, newS + span]);
    } else {
      panDragRef.current = null;
      scrubDragRef.current = null;
    }
  };

  // ─── Timeline click (seek) ───────────────────────────────────────────────
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (keysDownRef.current.has('KeyP') || keysDownRef.current.has('KeyL')) return;
    lastClickTimeRef.current = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const screenFrac = (e.clientX - rect.left) / rect.width;
    const [s, en] = zoomWindow;
    const absoluteFrac = s + screenFrac * (en - s);
    const seekTime = absoluteFrac * totalDuration;

    // DC: delegate to sequence player seek (timeline time, not source time)
    if (mode === 'director_cut' && props.dcActions?.onSeek) {
      props.dcActions.onSeek(seekTime);
    } else if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }
  };

  // ─── Wheel zoom on track ──────────────────────────────────────────────────
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    panDragRef.current = null;
    scrubDragRef.current = null;
    if (!videoRef.current) return;

    const [s, en] = zoomWindow;
    const currentTime = mode === 'stringout' ? videoRef.current.currentTime : (virtualTimeRef?.current || 0);
    const playheadFrac = currentTime / totalDuration;

    const isPlayheadVisible = playheadFrac >= s && playheadFrac <= en;

    let anchorFrac: number;
    let screenFrac: number;

    if (isPlayheadVisible) {
      anchorFrac = playheadFrac;
      screenFrac = (playheadFrac - s) / (en - s);
    } else {
      const track = containerRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const cursorFrac = (e.clientX - rect.left) / rect.width;
      anchorFrac = s + cursorFrac * (en - s);
      screenFrac = cursorFrac;
    }

    const zoomFactor = e.deltaY > 0 ? 1.15 : 0.85;
    const MIN_ZOOM_WINDOW = 0.05;
    const newSpan = Math.min(1, Math.max(MIN_ZOOM_WINDOW, (en - s) * zoomFactor));
    const newS = Math.max(0, Math.min(anchorFrac - newSpan * screenFrac, 1 - newSpan));
    setZoomWindow([newS, newS + newSpan]);
  };

  // Unified D&D
  const {
    activeId,
    sortableItems,
    displayClips,
    handleDragStart,
    handleDragEnd,
    handleDragCancel
  } = useUniversalDnd({
    mode,
    clips,
    globalTimeline: props.globalTimeline,
    onSaveStringoutOrder: props.onSaveStringoutOrder,
    onDirectExportDC: props.dcActions?.onDirectExportDC
  });

  const activeClip = activeId ? displayClips.find(c => c.id === activeId) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // RAF loop for playhead update
  useEffect(() => {
    let rafId: number;
    let lastFormatted = '';
    let lastSeqTime: number | null = null;
    const loop = () => {
      let t = 0;
      if (mode === 'stringout' && videoRef.current) {
        t = videoRef.current.currentTime;
      } else if (mode === 'director_cut' && virtualTimeRef) {
        t = virtualTimeRef.current;
      }

      // Format time text
      const fmt = formatTime(t);
      if (fmt !== lastFormatted) {
        setCurrentTimeFormatted(fmt);
        lastFormatted = fmt;
      }

      // Move playhead DOM element
      if (playheadRef.current && totalDuration > 0) {
        let pct = 0;
        let seqTimeForPan = 0;
        let validTime = false;

        if (mode === 'stringout' && videoRef.current) {
          const currentSec = videoRef.current.currentTime;
          const hostClip = displayClips.find(c => currentSec >= c.sourceStart && currentSec < c.sourceEnd);
          if (hostClip) {
            seqTimeForPan = hostClip.displayStart + (currentSec - hostClip.sourceStart);
            pct = (seqTimeForPan / totalDuration) * 100;
            validTime = true;
          }
        } else if (mode === 'director_cut' && virtualTimeRef) {
          seqTimeForPan = virtualTimeRef.current;
          pct = (seqTimeForPan / totalDuration) * 100;
          validTime = true;
        }

        if (validTime) {
          playheadRef.current.style.left = `${pct}%`;

          // --- Auto-Pan / Center Playhead Logic ---
          const playheadFrac = pct / 100;
          const [s, en] = zoomWindow;
          const windowSpan = en - s;
          const isUserInteracting = panDragRef.current !== null || scrubDragRef.current !== null;
          const timeSinceClick = Date.now() - lastClickTimeRef.current;

          if (!isUserInteracting && windowSpan < 0.999 && timeSinceClick > 150) {
            const isOutOfBounds = playheadFrac < s || playheadFrac > en;

            if (isOutOfBounds) {
              const movingRight = lastSeqTime !== null ? seqTimeForPan >= lastSeqTime : true;
              let newS = movingRight 
                ? playheadFrac - windowSpan * 0.25 
                : playheadFrac - windowSpan * 0.75;
              
              newS = Math.max(0, Math.min(newS, 1 - windowSpan));
              if (Math.abs(newS - s) > 0.001) {
                setZoomWindow([newS, newS + windowSpan]);
              }
            }
          }
          lastSeqTime = seqTimeForPan;
        }
      }

      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [mode, videoRef, virtualTimeRef, totalDuration, zoomWindow, displayClips]);

  // Timeline Mouse Modifiers (P/L key interactions)
  useTimelineModifiers();

  // Reset zoom on unmount
  useEffect(() => {
    return () => setZoomWindow([0, 1]);
  }, [mode]);

  return (
    <div className="w-full flex flex-col gap-1.5 select-none">
      <UniversalTimelineHeader
        mode={mode}
        formattedTime={currentTimeFormatted}
        totalDuration={totalDuration}
        showShortcutsPopup={showShortcutsPopup}
        setShowShortcutsPopup={setShowShortcutsPopup}
        waveformView={props.waveformView}
        setWaveformView={props.setWaveformView}
        audioMarkerFilters={props.audioMarkerFilters}
        setAudioMarkerFilters={props.setAudioMarkerFilters}
        dcActions={props.dcActions}
      />

      <div 
        ref={containerRef}
        className={`relative w-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden group shadow-inner ${isModifying === 'pan' ? 'cursor-grab' : isModifying === 'scrub' ? 'cursor-col-resize' : 'cursor-pointer'}`}
        style={{ height: '64px' }}
        tabIndex={0}
        onClick={handleTimelineClick}
        onMouseMove={handleTimelineMouseMove}
        onWheel={handleWheel}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <UniversalTimelineTrack
            mode={mode}
            displayClips={displayClips}
            sortableItems={sortableItems}
            totalDuration={totalDuration}
            zoomWindow={zoomWindow}
            playheadRef={playheadRef}
            isModifying={isModifying !== null}
            audioWaveforms={props.audioWaveforms}
            waveformView={props.waveformView}
            audioDuration={props.audioDuration}
            userConstraints={userConstraints}
            markerNumbers={props.markerNumbers}
            hiddenMarkers={hiddenMarkers}
            audioBeats={props.audioBeats}
            audioBpm={props.audioBpm}
            audioMarkerFilters={props.audioMarkerFilters}
          />
          <DragOverlay>
            {activeClip ? (
              <div style={{ width: `${((activeClip.displayEnd - activeClip.displayStart) / totalDuration) * 100 * (1 / (zoomWindow[1] - zoomWindow[0]))}%` }}>
                <UniversalTimelineSegment clip={activeClip} mode={mode} totalDuration={totalDuration} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <div className="mt-2 h-2">
        <StringoutScrollbar
          zoomWindow={zoomWindow}
          setZoomWindow={setZoomWindow}
          duration={totalDuration}
          videoRef={videoRef}
          zoomSpan={zoomWindow[1] - zoomWindow[0]}
        />
      </div>

      {/* ── Active Marker Toolbar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 mt-3 px-1">

          {/* Human Constraints Group */}
          <div className="flex items-center gap-2">
            <span className="text-[8px] uppercase tracking-widest font-bold text-slate-600">Human</span>
            <div className="flex items-center gap-1">
              {([
                { type: 'IN',  label: 'IN',  color: '#4CAF50' },
                { type: 'OUT', label: 'OUT', color: '#E53935' },
                { type: 'BM',  label: 'M',   color: '#FF6D00' },
              ] as { type: string; label: string; color: string }[]).map(({ type, label, color }) => {
                const isHidden = hiddenMarkers.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleMarkerVisibility(type)}
                    title={isHidden ? `Show ${label} markers` : `Hide ${label} markers`}
                    className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
                      isHidden
                        ? 'opacity-35 border-slate-700 bg-slate-800/60 text-slate-500'
                        : 'opacity-100'
                    }`}
                    style={isHidden ? {} : { color, borderColor: `${color}50`, backgroundColor: `${color}18` }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: isHidden ? '#475569' : color }}
                    />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <span className="text-slate-700 select-none">|</span>

          {/* Machine Analysis Group */}
          <div className="flex items-center gap-2">
            <span className="text-[8px] uppercase tracking-widest font-bold text-slate-600">Machine</span>
            <div className="flex items-center gap-1">
              {/* AUDIO: Librosa machine marker */}
              <button
                onClick={() => toggleMarkerVisibility('AUDIO')}
                title={hiddenMarkers.includes('AUDIO') ? 'Show Audio markers' : 'Hide Audio markers'}
                className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
                  hiddenMarkers.includes('AUDIO')
                    ? 'opacity-35 border-slate-700 bg-slate-800/60 text-slate-500'
                    : 'border-[#FFC107]/30 bg-[#FFC107]/10 text-[#FFC107]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  hiddenMarkers.includes('AUDIO') ? 'bg-slate-600' : 'bg-[#FFC107]'
                }`} />
                A
              </button>
              {/* YOLO BM Analysis */}
              <button
                onClick={() => toggleMarkerVisibility('YOLO_BM')}
                title={hiddenMarkers.includes('YOLO_BM') ? 'Show BM Analysis markers' : 'Hide BM Analysis markers'}
                className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
                  hiddenMarkers.includes('YOLO_BM')
                    ? 'opacity-35 border-slate-700 bg-slate-800/60 text-slate-500'
                    : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  hiddenMarkers.includes('YOLO_BM') ? 'bg-slate-600' : 'bg-blue-500'
                }`} />
                BM Analysis
              </button>
            </div>
          </div>

        {/* Reset Zoom */}
        {(zoomWindow[1] - zoomWindow[0]) < 0.99 && (
          <button
            onClick={() => setZoomWindow([0, 1])}
            className="text-slate-500 hover:text-slate-300 transition-colors font-mono text-[9px] border border-slate-700 px-1.5 py-0.5 rounded"
          >
            Reset Zoom
          </button>
        )}
      </div>
    </div>
  );
}
