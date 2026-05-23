import React, { useRef, useEffect, useState } from 'react';
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
    onDirectExportDC: () => void;
  };
  // Audio
  audioWaveforms?: { amplitude: number[], energy: number[] } | null;
  waveformView?: 'amplitude' | 'energy';
  setWaveformView?: (view: 'amplitude' | 'energy') => void;
  audioDuration?: number;
  audioBeats?: { time: number; energy: number; type: string }[];
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

  const { isModifying, keysDownRef } = useTimelineModifiers();

  // ─── P/L Modifiers Mouse Move Logic ───────────────────────────────────────
  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const isP = keysDownRef.current.has('KeyP');
    const isL = keysDownRef.current.has('KeyL');

    if (isP && isL) {
      const track = containerRef.current;
      if (!track || !videoRef.current) return;
      const deltaX = e.movementX;
      if (deltaX === 0) return;
      
      const rect = track.getBoundingClientRect();
      const [s, en] = zoomWindow;
      const span = en - s;
      
      const deltaFrac = (-deltaX / rect.width) * span;
      const newS = Math.max(0, Math.min(s + deltaFrac, 1 - span));
      setZoomWindow([newS, newS + span]);
      
      const currentAbsoluteFrac = (mode === 'director_cut' && virtualTimeRef ? virtualTimeRef.current : videoRef.current.currentTime) / totalDuration;
      const newAbsoluteFrac = Math.max(0, Math.min(currentAbsoluteFrac + deltaFrac, 1));
      videoRef.current.currentTime = newAbsoluteFrac * totalDuration;
      
    } else if (isP) {
      const track = containerRef.current;
      if (!track) return;
      const deltaX = e.movementX;
      if (deltaX === 0) return;
      const rect = track.getBoundingClientRect();
      const [s, en] = zoomWindow;
      const span = en - s;
      
      const deltaFrac = (-deltaX / rect.width) * span;
      const newS = Math.max(0, Math.min(s + deltaFrac, 1 - span));
      setZoomWindow([newS, newS + span]);
    }
  };

  // ─── Timeline click (seek) ───────────────────────────────────────────────
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (keysDownRef.current.has('KeyP') || keysDownRef.current.has('KeyL')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const screenFrac = (e.clientX - rect.left) / rect.width;
    const [s, en] = zoomWindow;
    const absoluteFrac = s + screenFrac * (en - s);
    const seekTime = absoluteFrac * totalDuration;
    
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }
  };

  // ─── Wheel zoom on track ──────────────────────────────────────────────────
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
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
        if (mode === 'stringout' && videoRef.current) {
          const currentSec = videoRef.current.currentTime;
          const hostClip = displayClips.find(c => currentSec >= c.sourceStart && currentSec < c.sourceEnd);
          if (hostClip) {
            const seqTime = hostClip.displayStart + (currentSec - hostClip.sourceStart);
            pct = (seqTime / totalDuration) * 100;
          }
        } else if (mode === 'director_cut' && virtualTimeRef) {
          pct = (virtualTimeRef.current / totalDuration) * 100;
        }
        playheadRef.current.style.left = `${pct}%`;
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
        hiddenMarkers={hiddenMarkers}
        toggleMarkerVisibility={toggleMarkerVisibility}
        waveformView={props.waveformView}
        setWaveformView={props.setWaveformView}
        audioMarkerFilters={props.audioMarkerFilters}
        setAudioMarkerFilters={props.setAudioMarkerFilters}
        dcActions={props.dcActions}
      />

      <div 
        ref={containerRef}
        className={`relative w-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden group shadow-inner ${isModifying === 'pan' ? 'cursor-grab' : isModifying === 'scrub' ? 'cursor-col-resize' : 'cursor-pointer'}`}
        style={{ height: mode === 'director_cut' ? '120px' : '64px' }}
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
            audioWaveforms={props.audioWaveforms}
            waveformView={props.waveformView}
            audioDuration={props.audioDuration}
            userConstraints={userConstraints}
            markerNumbers={props.markerNumbers}
            hiddenMarkers={hiddenMarkers}
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

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 items-center justify-center text-[10px] uppercase font-bold tracking-wider text-slate-500 mt-3">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500/80"></span> Valid (MAIN)</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500/80"></span> B-ROLL</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500/80"></span> Trash (Rejected)</div>
        <span className="text-slate-700">|</span>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#4CAF50' }}></span> Marker IN</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#E53935' }}></span> Marker OUT</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FF6D00' }}></span> Marker BM</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FFC107' }}></span> Marker Audio</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Bookend [ IN</div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Bookend OUT ]</div>
        {(zoomWindow[1] - zoomWindow[0]) < 0.99 && (
          <button
            onClick={() => setZoomWindow([0, 1])}
            className="text-slate-500 hover:text-slate-300 transition-colors normal-case font-mono text-[9px] border border-slate-700 px-1.5 py-0.5 rounded ml-2"
          >
            Reset Zoom
          </button>
        )}
      </div>
    </div>
  );
}
