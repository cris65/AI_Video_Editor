import React from 'react';
import { Keyboard } from 'lucide-react';

interface TimelineKeyboardShortcutsProps {
  /** Controls visibility of the popup. */
  isOpen: boolean;
  /** Toggle callback bound to the trigger button. */
  onToggle: () => void;
  /** DC mode adds: L (lock), Alt+I/O (bookend). Stringout mode adds: Audio marker, Zoom scroll. */
  mode: 'stringout' | 'director_cut';
  hiddenMarkers?: string[];
  toggleMarkerVisibility?: (type: string) => void;
}

const KBD: React.FC<{ children: React.ReactNode; variant?: 'default' | 'green' | 'red' | 'blue' | 'amber' | 'orange' | 'yellow' }> = ({ children, variant = 'default' }) => {
  const cls: Record<string, string> = {
    default: 'bg-slate-800 text-slate-300 border-slate-700',
    green: 'bg-[#4CAF5020] text-[#4CAF50] border-[#4CAF5055]',
    red: 'bg-red-900/50 text-red-400 border-red-800/50',
    blue: 'bg-blue-900/50 text-blue-400 border-blue-800/50',
    amber: 'bg-amber-900/50 text-amber-400 border-amber-800/50',
    orange: 'bg-[#FF6D0020] text-[#FF6D00] border-[#FF6D0055]',
    yellow: 'bg-[#FFC10720] text-[#FFC107] border-[#FFC10755]',
  };
  return (
    <kbd className={`px-1.5 py-0.5 rounded font-mono text-[10px] border ${cls[variant]}`}>
      {children}
    </kbd>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex justify-between items-center">
    <span>{label}</span>
    {children}
  </div>
);

/**
 * Shared keyboard shortcuts popup trigger + panel.
 * Renders the trigger button and, when open, an absolute popup above it.
 * Mode-specific shortcuts are conditionally rendered via the `mode` prop.
 */
export const TimelineKeyboardShortcuts: React.FC<TimelineKeyboardShortcutsProps> = ({
  isOpen,
  onToggle,
  mode,
  hiddenMarkers = [],
  toggleMarkerVisibility,
}) => (
  <div className="relative">
    <button
      id={`btn-kb-shortcuts-${mode}`}
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all border ${isOpen
          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
          : 'bg-slate-800/80 text-slate-400 hover:text-slate-300 border-slate-700/40'
        }`}
      title="Marker & Navigation Control"
    >
      <Keyboard size={12} className="text-blue-400/80" />
      <span className="tracking-wider uppercase font-sans">Marker & Navigation Control</span>
    </button>

    {isOpen && (
      <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-[520px] p-4 bg-slate-900 border border-slate-700 rounded-lg shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-[100]">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-slate-200 font-bold text-[11px] uppercase tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Marker & Navigation Control
          </h4>
          <button onClick={onToggle} className="text-slate-500 hover:text-slate-300">✕</button>
        </div>

        <div className="space-y-4 text-slate-400 text-[10px] font-sans">
          {/* Marker Visibility */}
          {toggleMarkerVisibility && (
            <div>
              <h5 className="text-slate-300 font-bold mb-1.5 border-b border-slate-700/50 pb-1 uppercase text-[9px] tracking-wider text-pink-400/80">Marker Visibility</h5>
              <div className="flex gap-2 items-center flex-wrap">
                {[
                  { type: 'IN', label: 'IN', color: 'bg-green-500', text: 'text-green-500', border: 'border-green-500' },
                  { type: 'OUT', label: 'OUT', color: 'bg-red-500', text: 'text-red-500', border: 'border-red-500' },
                  { type: 'BM', label: 'M#', color: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500' },
                  { type: 'AUDIO', label: '♪', color: 'bg-yellow-500', text: 'text-yellow-500', border: 'border-yellow-500' },
                  { type: 'YOLO_BM', label: 'BM Analysis', color: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500' }
                ].map((marker) => {
                  const isHidden = hiddenMarkers.includes(marker.type);
                  return (
                    <button
                      key={marker.type}
                      onClick={() => toggleMarkerVisibility(marker.type)}
                      className={`px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase transition-all flex items-center gap-1
                        ${isHidden 
                          ? 'opacity-40 border-slate-600 bg-slate-800 text-slate-400' 
                          : `opacity-100 ${marker.border}/30 ${marker.color}/10 ${marker.text}`
                        }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isHidden ? 'bg-slate-500' : marker.color}`} />
                      {marker.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div>
            <h5 className="text-slate-300 font-bold mb-1.5 border-b border-slate-700/50 pb-1 uppercase text-[9px] tracking-wider text-blue-400/80">Global Navigation</h5>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              <Row label="Play / Pause"><KBD>Space</KBD></Row>
              <Row label="10 Frames"><KBD>← / →</KBD></Row>
              <Row label="1 Frame"><KBD>Shift + ← / →</KBD></Row>
              <Row label="30 Frames"><KBD>Alt + ← / →</KBD></Row>
              <Row label="Previous / Next Clip"><KBD>↑ / ↓</KBD></Row>
            </div>
          </div>

          {/* Timeline Interaction */}
          <div>
            <h5 className="text-slate-300 font-bold mb-1.5 border-b border-slate-700/50 pb-1 uppercase text-[9px] tracking-wider text-amber-400/80">Timeline Interaction</h5>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {mode === 'stringout' && <Row label="Zoom In / Out"><KBD>⌃ + Scroll</KBD></Row>}
              <Row label="Pan Timeline View"><KBD>P + Drag</KBD></Row>
              <Row label="Scrub Playhead"><KBD>P + L + Drag</KBD></Row>
              {mode === 'director_cut' && <Row label="Toggle Lock (Anchor Clip)"><KBD variant="blue">L</KBD></Row>}
            </div>
          </div>

          {/* Markers & Status */}
          <div>
            <h5 className="text-slate-300 font-bold mb-1.5 border-b border-slate-700/50 pb-1 uppercase text-[9px] tracking-wider text-emerald-400/80">Markers &amp; Status (Hovering Clip)</h5>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              <Row label="Marker IN / OUT"><KBD variant="green">I / O</KBD></Row>
              <Row label="Remove IN / OUT"><KBD>Shift + I / O</KBD></Row>
              <Row label="Marker BM (M#)"><KBD variant="orange">M</KBD></Row>
              <Row label="Remove BM Markers"><KBD>Shift + M</KBD></Row>
              {mode === 'stringout' && <Row label="Marker Audio (♪)"><KBD variant="yellow">A</KBD></Row>}
              {mode === 'stringout' && <Row label="Remove Audio Markers"><KBD>Shift + A</KBD></Row>}
              <Row label="Force Status: KEEP"><KBD variant="amber">K</KBD></Row>
              {/* TRASH REGRESSION GUARD — T key must always appear */}
              <Row label="Force Status: TRASH"><KBD variant="red">T</KBD></Row>
              <Row label="Force Status: B-ROLL"><KBD variant="blue">B</KBD></Row>
              <Row label="Remove Single Marker"><KBD>X</KBD></Row>
              <Row label="Remove All Markers"><KBD>Shift + X</KBD></Row>
              {mode === 'director_cut' && (
                <>
                  <div className="col-span-2 w-full h-px bg-slate-800/50 my-0.5" />
                  <Row label="Sequence IN (Bookend)"><KBD variant="blue">Alt + I</KBD></Row>
                  <Row label="Sequence OUT (Bookend)"><KBD variant="blue">Alt + O</KBD></Row>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);
