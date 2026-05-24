import React, { useState, useEffect, useRef } from 'react';
import { History, ChevronDown, Clock, Bot } from 'lucide-react';
import type { VersionEntry } from '../../hooks/usePancakeData';

interface VersionHistoryDropdownProps {
  versions: VersionEntry[];
  activeVersion?: number;
  onSelectVersion: (entry: VersionEntry) => void;
  triggerComponent?: (isOpen: boolean) => React.ReactNode;
  dropdownDirection?: 'up' | 'down';
}

export const VersionHistoryDropdown: React.FC<VersionHistoryDropdownProps> = ({
  versions,
  activeVersion,
  onSelectVersion,
  triggerComponent,
  dropdownDirection = 'down'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!versions || versions.length === 0) return null;

  const defaultTrigger = (isOpen: boolean) => (
    <button
      className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md transition-all ${
        isOpen
          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
          : 'bg-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-700'
      }`}
      title="Version History — seleziona un taglio storico"
    >
      <History size={11} />
      <span className="tabular-nums">{versions.length}</span>
      <ChevronDown size={9} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  );

  return (
    <div className="relative" ref={containerRef} onClick={(e) => e.stopPropagation()}>
      <div onClick={() => setIsOpen(prev => !prev)} className="cursor-pointer">
        {triggerComponent ? triggerComponent(isOpen) : defaultTrigger(isOpen)}
      </div>

      {isOpen && (
        <div
          className={`absolute ${dropdownDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl shadow-black/60 z-50 overflow-hidden`}
        >
          <div className="px-3 py-2 border-b border-slate-700 flex items-center gap-2 cursor-default">
            <History size={11} className="text-amber-400" />
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Version History</span>
            <span className="ml-auto text-[9px] text-slate-500">
              {versions.length} cut{versions.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {[...versions].reverse().map((entry) => {
              const isActive = activeVersion === entry.version;
              const date = new Date(entry.timestamp);
              const dateLabel = date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
              const timeLabel = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
              const modelShort = entry.brain_model
                .replace('mlx-community/', '')
                .replace('-it-4bit', '')
                .replace('-Instruct-4bit', '');

              return (
                <button
                  key={entry.version}
                  onClick={() => {
                    setIsOpen(false);
                    onSelectVersion(entry);
                  }}
                  className={`w-full text-left px-3 py-2.5 border-b border-slate-800 last:border-0 transition-colors ${
                    isActive
                      ? 'bg-amber-500/10 border-l-2 border-l-amber-400'
                      : 'hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                        isActive ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      v{entry.version}
                    </span>
                    {entry.is_legacy && (
                      <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-slate-700 text-slate-500 uppercase">legacy</span>
                    )}
                    <div className="flex items-center gap-1 ml-auto text-[9px] text-slate-500">
                      <Clock size={8} />
                      <span>{dateLabel} · {timeLabel}</span>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-300 leading-relaxed line-clamp-2 mb-1">
                    {entry.director_vision || "Legacy cut (pre-versioning system)"}
                  </p>
                  <div className="flex items-center gap-2">
                    {entry.clip_count !== null && (
                      <span className="text-[8px] text-slate-500">{entry.clip_count} clip</span>
                    )}
                    {entry.duration_seconds != null ? (
                      <span className="text-[8px] text-slate-400 font-mono">
                        {Math.floor(entry.duration_seconds / 60).toString().padStart(2, '0')}:
                        {Math.floor(entry.duration_seconds % 60).toString().padStart(2, '0')}
                      </span>
                    ) : entry.inference_time_seconds !== null && (
                      <span className="text-[8px] text-slate-600 font-mono opacity-50" title="Legacy Inference Time">
                        {Math.floor(entry.inference_time_seconds / 60).toString().padStart(2, '0')}:
                        {Math.floor(entry.inference_time_seconds % 60).toString().padStart(2, '0')}
                      </span>
                    )}
                    <div className="flex items-center gap-1 ml-auto">
                      <Bot size={8} className="text-slate-600" />
                      <span className="text-[8px] text-slate-600 font-mono truncate max-w-[120px]">{modelShort}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
