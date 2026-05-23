import { useCallback, useEffect, useRef, useState, Fragment } from 'react';
import { Keyboard, SlidersHorizontal } from 'lucide-react';
import type { PancakeClip } from '../../hooks/usePancakeData';
import type { AudioMarkerFilter } from './PancakeDashboard';

interface InteractiveTimelineProps {
  timeline: PancakeClip[];
  videoRef: React.RefObject<HTMLVideoElement>;
  duration: number;
  userConstraints: Record<string, Array<{ type: 'IN' | 'OUT' | 'BM' | 'AUDIO'; time: number }>>;
  clipOverrides?: Record<string, any>;
  audioWaveforms?: { amplitude: number[], energy: number[] } | null;
  waveformView?: 'amplitude' | 'energy';
  setWaveformView?: (view: 'amplitude' | 'energy') => void;
  audioDuration?: number;
  audioBeats?: { time: number; energy: number; type: string }[];
  audioMarkerFilters?: AudioMarkerFilter;
  setAudioMarkerFilters?: (filters: AudioMarkerFilter) => void;
  markerNumbers?: Map<string, number>; // Global M# namespace from PancakeDashboard (Stringout-first)
}

// Per-type marker color palette
const MARKER_COLORS: Record<string, string> = {
  IN: '#4CAF50', // Premiere green  — IN marker
  OUT: '#E53935', // Premiere red    — OUT marker
  BM: '#FF6D00', // Premiere orange — user BM bookmark
  AUDIO: '#FFC107', // Premiere gold   — audio cue
};

const MIN_ZOOM_WINDOW = 0.04; // minimum 4% of total duration visible
const HANDLE_SIZE_PX = 10;    // draggable edge zone in pixels

type DragType = 'left' | 'right' | 'pan';

interface DragState {
  type: DragType;
  startX: number;
  startWindow: [number, number];
  barWidth: number;
  playheadFrac?: number;
  playheadScreenFrac?: number;
}

export function InteractiveTimeline({
  timeline,
  videoRef,
  duration,
  userConstraints,
  clipOverrides = {},
  audioWaveforms = null,
  waveformView = 'amplitude',
  setWaveformView,
  audioDuration = 0,
  audioBeats = [],
  audioMarkerFilters,
  setAudioMarkerFilters,
  markerNumbers = new Map()
}: InteractiveTimelineProps) {
  const playheadRef = useRef<HTMLDivElement>(null);
  const timeTextRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isAudioPopupOpen, setIsAudioPopupOpen] = useState(false);
  const [isWaveformPopupOpen, setIsWaveformPopupOpen] = useState(false);

  // ─── Left-Handed Modifiers State ──────────────────────────────────────────
  const keysDownRef = useRef<Set<string>>(new Set());
  const [isModifying, setIsModifying] = useState<'pan' | 'scrub' | null>(null);

  // Zoom state: [startFraction, endFraction] of total duration, both in [0, 1]
  const [zoomWindow, setZoomWindow] = useState<[number, number]>([0, 1]);
  const dragStateRef = useRef<DragState | null>(null);

  // ─── Playhead RAF ────────────────────────────────────────────────────────────
  useEffect(() => {
    let animationFrameId: number;
    const updatePlayhead = () => {
      if (videoRef.current && playheadRef.current && duration > 0) {
        const currentTime = videoRef.current.currentTime;
        const percentage = (currentTime / duration) * 100;
        playheadRef.current.style.left = `${percentage}%`;
        if (timeTextRef.current) {
          timeTextRef.current.innerText = formatTime(currentTime);
        }
      }
      animationFrameId = requestAnimationFrame(updatePlayhead);
    };

    animationFrameId = requestAnimationFrame(updatePlayhead);
    return () => cancelAnimationFrame(animationFrameId);
  }, [videoRef, duration]);

  // ─── Auto-pan on Seek ────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleSeeked = () => {
      if (duration <= 0) return;
      const frac = video.currentTime / duration;
      setZoomWindow(prev => {
        const [start, end] = prev;
        if (frac >= start && frac <= end) return prev;

        const span = end - start;
        let newStart = frac - span / 2;
        let newEnd = frac + span / 2;

        if (newStart < 0) {
          newStart = 0;
          newEnd = span;
        } else if (newEnd > 1) {
          newEnd = 1;
          newStart = 1 - span;
        }
        return [newStart, newEnd];
      });
    };

    video.addEventListener('seeked', handleSeeked);
    return () => video.removeEventListener('seeked', handleSeeked);
  }, [videoRef, duration]);

  // ─── Scrollbar drag handlers ──────────────────────────────────────────────
  const handleScrollbarMouseMove = useCallback((e: MouseEvent) => {
    const drag = dragStateRef.current;
    if (!drag) return;

    const delta = (e.clientX - drag.startX) / drag.barWidth; // fraction
    const [s0, e0] = drag.startWindow;

    let nextWindow: [number, number];

    // If playhead was visible when dragging started, keep it anchored at the same screen position
    if (drag.playheadFrac !== undefined && drag.playheadScreenFrac !== undefined) {
      const playheadFrac = drag.playheadFrac;
      const playheadScreenFrac = drag.playheadScreenFrac;

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
        nextWindow = [newS, newS + span];
        setZoomWindow(nextWindow);
        return;
      }

      newSpan = Math.min(1, Math.max(MIN_ZOOM_WINDOW, newSpan));
      let newStart = playheadFrac - newSpan * playheadScreenFrac;
      newStart = Math.max(0, Math.min(newStart, 1 - newSpan));
      nextWindow = [newStart, newStart + newSpan];
    } else {
      // Standard zoom (no visible playhead, anchor on opposite edge)
      if (drag.type === 'left') {
        const newS = Math.max(0, Math.min(s0 + delta, e0 - MIN_ZOOM_WINDOW));
        nextWindow = [newS, e0];
      } else if (drag.type === 'right') {
        const newE = Math.min(1, Math.max(e0 + delta, s0 + MIN_ZOOM_WINDOW));
        nextWindow = [s0, newE];
      } else {
        // pan
        const span = e0 - s0;
        const newS = Math.max(0, Math.min(s0 + delta, 1 - span));
        nextWindow = [newS, newS + span];
      }
    }

    setZoomWindow(nextWindow);
  }, []);

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

    // Determine where in the thumb the user clicked
    const thumbLeft = zoomWindow[0] * barWidth;
    const thumbRight = zoomWindow[1] * barWidth;
    const clickX = e.clientX - barRect.left;

    let type: DragType;

    // Boundary-tolerant check: click is near left handle (within 10px of thumbLeft)
    if (Math.abs(clickX - thumbLeft) <= HANDLE_SIZE_PX) {
      type = 'left';
    }
    // Boundary-tolerant check: click is near right handle (within 10px of thumbRight)
    else if (Math.abs(clickX - thumbRight) <= HANDLE_SIZE_PX) {
      type = 'right';
    }
    // Click is inside thumb
    else if (clickX >= thumbLeft && clickX <= thumbRight) {
      type = 'pan';
    }
    // Click is completely outside thumb -> jump pan to center on click
    else {
      const clickFrac = clickX / barWidth;
      const span = zoomWindow[1] - zoomWindow[0];
      const newS = Math.max(0, Math.min(clickFrac - span / 2, 1 - span));
      setZoomWindow([newS, newS + span]);
      return;
    }

    // Capture playhead status at click start to anchor zoom dynamically
    const currentTime = videoRef.current ? videoRef.current.currentTime : 0;
    const playheadFrac = currentTime / duration;
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

    // Lock cursor globally to prevent drag indicator loss and flashes
    if (type === 'left' || type === 'right') {
      document.body.style.cursor = 'col-resize';
    } else {
      document.body.style.cursor = 'grabbing';
    }

    window.addEventListener('mousemove', handleScrollbarMouseMove);
    window.addEventListener('mouseup', handleScrollbarMouseUp);
  }, [zoomWindow, handleScrollbarMouseMove, handleScrollbarMouseUp, duration, videoRef]);

  // ─── Wheel zoom on track ──────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!videoRef.current) return;

    const [s, en] = zoomWindow;
    const currentTime = videoRef.current.currentTime;
    const playheadFrac = currentTime / duration;

    // Check if playhead is currently within the visible zoom window
    const isPlayheadVisible = playheadFrac >= s && playheadFrac <= en;

    let anchorFrac: number;
    let screenFrac: number;

    if (isPlayheadVisible) {
      // Anchor on the playhead's screen position
      anchorFrac = playheadFrac;
      screenFrac = (playheadFrac - s) / (en - s);
    } else {
      // If playhead is off-screen, anchor on the mouse cursor position to zoom where the user is looking
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const cursorFrac = (e.clientX - rect.left) / rect.width;
      anchorFrac = s + cursorFrac * (en - s);
      screenFrac = cursorFrac;
    }

    const zoomFactor = e.deltaY > 0 ? 1.15 : 0.85;
    const newSpan = Math.min(1, Math.max(MIN_ZOOM_WINDOW, (en - s) * zoomFactor));
    const newS = Math.max(0, Math.min(anchorFrac - newSpan * screenFrac, 1 - newSpan));
    setZoomWindow([newS, newS + newSpan]);
  }, [zoomWindow, duration]);

  if (!timeline || duration <= 0) return null;

  // ─── P/L Modifiers Key Listener ───────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.code === 'KeyP' || e.code === 'KeyL') {
        keysDownRef.current.add(e.code);
        if (keysDownRef.current.has('KeyP') && keysDownRef.current.has('KeyL')) {
          setIsModifying('scrub');
        } else if (keysDownRef.current.has('KeyP')) {
          setIsModifying('pan');
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' || e.code === 'KeyL') {
        keysDownRef.current.delete(e.code);
        if (keysDownRef.current.has('KeyP') && keysDownRef.current.has('KeyL')) {
          setIsModifying('scrub');
        } else if (keysDownRef.current.has('KeyP')) {
          setIsModifying('pan');
        } else {
          setIsModifying(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // ─── P/L Modifiers Mouse Move Logic ───────────────────────────────────────
  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const isP = keysDownRef.current.has('KeyP');
    const isL = keysDownRef.current.has('KeyL');

    if (isP && isL) {
      // Mode 2: Scrub Playhead AND View (Timeline moves under a visually fixed playhead)
      const track = trackRef.current;
      if (!track || !videoRef.current) return;
      const deltaX = e.movementX; // native delta since last move event
      if (deltaX === 0) return;
      
      const rect = track.getBoundingClientRect();
      const [s, en] = zoomWindow;
      const span = en - s;
      
      // We negate deltaX so dragging mouse right moves the view left (standard pan)
      const deltaFrac = (-deltaX / rect.width) * span;
      
      // 1. Pan the view
      const newS = Math.max(0, Math.min(s + deltaFrac, 1 - span));
      setZoomWindow([newS, newS + span]);
      
      // 2. Scrub the playhead by the exact same fraction so it stays visually fixed
      const currentAbsoluteFrac = videoRef.current.currentTime / duration;
      const newAbsoluteFrac = Math.max(0, Math.min(currentAbsoluteFrac + deltaFrac, 1));
      videoRef.current.currentTime = newAbsoluteFrac * duration;
      
    } else if (isP) {
      // Mode 1: Pan View ONLY
      const track = trackRef.current;
      if (!track) return;
      const deltaX = e.movementX; // native delta since last move event
      if (deltaX === 0) return;
      const rect = track.getBoundingClientRect();
      const [s, en] = zoomWindow;
      const span = en - s;
      
      // We negate deltaX so dragging mouse right moves the view left (standard pan)
      const deltaFrac = (-deltaX / rect.width) * span;
      const newS = Math.max(0, Math.min(s + deltaFrac, 1 - span));
      setZoomWindow([newS, newS + span]);
    }
  };

  // ─── Timeline click (remapped through zoom window) ────────────────────────
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If we are holding modifiers, ignore clicks
    if (keysDownRef.current.has('KeyP') || keysDownRef.current.has('KeyL')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const screenFrac = (e.clientX - rect.left) / rect.width;
    const [s, en] = zoomWindow;
    const absoluteFrac = s + screenFrac * (en - s);
    const seekTime = absoluteFrac * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = seekTime;
    }
  };

  // ─── Zoom viewport math ───────────────────────────────────────────────────
  const [zoomStart, zoomEnd] = zoomWindow;
  const zoomSpan = zoomEnd - zoomStart;
  const scale = 1 / zoomSpan;           // e.g. 2.5x
  const panOffset = zoomStart * 100;    // in % relative to the scaled container

  const getSegmentColor = (tag: string, isUsable?: boolean, override?: 'KEEP' | 'TRASH' | 'BROLL') => {
    let finalUsable = isUsable !== false;
    let isBroll = tag.includes('B-ROLL');

    if (override === 'KEEP') { finalUsable = true; isBroll = false; }
    if (override === 'TRASH') { finalUsable = false; }
    if (override === 'BROLL') { finalUsable = true; isBroll = true; }

    if (!finalUsable) {
      if (override === 'TRASH') return 'bg-red-600 border-2 border-red-400 hover:bg-red-500 z-10';
      return 'bg-red-500/80 hover:bg-red-400';
    }

    if (override === 'KEEP') return 'bg-emerald-400 border-2 border-emerald-300 hover:bg-emerald-300 z-10';
    if (override === 'BROLL') return 'bg-blue-400 border-2 border-blue-300 hover:bg-blue-300 z-10';

    if (isBroll) return 'bg-blue-500/80 hover:bg-blue-400';
    return 'bg-emerald-500/80 hover:bg-emerald-400';
  };

  // Cursor style for scrollbar thumb based on drag state
  const getThumbCursorStyle = (): React.CSSProperties => {
    const drag = dragStateRef.current;
    if (drag) {
      if (drag.type === 'left' || drag.type === 'right') {
        return { cursor: 'col-resize' };
      }
      return { cursor: 'grabbing' };
    }
    return { cursor: 'grab' };
  };


  return (
    <div className="w-full flex flex-col gap-1.5">
      {/* ── Time ruler row ─────────────────────────────────────────────── */}
      <div className="flex justify-between items-center text-xs text-slate-400 font-mono relative z-[100]">
        <span ref={timeTextRef} className="text-blue-400 font-bold">00:00</span>

        <div className="flex items-center gap-2">
          {/* Waveform Control Button */}
          {setWaveformView && (
            <div className="relative flex items-center justify-center">
              <button
                onClick={() => {
                  setIsWaveformPopupOpen(!isWaveformPopupOpen);
                  setIsAudioPopupOpen(false);
                  setIsPopupOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all focus:outline-none hover:scale-[1.02] active:scale-[0.98] shadow-sm cursor-pointer ${isWaveformPopupOpen
                  ? 'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30'
                  : 'bg-slate-800/40 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 border-slate-700/40 hover:border-slate-600/60'
                  }`}
                title="Waveform Control"
              >
                <span className="text-[14px] leading-none">🌊</span>
                <span className="text-[10px] font-semibold tracking-wider uppercase font-sans">Waveform Control</span>
              </button>

              {isWaveformPopupOpen && (
                <div className="absolute bottom-full mb-3 right-0 w-[240px] p-4 bg-slate-900 border border-slate-700 rounded-lg shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[100]">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-slate-200 font-bold text-[11px] uppercase tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" /> Waveform View
                    </h4>
                    <button onClick={() => setIsWaveformPopupOpen(false)} className="text-slate-500 hover:text-slate-300">✕</button>
                  </div>

                  <div className="flex bg-slate-800/50 p-1 rounded-md border border-slate-700/50">
                    <button
                      onClick={() => setWaveformView('amplitude')}
                      className={`flex-1 py-1.5 text-[10px] font-sans rounded transition-colors ${waveformView === 'amplitude'
                        ? 'bg-slate-700 text-slate-100 shadow-sm'
                        : 'text-slate-300 hover:text-slate-100'
                        }`}
                    >
                      Amplitude
                    </button>
                    <button
                      onClick={() => setWaveformView('energy')}
                      className={`flex-1 py-1.5 text-[10px] font-sans rounded transition-colors ${waveformView === 'energy'
                        ? 'bg-slate-700 text-slate-100 shadow-sm'
                        : 'text-slate-300 hover:text-slate-100'
                        }`}
                    >
                      Energy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Audio Marker Control Button */}
          {audioMarkerFilters && setAudioMarkerFilters && (
            <div className="relative flex items-center justify-center">
              <button
                onClick={() => {
                  setIsAudioPopupOpen(!isAudioPopupOpen);
                  setIsWaveformPopupOpen(false);
                  setIsPopupOpen(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all focus:outline-none hover:scale-[1.02] active:scale-[0.98] shadow-sm cursor-pointer ${isAudioPopupOpen
                  ? 'bg-[#FFC107]/10 text-[#FFC107] border-[#FFC107]/30'
                  : 'bg-slate-800/40 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 border-slate-700/40 hover:border-slate-600/60'
                  }`}
                title="Audio Marker Control"
              >
                <SlidersHorizontal size={12} className={isAudioPopupOpen ? "text-[#FFC107]" : "text-yellow-500/80"} />
                <span className="text-[10px] font-semibold tracking-wider uppercase font-sans">Audio Marker Control</span>
              </button>

              {isAudioPopupOpen && (
                <div className="absolute bottom-full mb-3 right-0 w-[240px] p-4 bg-slate-900 border border-slate-700 rounded-lg shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[100]">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-slate-200 font-bold text-[11px] uppercase tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FFC107]" /> Marker Filters
                    </h4>
                    <button onClick={() => setIsAudioPopupOpen(false)} className="text-slate-500 hover:text-slate-300">✕</button>
                  </div>

                  <div className="space-y-4">
                    {/* Types Toggle */}
                    <div className="space-y-2">
                      <label className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Event Types</label>
                      <div className="flex flex-col gap-1.5">
                        {['percussive', 'harmonic', 'beat', 'bpm_grid'].map(t => {
                          let accentColor = 'accent-yellow-500';
                          if (t === 'harmonic') accentColor = 'accent-fuchsia-500';
                          if (t === 'percussive') accentColor = 'accent-slate-200';
                          if (t === 'bpm_grid') accentColor = 'accent-emerald-500';

                          const labelText = t === 'bpm_grid' ? 'BPM Grid (Metronome)' : t.charAt(0).toUpperCase() + t.slice(1);

                          return (
                            <label key={t} className="flex items-center gap-2 text-[10px] text-slate-300 cursor-pointer hover:text-slate-100">
                              <input
                                type="checkbox"
                                className={accentColor}
                                checked={audioMarkerFilters.types.includes(t)}
                                onChange={(e) => {
                                  const newTypes = e.target.checked
                                    ? [...audioMarkerFilters.types, t]
                                    : audioMarkerFilters.types.filter(type => type !== t);
                                  setAudioMarkerFilters({ ...audioMarkerFilters, types: newTypes });
                                }}
                              />
                              {labelText}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Energy Threshold Slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Min Energy</label>
                        <span className="text-[10px] text-[#FFC107] font-mono font-bold bg-[#FFC107]/10 px-1.5 py-0.5 rounded border border-[#FFC107]/20">
                          {audioMarkerFilters.minEnergy.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={audioMarkerFilters.minEnergy}
                        onChange={(e) => setAudioMarkerFilters({ ...audioMarkerFilters, minEnergy: parseFloat(e.target.value) })}
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#FFC107]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Keyboard Shortcuts Button — styled as a premium interactive pill */}
          <div className="relative flex items-center justify-center">
            <button
              onClick={() => {
                setIsPopupOpen(!isPopupOpen);
                setIsAudioPopupOpen(false);
                setIsWaveformPopupOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/40 hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 transition-all border border-slate-700/40 hover:border-slate-600/60 focus:outline-none hover:scale-[1.02] active:scale-[0.98] shadow-sm cursor-pointer"
              title="Keyboard Shortcuts"
            >
              <Keyboard size={12} className="text-blue-400/80" />
              <span className="text-[10px] font-semibold tracking-wider uppercase font-sans">Keyboard Shortcuts</span>
            </button>

            {isPopupOpen && (
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-[520px] p-4 bg-slate-900 border border-slate-700 rounded-lg shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[100]">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-slate-200 font-bold text-[11px] uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Keyboard Shortcuts
                  </h4>
                  <button onClick={() => setIsPopupOpen(false)} className="text-slate-500 hover:text-slate-300">✕</button>
                </div>
                
                <div className="space-y-4 text-slate-400 text-[10px] font-sans">
                  
                  {/* Area 1: Global Navigation */}
                  <div>
                    <h5 className="text-slate-300 font-bold mb-1.5 border-b border-slate-700/50 pb-1 uppercase text-[9px] tracking-wider text-blue-400/80">Global Navigation</h5>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                      <div className="flex justify-between items-center"><span>Play / Pause</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">Space</kbd></div>
                      <div className="flex justify-between items-center"><span>10 Frames</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">← / →</kbd></div>
                      <div className="flex justify-between items-center"><span>1 Frame</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">Shift + ← / →</kbd></div>
                      <div className="flex justify-between items-center"><span>30 Frames</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">Alt + ← / →</kbd></div>
                      <div className="flex justify-between items-center"><span>Previous / Next Clip</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">↑ / ↓</kbd></div>
                    </div>
                  </div>

                  {/* Area 2: Timeline Modifiers */}
                  <div>
                    <h5 className="text-slate-300 font-bold mb-1.5 border-b border-slate-700/50 pb-1 uppercase text-[9px] tracking-wider text-amber-400/80">Timeline Interaction</h5>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                      <div className="flex justify-between items-center"><span>Zoom In / Out</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">⌃ + Scroll</kbd></div>
                      <div className="flex justify-between items-center"><span>Pan Timeline View</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">P + Drag</kbd></div>
                      <div className="flex justify-between items-center"><span>Scrub Playhead</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">P + L + Drag</kbd></div>
                    </div>
                  </div>

                  {/* Area 3: Markers & Macros */}
                  <div>
                    <h5 className="text-slate-300 font-bold mb-1.5 border-b border-slate-700/50 pb-1 uppercase text-[9px] tracking-wider text-emerald-400/80">Markers & Status (Hovering Clip)</h5>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                      <div className="flex justify-between items-center"><span style={{ color: '#4CAF50' }}>Marker IN / OUT</span><kbd className="px-1.5 py-0.5 rounded font-mono border" style={{ backgroundColor: '#4CAF5020', color: '#4CAF50', borderColor: '#4CAF5055' }}>I / O</kbd></div>
                      <div className="flex justify-between items-center"><span>Remove IN / OUT</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">Shift + I / O</kbd></div>

                      <div className="flex justify-between items-center"><span style={{ color: '#FF6D00' }}>Marker BM (M#)</span><kbd className="px-1.5 py-0.5 rounded font-mono border" style={{ backgroundColor: '#FF6D0020', color: '#FF6D00', borderColor: '#FF6D0055' }}>M</kbd></div>
                      <div className="flex justify-between items-center"><span>Remove BM Markers</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">Shift + M</kbd></div>

                      <div className="flex justify-between items-center"><span style={{ color: '#FFC107' }}>Marker Audio (♪)</span><kbd className="px-1.5 py-0.5 rounded font-mono border" style={{ backgroundColor: '#FFC10720', color: '#FFC107', borderColor: '#FFC10755' }}>A</kbd></div>
                      <div className="flex justify-between items-center"><span>Remove Audio Markers</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">Shift + A</kbd></div>

                      <div className="flex justify-between items-center"><span>Force Status: KEEP</span><kbd className="bg-emerald-900/50 px-1.5 py-0.5 rounded text-emerald-400 font-mono border border-emerald-800/50">K</kbd></div>
                      <div className="flex justify-between items-center"><span>Force Status: TRASH</span><kbd className="bg-red-900/50 px-1.5 py-0.5 rounded text-red-400 font-mono border border-red-800/50">T</kbd></div>
                      
                      <div className="flex justify-between items-center"><span>Force Status: B-ROLL</span><kbd className="bg-blue-900/50 px-1.5 py-0.5 rounded text-blue-400 font-mono border border-blue-800/50">B</kbd></div>
                      <div className="flex justify-between items-center"><span>Remove Single Marker</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">X</kbd></div>
                      
                      <div className="flex justify-between items-center"><span>Remove All Markers</span><kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">Shift + X</kbd></div>
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>

        <span>{formatTime(duration)}</span>
      </div>

      {/* ── Track ─────────────────────────────────────────────────────────── */}
      <div
        ref={trackRef}
        className={`relative w-full h-[64px] bg-slate-900 border border-slate-800 rounded-lg overflow-hidden group shadow-inner ${isModifying === 'pan' ? 'cursor-grab' : isModifying === 'scrub' ? 'cursor-col-resize' : 'cursor-pointer'}`}
        onClick={handleTimelineClick}
        onMouseMove={handleTimelineMouseMove}
        onWheel={handleWheel}
      >
        {/* Static, non-zoomed background bar for the ruler labels area at the top */}
        <div className="absolute top-0 left-0 right-0 h-[24px] bg-black/75 border-b border-slate-800/80 z-[10] pointer-events-none" />

        {/* Inner scaled+panned div — all segments and zoomed labels live here */}
        <div
          className="absolute top-0 bottom-0 h-full z-[20]"
          style={{
            width: `${scale * 100}%`,
            transform: `translateX(-${panOffset}%)`,
          }}
        >
          {/* Zoomed Ruler Pills Container (rendered on top of static background bar) */}
          {duration > 0 && (
            <div className="absolute top-0 left-0 right-0 h-[24px] z-[26]">
              {timeline.map((clip) => {
                const constraints = userConstraints[clip.start.toString()] || [];

                // userConstraint pills (IN / OUT / BM-user / AUDIO)
                const constraintPills = constraints.map((constraint, cIdx) => {
                  const markerNum = markerNumbers.get(`${clip.start.toFixed(3)}_${cIdx}`);
                  const markerColor = MARKER_COLORS[constraint.type] ?? '#ffffff';
                  const typeLabel = constraint.type === 'IN' ? 'IN' : constraint.type === 'OUT' ? 'OUT' : constraint.type === 'BM' ? 'M' : 'A';
                  const leftPct = (constraint.time / duration) * 100;
                  return (
                    <button
                      key={`ruler-${clip.start}-${cIdx}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (videoRef.current) videoRef.current.currentTime = constraint.time;
                      }}
                      className="absolute bottom-1 -translate-x-1/2 flex items-center justify-center gap-[2px] px-1 py-0.5 rounded text-[7px] font-black font-mono cursor-pointer hover:brightness-125 transition-all"
                      style={{
                        left: `${leftPct}%`,
                        backgroundColor: `${markerColor}30`,
                        color: markerColor,
                        border: `1px solid ${markerColor}66`,
                      }}
                      title={`${typeLabel}${markerNum !== undefined ? markerNum : ''} — ${formatTime(constraint.time)} — click to seek`}
                    >
                      {typeLabel}{markerNum !== undefined ? markerNum : ''}
                    </button>
                  );
                });

                // Native BM pill (yellow best_moment)
                const bmPill = clip.best_moment && clip.best_moment > clip.start && clip.best_moment < clip.end ? (() => {
                  const leftPct = (clip.best_moment / duration) * 100;
                  return (
                    <button
                      key={`ruler-bm-${clip.start}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (videoRef.current) videoRef.current.currentTime = clip.best_moment as number;
                      }}
                      className="absolute bottom-1 -translate-x-1/2 flex items-center justify-center gap-[2px] px-1 py-0.5 rounded text-[7px] font-black font-mono cursor-pointer hover:brightness-125 transition-all"
                      style={{
                        left: `${leftPct}%`,
                        backgroundColor: '#FF6D0030',
                        color: '#FF6D00',
                        border: '1px solid #FF6D0066',
                      }}
                      title={`BM — ${formatTime(clip.best_moment as number)} — click to seek`}
                    >
                      BM
                    </button>
                  );
                })() : null;
                return [constraintPills, bmPill];
              })}

              {/* Audio Beat Markers (Filtered for UI) */}
              {audioBeats && audioMarkerFilters && audioBeats.map((beat, i) => {
                const isBeat = beat.type.includes('beat') && audioMarkerFilters.types.includes('beat');
                const isHarmonic = beat.type.includes('harmonic') && audioMarkerFilters.types.includes('harmonic');
                const isPercussive = beat.type.includes('percussive') && audioMarkerFilters.types.includes('percussive');
                const showBpmGrid = beat.type.includes('beat') && audioMarkerFilters.types.includes('bpm_grid');

                // Determine if a flag should be shown based on toggles AND energy threshold
                const showFlag = (isBeat || isHarmonic || isPercussive) && (beat.energy >= audioMarkerFilters.minEnergy);

                // If no flag and no grid, skip rendering
                if (!showFlag && !showBpmGrid) return null;

                const leftPct = (beat.time / duration) * 100;

                return (
                  <Fragment key={`audio-bm-${i}`}>
                    {/* Visual Beat Grid Line (Metronome) - Bypasses energy filter */}
                    {showBpmGrid && (
                      <div
                        className="absolute top-[24px] w-[1px] bg-white/40 z-[30] pointer-events-none"
                        style={{ left: `${leftPct}%`, height: '40px' }}
                      />
                    )}

                    {/* Marker Flag (Harmonic/Percussive/Beat) */}
                    {showFlag && (() => {
                      let colorClasses = 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/60';
                      if (isHarmonic) {
                        colorClasses = 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/60';
                      } else if (isPercussive) {
                        colorClasses = 'bg-slate-200/20 text-white border border-slate-300/60';
                      }
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (videoRef.current) videoRef.current.currentTime = beat.time;
                          }}
                          className={`absolute bottom-1 -translate-x-1/2 flex items-center justify-center gap-[2px] px-1 py-0.5 rounded text-[7px] font-black font-mono cursor-pointer hover:brightness-125 transition-all ${colorClasses} z-[40]`}
                          style={{ left: `${leftPct}%` }}
                          title={`AM — ${formatTime(beat.time)} (${beat.type}) — click to seek`}
                        >
                          A
                        </button>
                      );
                    })()}
                  </Fragment>
                );
              })}
            </div>
          )}

          {/* Segments (shifted down by 24px) */}
          {timeline.map((clip, idx) => {
            const left = (clip.start / duration) * 100;
            const width = ((clip.end - clip.start) / duration) * 100;
            const override = clipOverrides[clip.start.toString()];
            const clipName = clip.clip_name ?? '';
            const isGlobalStart = override?.is_global_start === true;
            const isGlobalEnd = override?.is_global_end === true;

            return (
              <div
                key={idx}
                className={`absolute top-[24px] bottom-0 border-r border-slate-950 transition-colors overflow-hidden ${getSegmentColor(clip.tag, clip.is_usable, override)}`}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`[${clip.tag}] ${clipName ? clipName + ' · ' : ''}${formatTime(clip.start)} - ${formatTime(clip.end)}`}
              >
                {/* Clip Label — Premiere-style hard clip, no ellipsis */}
                {clipName && (
                  <span className="absolute top-0 left-1 text-[9px] text-white font-light tracking-wide overflow-hidden whitespace-nowrap pointer-events-none z-[5] leading-tight pt-px">
                    {clipName}
                  </span>
                )}

                {/* Global Bookend Marker — vertical line at exact playhead position */}
                {(isGlobalStart || isGlobalEnd) && (() => {
                  const clipLen = clip.end - clip.start;
                  const bookendTime: number = isGlobalStart
                    ? (override?.bookend_start_time ?? clip.start)
                    : (override?.bookend_end_time ?? clip.end);
                  // Position within the clip block (0%=left edge, 100%=right edge)
                  const innerPct = Math.min(100, Math.max(0, ((bookendTime - clip.start) / clipLen) * 100));
                  return (
                    <>
                      {/* Vertical line at exact position */}
                      <div
                        className={`absolute top-0 bottom-0 w-[2px] z-20 pointer-events-none ${isGlobalStart ? 'bg-blue-500' : 'bg-purple-500'}`}
                        style={{ left: `${innerPct}%` }}
                      />
                      {/* Flag label next to the line */}
                      <div
                        className="absolute top-[3px] z-20 pointer-events-none"
                        style={{ left: `calc(${innerPct}% + 3px)` }}
                      >
                        <span className={`text-[7px] font-black px-0.5 py-px leading-none
                          ${isGlobalStart ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}
                        `}>
                          {isGlobalStart ? '[ IN' : 'OUT ]'}
                        </span>
                      </div>
                    </>
                  );
                })()}

                {/* Best Moment (BM) Native Indicator — clickable, seeks to best_moment */}
                {clip.best_moment && clip.best_moment > clip.start && clip.best_moment < clip.end && override !== 'TRASH' && (
                  <button
                    type="button"
                    className="absolute flex flex-col items-center z-10 cursor-pointer"
                    style={{
                      left: `${((clip.best_moment - clip.start) / (clip.end - clip.start)) * 100}%`,
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoRef.current) videoRef.current.currentTime = clip.best_moment as number;
                    }}
                    title={`Best Moment — ${(clip.best_moment as number).toFixed(2)}s`}
                  >
                    <div className="text-[12px] font-black drop-shadow-md text-yellow-400 hover:brightness-125 transition-all">
                      <svg width="7.5" height="10.5" viewBox="0 0 10 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
                        <path d="M0 0H10V10L5 14L0 10V0Z" />
                      </svg>
                    </div>
                  </button>
                )}
              </div>
            );
          })}

          {/* ── Marker Overlay — z-[20], above waveform, below playhead
               Each pin is clickable — seeks videoRef to the marker time. */}
          <div className="absolute top-[24px] bottom-0 left-0 right-0 z-[20] pointer-events-none">
            {timeline.map((clip) => {
              const constraints = userConstraints[clip.start.toString()] || [];
              return constraints.map((constraint, cIdx) => {
                const markerColor = MARKER_COLORS[constraint.type] ?? '#ffffff';
                // Absolute position within the inner (scaled) div
                const absoluteLeftPct = (constraint.time / duration) * 100;
                return (
                  <button
                    key={`${clip.start}-${cIdx}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoRef.current) videoRef.current.currentTime = constraint.time;
                    }}
                    className="absolute top-0 bottom-0 flex flex-col items-center cursor-pointer group/pin pointer-events-auto"
                    style={{
                      left: `${absoluteLeftPct}%`,
                      transform: 'translateX(-50%)',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                    }}
                  >
                    {/* Pin: colored line only, no label text (labels live in ruler bar above) */}
                    <div
                      className="w-px h-full pointer-events-none"
                      style={{
                        backgroundColor: markerColor,
                        boxShadow: `0 0 4px 1px ${markerColor}99`,
                      }}
                    />
                  </button>
                );
              });
            })}
          </div>

          {/* Hover overlay */}
          <div className="absolute top-[24px] bottom-0 left-0 right-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

          {audioWaveforms && audioDuration > 0 && (() => {
            const activeWaveform = audioWaveforms[waveformView] || [];
            if (activeWaveform.length === 0) return null;

            const pointsPerSecond = activeWaveform.length / audioDuration;
            const pointsToShow = Math.ceil(Math.min(duration, audioDuration) * pointsPerSecond);
            const visibleWaveform = activeWaveform.slice(0, pointsToShow);

            if (visibleWaveform.length === 0) return null;

            const svgWidth = 1000;
            const svgHeight = 100;
            const step = svgWidth / visibleWaveform.length;

            let pathD = `M 0,${svgHeight}`;
            visibleWaveform.forEach((val, i) => {
              const x = (i * step).toFixed(2);
              const y = (svgHeight - (val * svgHeight)).toFixed(2);
              pathD += ` L ${x},${y}`;
            });
            pathD += ` L ${svgWidth},${svgHeight} Z`;

            const waveformWidthPct = duration > 0 ? (Math.min(audioDuration, duration) / duration) * 100 : 0;

            return (
              <div 
                className="absolute top-[24px] bottom-0 left-0 opacity-80 pointer-events-none z-[15] mix-blend-screen overflow-hidden"
                style={{ width: `${waveformWidthPct}%` }}
              >
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="none" className="w-full h-full fill-emerald-400">
                  <path d={pathD} />
                </svg>
              </div>
            );
          })()}


          {/* Playhead — DC-style: SVG pentagon + thin centered line, white + dark glow */}
          <div
            ref={playheadRef}
            className="absolute top-[24px] bottom-0 z-[30] pointer-events-none flex flex-col items-center"
            style={{
              left: '0%',
              transform: 'translateX(-50%)',
            }}
          >
            {/* Thin pin line */}
            <div
              className="w-px flex-1"
              style={{
                backgroundColor: 'white',
                boxShadow: '0 0 5px 2px rgba(255,255,255,0.4), 0 0 1px 0px rgba(0,0,0,1)',
              }}
            />
            {/* Pentagon handle — pointing up */}
            <svg
              width="10"
              height="11"
              viewBox="0 0 10 11"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.9)) drop-shadow(0 2px 6px rgba(0,0,0,0.95))' }}
            >
              <path d="M0 11H10V6L5 0L0 6V11Z" fill="white" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Premiere-style Zoom Scrollbar ─────────────────────────────────── */}
      <div
        ref={scrollbarRef}
        className="relative w-full h-[10px] bg-slate-900/80 rounded-full cursor-pointer select-none border border-slate-800/60"
        onMouseDown={handleScrollbarMouseDown}
      >
        {/* Track fill indicator (dim background) */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          {/* Thumb */}
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

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 items-center justify-center text-[10px] uppercase font-bold tracking-wider text-slate-500">
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
        {zoomSpan < 0.99 && (
          <button
            onClick={() => setZoomWindow([0, 1])}
            className="text-slate-500 hover:text-slate-300 transition-colors normal-case font-mono text-[9px] border border-slate-700 px-1.5 py-0.5 rounded"
          >
            Reset Zoom
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

