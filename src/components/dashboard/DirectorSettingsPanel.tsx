import { useState, useEffect } from 'react';
import { DirectorConfig, AudioBeat } from '../../hooks/usePancakeData';
import { Wand2, RefreshCw, Settings2 } from 'lucide-react';
import { AdvancedDirectorModal } from './AdvancedDirectorModal';

interface DirectorSettingsPanelProps {
  config: DirectorConfig;
  audioBeats?: AudioBeat[];
  audioBpm?: number | null;
  sourceResolution?: { width: number; height: number };
  onSave: (newConfig: DirectorConfig) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  saveStatus: string;
  regenerationElapsed?: number;
}

export function DirectorSettingsPanel({
  config,
  audioBeats,
  audioBpm,
  sourceResolution,
  onSave,
  onRegenerate,
  isRegenerating,
  saveStatus,
  regenerationElapsed = 0
}: DirectorSettingsPanelProps) {
  const [localConfig, setLocalConfig] = useState<DirectorConfig>(config);
  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
  
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // --- Auto-Chunking Math ---
  const analysisFps = localConfig.analysis_fps ?? 0.5;
  const targetDuration = localConfig.target_duration || 60;
  
  const totalFrames = Math.ceil(targetDuration * analysisFps);
  const totalTokens = (totalFrames * 840) + 4000;
  const requiredChunks = Math.ceil(totalTokens / 200000);

  const formatElapsedTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <>
      <div className="p-4 pt-0 space-y-4 border-t border-slate-800 mt-1">
        {/* Visual Recap */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3 shadow-inner">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">AI Brain</span>
            <span className="text-xs font-bold text-indigo-400">{localConfig.ai_model === 'llama-3.3-70b' ? 'Llama 3.3 (70B)' : localConfig.ai_model === 'gemma-4-31b' ? 'Gemma 4 (31B)' : 'Gemma 4 (E4B)'}</span>
          </div>
          
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Target Duration</span>
            <span className="text-xs font-bold font-mono text-sky-400">{localConfig.target_duration || 60}s</span>
          </div>
          
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Duration Mode</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${localConfig.duration_mode === 'STRICT' ? 'bg-rose-900/40 text-rose-400 border border-rose-500/30' : 'bg-sky-900/40 text-sky-400 border border-sky-500/30'}`}>
              {localConfig.duration_mode ?? 'ORGANIC'}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Resolution</span>
            <span className="text-xs font-bold font-mono text-slate-300">{localConfig.export_resolution || '1920x1080'}</span>
          </div>
        </div>

        {/* Info & Auto-Chunking Widget */}
        <div className="bg-slate-950/80 rounded-lg p-3 border border-slate-800 my-4 shadow-inner relative">
          <div className="grid grid-cols-2 gap-2 divide-x divide-slate-800">
            <div className="px-2 flex flex-col items-center justify-center text-center">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Analyzed Frames</span>
              <span className="text-sm font-bold text-slate-300 font-mono leading-none">{totalFrames}</span>
            </div>
            <div className="px-2 flex flex-col items-center justify-center text-center">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Batches (Chunks)</span>
              <span className="text-sm font-bold text-emerald-500 font-mono leading-none">{requiredChunks}</span>
            </div>
          </div>
        </div>

        {/* Advanced Settings Trigger */}
        <div className="pt-2">
          <button 
            onClick={() => setIsAdvancedModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-md transition-all bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 shadow-sm"
          >
            <Settings2 size={14} />
            🎨 AI Director Creative Settings
          </button>
        </div>

        {/* Regeneration Action */}
        <div className="mt-4 pt-4 border-t border-slate-800">
          <button
            onClick={onRegenerate}
            disabled={isRegenerating || saveStatus === 'saving'}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-md transition-all ${
              isRegenerating || saveStatus === 'saving' ? 'bg-amber-500/20 text-amber-500' 
              : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30'
            }`}
          >
            {isRegenerating ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Wand2 size={14} />
            )}
            {isRegenerating ? `Processing... (Elapsed: ${formatElapsedTimer(regenerationElapsed)})` : 'Regenerate Cut'}
          </button>
        </div>
      </div>

      {isAdvancedModalOpen && (
        <AdvancedDirectorModal 
          config={config} 
          audioBeats={audioBeats}
          audioBpm={audioBpm}
          sourceResolution={sourceResolution}
          onClose={(newConfig) => {
            setIsAdvancedModalOpen(false);
            if (newConfig) {
              setLocalConfig(newConfig);
              onSave(newConfig);
            }
          }}
        />
      )}
    </>
  );
}
