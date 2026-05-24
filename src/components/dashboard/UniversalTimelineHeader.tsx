import React from 'react';
import { TimelineKeyboardShortcuts } from './TimelineKeyboardShortcuts';
import { SlidersHorizontal, Save } from 'lucide-react';

interface UniversalTimelineHeaderProps {
  mode: 'stringout' | 'director_cut';
  formattedTime: string;
  totalDuration: number;
  // Keyboard Shortcuts
  showShortcutsPopup: boolean;
  setShowShortcutsPopup: (val: boolean) => void;
  // Audio state
  waveformView?: 'amplitude' | 'energy';
  setWaveformView?: (view: 'amplitude' | 'energy') => void;
  audioMarkerFilters?: { types: string[]; minEnergy: number };
  setAudioMarkerFilters?: (filters: { types: string[]; minEnergy: number }) => void;
  // Director's Cut specific actions
  dcActions?: {
    onBookendStart: () => void;
    onBookendEnd: () => void;
    onLockToggle: () => void;
    onDirectExportDC: () => void;
  };
}

export const UniversalTimelineHeader: React.FC<UniversalTimelineHeaderProps> = ({
  mode,
  formattedTime,
  totalDuration,
  showShortcutsPopup,
  setShowShortcutsPopup,
  waveformView,
  setWaveformView,
  audioMarkerFilters,
  setAudioMarkerFilters,
  dcActions
}) => {
  const [isWaveformPopupOpen, setIsWaveformPopupOpen] = React.useState(false);
  const [isAudioPopupOpen, setIsAudioPopupOpen] = React.useState(false);

  const formatTotalTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex justify-between items-center mb-2 px-2 relative">

      {/* ── Left: Time only ────────────────────────────────── */}
      <div className="flex items-center">
        <span className="text-blue-400 font-bold font-mono tracking-widest min-w-[80px]">
          {formattedTime}
        </span>
      </div>

      {/* ── Center: Clip Legend + Controls ──────────────────── */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 z-[100]">

        {/* Clip color legend — stringout only */}
        {mode === 'stringout' && (
          <div className="flex items-center gap-3 text-[9px] uppercase font-bold tracking-widest">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-slate-500">A-ROLL</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-slate-500">B-ROLL</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-slate-500">REJECTED</span>
            </div>
          </div>
        )}

        {/* Separator between legend and controls — stringout only */}
        {mode === 'stringout' && (
          <span className="text-slate-700 select-none">|</span>
        )}

        {/* Waveform Control — stringout only */}
        {mode === 'stringout' && setWaveformView && (
          <div className="relative flex items-center justify-center">
            <button
              onClick={() => {
                setIsWaveformPopupOpen(!isWaveformPopupOpen);
                setIsAudioPopupOpen(false);
                setShowShortcutsPopup(false);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all focus:outline-none hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                isWaveformPopupOpen
                  ? 'bg-[#3b82f6]/15 text-[#3b82f6]'
                  : 'bg-transparent hover:bg-slate-700/40 text-slate-400 hover:text-slate-200'
              }`}
              title="Waveform Control"
            >
              <span className="text-[14px] leading-none">🌊</span>
              <span className="text-[10px] font-semibold tracking-wider uppercase font-sans">Wave</span>
            </button>

            {isWaveformPopupOpen && (
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-[240px] p-4 bg-slate-900 border border-slate-700 rounded-lg shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[100]">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-slate-200 font-bold text-[11px] uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" /> Waveform View
                  </h4>
                  <button onClick={() => setIsWaveformPopupOpen(false)} className="text-slate-500 hover:text-slate-300">✕</button>
                </div>
                <div className="flex bg-slate-800/50 p-1 rounded-md border border-slate-700/50">
                  <button
                    onClick={() => setWaveformView('amplitude')}
                    className={`flex-1 py-1.5 text-[10px] font-sans rounded transition-colors ${
                      waveformView === 'amplitude' ? 'bg-slate-700 text-slate-100 shadow-sm' : 'text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    Amplitude
                  </button>
                  <button
                    onClick={() => setWaveformView('energy')}
                    className={`flex-1 py-1.5 text-[10px] font-sans rounded transition-colors ${
                      waveformView === 'energy' ? 'bg-slate-700 text-slate-100 shadow-sm' : 'text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    Energy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audio Marker Control — stringout only */}
        {mode === 'stringout' && audioMarkerFilters && setAudioMarkerFilters && (
          <div className="relative flex items-center justify-center">
            <button
              onClick={() => {
                setIsAudioPopupOpen(!isAudioPopupOpen);
                setIsWaveformPopupOpen(false);
                setShowShortcutsPopup(false);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all focus:outline-none hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                isAudioPopupOpen
                  ? 'bg-[#FFC107]/15 text-[#FFC107]'
                  : 'bg-transparent hover:bg-slate-700/40 text-slate-400 hover:text-slate-200'
              }`}
              title="Audio Marker Control"
            >
              <SlidersHorizontal size={14} className={isAudioPopupOpen ? 'text-[#FFC107]' : 'text-yellow-500/80'} />
              <span className="text-[10px] font-semibold tracking-wider uppercase font-sans">Audio</span>
            </button>

            {isAudioPopupOpen && (
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-[240px] p-4 bg-slate-900 border border-slate-700 rounded-lg shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[100]">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-slate-200 font-bold text-[11px] uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFC107]" /> Marker Filters
                  </h4>
                  <button onClick={() => setIsAudioPopupOpen(false)} className="text-slate-500 hover:text-slate-300">✕</button>
                </div>
                <div className="space-y-4">
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
                                  : audioMarkerFilters.types.filter((type: string) => type !== t);
                                setAudioMarkerFilters({ ...audioMarkerFilters, types: newTypes });
                              }}
                            />
                            {labelText}
                          </label>
                        );
                      })}
                    </div>
                  </div>
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

        {/* Keyboard Shortcuts — always visible */}
        <TimelineKeyboardShortcuts
          isOpen={showShortcutsPopup}
          onToggle={() => {
            setShowShortcutsPopup(!showShortcutsPopup);
            setIsAudioPopupOpen(false);
            setIsWaveformPopupOpen(false);
          }}
          mode={mode}
        />

        {/* DC Bookend buttons — director_cut only, inside center */}
        {mode === 'director_cut' && dcActions && (
          <div className="flex items-center gap-2 ml-2 border-l border-slate-700 pl-4">
            <button
              onClick={dcActions.onBookendStart}
              className="px-2 py-1 text-[10px] font-bold bg-blue-900/30 text-blue-400 hover:bg-blue-800/50 rounded transition-colors border border-blue-900/50"
            >
              [ IN
            </button>
            <button
              onClick={dcActions.onBookendEnd}
              className="px-2 py-1 text-[10px] font-bold bg-purple-900/30 text-purple-400 hover:bg-purple-800/50 rounded transition-colors border border-purple-900/50"
            >
              OUT ]
            </button>
          </div>
        )}

      </div>

      {/* ── Right: Duration / Save ──────────────────────────── */}
      <div className="flex items-center gap-4">
        {mode === 'stringout' ? (
          <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-slate-400">
            {formatTotalTime(totalDuration)}
          </div>
        ) : (
          <button
            onClick={dcActions?.onDirectExportDC}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[11px] font-bold shadow-lg shadow-indigo-900/20 transition-all border border-indigo-500"
          >
            <Save size={14} />
            SAVE ORDER
          </button>
        )}
      </div>

    </div>
  );
};
