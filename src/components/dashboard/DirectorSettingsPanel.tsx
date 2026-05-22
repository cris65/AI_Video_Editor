import { useState, useEffect } from 'react';
import { DirectorConfig, AudioBeat } from '../../hooks/usePancakeData';
import { Wand2, RefreshCw, Settings2, Info, X } from 'lucide-react';
import { AdvancedDirectorModal } from './AdvancedDirectorModal';

interface DirectorSettingsPanelProps {
  config: DirectorConfig;
  audioBeats?: AudioBeat[];
  sourceResolution?: { width: number; height: number };
  onSave: (newConfig: DirectorConfig) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  saveStatus: string;
  sequenceFps: number;
}

// Micro-benchmark hook delegato al backend Python
function useHardwareProfiler() {
  const [profile, setProfile] = useState({
    name: 'Awaiting Python Benchmark...',
    inference_4b: 0.15,
    inference_31b: 1.8,
    isReady: false,
    isOfflineMock: false
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchHardwareProfile() {
      try {
        const response = await fetch('http://localhost:8000/api/system/profiler');
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        
        if (isMounted) {
          setProfile({
            name: data.hardware_detected,
            inference_4b: data.inference_time_4b,
            inference_31b: data.inference_time_31b,
            isReady: true,
            isOfflineMock: false
          });
        }
      } catch (error) {
        // Fallback gracefully if Python is offline
        if (isMounted) {
          setProfile({
            name: 'MOCK DATA (Python Offline)',
            inference_4b: 0.15,
            inference_31b: 1.8,
            isReady: true,
            isOfflineMock: true
          });
        }
      }
    }

    fetchHardwareProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  return profile;
}

export function DirectorSettingsPanel({
  config,
  audioBeats,
  sourceResolution,
  onSave,
  onRegenerate,
  isRegenerating,
  saveStatus
}: DirectorSettingsPanelProps) {
  const [localConfig, setLocalConfig] = useState<DirectorConfig>(config);
  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
  const [showHardwareInfo, setShowHardwareInfo] = useState(false);
  
  // Rilevamento hardware dinamico
  const hardware = useHardwareProfiler();

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  // --- Auto-Chunking Math ---
  const aiModel = localConfig.ai_model || 'gemma-4-4b';
  const analysisFps = localConfig.analysis_fps ?? 0.5;
  const targetDuration = localConfig.target_duration || 60;
  
  const inferenceTime = aiModel === 'gemma-4-31b' ? hardware.inference_31b : hardware.inference_4b;

  const totalFrames = Math.ceil(targetDuration * analysisFps);
  const totalTokens = (totalFrames * 840) + 4000;
  const requiredChunks = Math.ceil(totalTokens / 200000);
  const totalTimeSeconds = totalFrames * inferenceTime;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
  };

  return (
    <>
      <div className="p-4 pt-0 space-y-4 border-t border-slate-800 mt-1">
        {/* Visual Recap */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-3 shadow-inner">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">AI Brain</span>
            <span className="text-xs font-bold text-indigo-400">{localConfig.ai_model === 'gemma-4-31b' ? 'Gemma 4 (31B)' : 'Gemma 4 (E4B)'}</span>
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

        {/* ETA & Auto-Chunking Widget */}
        <div className="bg-slate-950/80 rounded-lg p-3 border border-slate-800 my-4 shadow-inner relative">
          <div className="grid grid-cols-3 gap-2 divide-x divide-slate-800">
            <div className="px-2 flex flex-col items-center justify-center text-center">
              <span 
                className="text-[9px] text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1 cursor-pointer hover:text-amber-500 transition-colors"
                onClick={() => setShowHardwareInfo(!showHardwareInfo)}
              >
                Estimated Time
                <Info size={10} />
              </span>
              <span className="text-sm font-bold text-amber-500 font-mono leading-none">{formatTime(totalTimeSeconds)}</span>
            </div>
            <div className="px-2 flex flex-col items-center justify-center text-center">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Analyzed Frames</span>
              <span className="text-sm font-bold text-slate-300 font-mono leading-none">{totalFrames}</span>
            </div>
            <div className="px-2 flex flex-col items-center justify-center text-center">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Batches (Chunks)</span>
              <span className="text-sm font-bold text-emerald-500 font-mono leading-none">{requiredChunks}</span>
            </div>
          </div>

          {/* Hardware Info Pop-up */}
          {showHardwareInfo && (
            <div className="absolute z-10 bottom-full left-0 right-0 mb-2 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-xl">
              <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-1">
                <span className="font-bold text-[10px] text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <Wand2 size={10} /> Dynamic Profiler Live
                </span>
                <button onClick={() => setShowHardwareInfo(false)} className="text-slate-500 hover:text-white"><X size={12} /></button>
              </div>
              
              {!hardware.isReady ? (
                <div className="text-center py-4 px-2 text-xs text-slate-400 animate-pulse font-mono flex items-center justify-center gap-2">
                  <RefreshCw size={12} className="animate-spin" />
                  Awaiting Python Benchmark...
                </div>
              ) : (
                <ul className="space-y-1.5 font-mono text-[9px] text-slate-300">
                  <li className="flex justify-between">
                    <span className="text-slate-500">Detected Hardware:</span>
                    <span className={`font-bold ${hardware.isOfflineMock ? 'text-amber-500' : 'text-white'}`}>{hardware.name}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-slate-500">Modello AI:</span>
                    <span>{aiModel === 'gemma-4-31b' ? 'Gemma 4 (31B)' : 'Gemma 4 (E4B)'}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-slate-500">Estimated Performance:</span>
                    <span className="text-amber-400 font-bold">{inferenceTime}s / frame</span>
                  </li>
                  <li className="flex justify-between pt-1 border-t border-slate-800/50 mt-1">
                    <span className="text-slate-500">Total Computation:</span>
                    <span>{totalFrames} frames × {inferenceTime}s</span>
                  </li>
                </ul>
              )}
            </div>
          )}
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
            {isRegenerating ? 'Processing...' : 'Regenerate Cut'}
          </button>
        </div>
      </div>

      {isAdvancedModalOpen && (
        <AdvancedDirectorModal 
          config={config} 
          audioBeats={audioBeats}
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
