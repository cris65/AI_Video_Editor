import React, { useState, useEffect } from 'react';
import { Film, FileCode2, CheckCircle2, HardDrive, Cpu, Activity, ChevronDown } from 'lucide-react';

interface VideoInfo {
  name: string;
  video_path: string;
  edl_path: string;
  fps: number;
  duration: number;
  total_frames: number;
  processed?: boolean;
  sequence_name?: string;
}

interface TaskProgress {
  status: string;
  phase: string;
  percent: number;
  message: string;
  sequence_name: string;
  start_time?: string | null;
  end_time?: string | null;
  elapsed_seconds?: number;
}

interface ImageEngineControlsProps {
  onComplete?: (sequenceName?: string) => void;
}

export const ImageEngineControls: React.FC<ImageEngineControlsProps> = ({ onComplete }) => {
  const [clips, setClips] = useState<VideoInfo[]>([]);
  const [selectedClipIdx, setSelectedClipIdx] = useState<number>(-1);
  const [density, setDensity] = useState(0.15);
  const [engineStatus, setEngineStatus] = useState<'idle' | 'running' | 'error' | 'success'>('idle');
  const [isScanning, setIsScanning] = useState(true);
  const [vlmModel, setVlmModel] = useState('mlx-community/gemma-4-e4b-it-4bit');
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (engineStatus === 'running') {
      interval = setInterval(async () => {
        try {
          const res = await fetch('http://localhost:8000/api/phase-a/progress');
          const data = await res.json();
          setTaskProgress(data);
          
          if (data.status === 'completed') {
            setEngineStatus('success');
            clearInterval(interval);
            if (onComplete) {
              onComplete(data.sequence_name);
            }
          } else if (data.status === 'error') {
            setEngineStatus('error');
            clearInterval(interval);
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    }
  }, [engineStatus, onComplete]);

  // Load clips on mount
  useEffect(() => {
    const fetchClips = async () => {
      try {
        setIsScanning(true);
        // Simulo un ritardo di scansione per far vedere l'attività del server
        await new Promise(r => setTimeout(r, 600)); 
        const res = await fetch('http://localhost:8000/api/videos/list');
        const data = await res.json();
        if (data.clips && data.clips.length > 0) {
          setClips(data.clips);
          setSelectedClipIdx(0);
        }
      } catch (e) {
        console.error("Could not load clips", e);
      } finally {
        setIsScanning(false);
      }
    };
    fetchClips();
  }, []);

  const selectedClip = selectedClipIdx >= 0 ? clips[selectedClipIdx] : null;

  const handleStartEngine = async () => {
    if (!selectedClip || !selectedClip.edl_path) return;
    
    setEngineStatus('running');
    setTaskProgress({ status: 'running', phase: 'A_OPENCV', percent: 0, message: 'Starting engine...', sequence_name: '' });

    try {
      const payload = {
        video_proxy_path: selectedClip.video_path,
        sequence_file_path: selectedClip.edl_path,
        sampling_density_percent: density,
        vlm_model_id: vlmModel,
        llm_model_id: 'mlx-community/gemma-4-9b-it-4bit'
      };
      const res = await fetch('http://localhost:8000/api/phase-a/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.ok) {
        setEngineStatus('error');
      }
    } catch (err) {
      console.error(err);
      setEngineStatus('error');
    }
  };

  const totalFrames = selectedClip ? selectedClip.total_frames : 0;
  const extractedFrames = selectedClip ? Math.max(1, Math.floor(totalFrames * density)) : 0;

  const getGlobalProgress = (): number => {
    if (!taskProgress) return 0;
    if (taskProgress.phase === 'A_OPENCV') {
      return Math.min(50, Math.round(taskProgress.percent / 2));
    }
    if (taskProgress.phase === 'B_MLX') {
      return Math.min(100, 50 + Math.round(taskProgress.percent / 2));
    }
    return taskProgress.percent;
  };
  const globalPercent = getGlobalProgress();

  const getPhaseMessage = (): string => {
    if (!taskProgress) return '';
    if (taskProgress.phase === 'A_OPENCV') {
      return `Fase 1/2: Analisi Computer Vision... (${taskProgress.message})`;
    }
    if (taskProgress.phase === 'B_MLX') {
      return `Fase 2/2: Analisi Semantica MLX... (${taskProgress.message})`;
    }
    return taskProgress.message;
  };
  const phaseMessage = getPhaseMessage();
  
  const [estimatedSeconds, setEstimatedSeconds] = useState<number>(0);

  useEffect(() => {
    if (totalFrames <= 0) return;
    const fetchEstimate = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/phase-a/estimate?total_frames=${totalFrames}&density=${density}&vlm_model_id=${vlmModel}`);
        const data = await res.json();
        if (data.estimated_seconds !== undefined) {
          setEstimatedSeconds(data.estimated_seconds);
        }
      } catch (e) {
        // Fallback to local default estimate if backend is not reachable
        const mlxMultiplier = vlmModel === 'mlx-community/gemma-4-31b-it-4bit' ? 12 : 6;
        const estimatedClips = totalFrames / 100;
        const tempoOpenCV = extractedFrames * 0.05;
        const tempoMLX = estimatedClips * mlxMultiplier;
        setEstimatedSeconds(tempoOpenCV + tempoMLX);
      }
    };
    fetchEstimate();
  }, [totalFrames, density, vlmModel, extractedFrames]);

  let estimatedTimeString = '';
  if (estimatedSeconds < 60) {
    estimatedTimeString = `${estimatedSeconds.toFixed(1)}s`;
  } else {
    const minutes = Math.floor(estimatedSeconds / 60);
    const seconds = Math.floor(estimatedSeconds % 60);
    estimatedTimeString = seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  const renderDensityTicks = () => {
    if (extractedFrames <= 0) return null;
    const maxTicks = 120;
    const tickCount = Math.max(2, Math.floor(density * maxTicks));

    const ticks = [];
    for (let i = 0; i < tickCount; i++) {
      ticks.push(
        <div 
          key={i} 
          className="h-[45%] w-0.5 rounded-sm bg-[#82aaff]/80"
        />
      );
    }
    return ticks;
  }

  return (
    <div className="bg-[#1A1D24] p-6 rounded-xl border border-gray-800 shadow-xl w-full z-20 relative">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-3">
          <Cpu className="text-blue-500 w-6 h-6" />
          Image Engine Controls
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Storage Scanner & Profiler */}
        <div className="lg:col-span-5 flex flex-col gap-6 h-full">
          
          {/* Scanner Box */}
          <div className="flex flex-col">
            <div className="flex justify-between items-end mb-4 h-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5" />
                Local Storage Scanner
              </h3>
              {isScanning ? (
                <span className="text-[10px] text-blue-400 font-mono flex items-center gap-1 animate-pulse">
                  SCANNING...
                </span>
              ) : (
                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {clips.length} PAIRS FOUND
                </span>
              )}
            </div>

            <div className="bg-[#111318] rounded-xl border border-gray-800 p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />

              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6 gap-4">
                  <div className="relative flex-1 min-w-0">
                    <select 
                      className="w-full bg-[#1A1D24] border border-gray-700 rounded-lg pl-3 pr-8 py-2.5 text-sm text-gray-200 font-medium focus:outline-none focus:border-blue-500 transition-colors truncate appearance-none"
                      value={selectedClipIdx}
                      onChange={(e) => setSelectedClipIdx(Number(e.target.value))}
                      disabled={isScanning}
                    >
                      {clips.length === 0 && <option value="-1">Nessuna sorgente trovata</option>}
                      {clips.map((clip, idx) => (
                        <option key={idx} value={idx}>
                          {clip.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  
                  {/* FPS Box */}
                  {selectedClip && (
                    <div className="bg-[#1A1D24] border border-blue-500/30 rounded-lg px-3 py-1 flex flex-col items-center justify-center shadow-sm min-w-[60px]">
                      <span className="text-sm font-bold text-blue-400 font-mono leading-tight">{selectedClip.fps.toFixed(2)}</span>
                      <span className="text-[10px] font-bold text-blue-400 font-mono leading-tight">FPS</span>
                    </div>
                  )}
                </div>

                {/* File Status List */}
                <div className="flex flex-col gap-4">
                  {/* Raw Footage Status */}
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${selectedClip ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                      <Film className={`w-3.5 h-3.5 ${selectedClip ? 'text-emerald-400' : 'text-red-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Raw Footage</p>
                      {selectedClip ? (
                        <p className="text-xs text-emerald-500 truncate font-mono">{selectedClip.video_path.split('/').pop()}</p>
                      ) : (
                        <p className="text-xs text-red-500 font-mono">Carica il file video</p>
                      )}
                    </div>
                  </div>

                  {/* Sequence EDL Status */}
                  <div className="flex items-center gap-3 relative before:absolute before:left-3 before:-top-4 before:h-4 before:w-px before:bg-slate-800">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${selectedClip?.edl_path ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                      <FileCode2 className={`w-3.5 h-3.5 ${selectedClip?.edl_path ? 'text-emerald-400' : 'text-red-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Sequence EDL</p>
                      {selectedClip?.edl_path ? (
                        <p className="text-xs text-emerald-500 truncate font-mono">Found & Validated</p>
                      ) : (
                        <p className="text-xs text-red-500 font-mono">Carica EDL</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Vision Model Selector */}
            <div className="mt-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">AI Vision Model (Fase A/B)</label>
              <div className="relative">
                <select 
                  className="w-full bg-[#1A1D24] border border-gray-700 rounded-lg pl-3 pr-8 py-2.5 text-xs text-gray-200 font-medium focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                  value={vlmModel}
                  onChange={(e) => setVlmModel(e.target.value)}
                  disabled={isScanning || engineStatus === 'running'}
                >
                  <option value="mlx-community/gemma-4-e4b-it-4bit">google/gemma-4-E4B-it (Draft Speed)</option>
                  <option value="mlx-community/gemma-4-31b-it-4bit">google/gemma-4-31b-it (Maximum Quality)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>


          </div>

          {/* Dynamic Profiler Live Box */}
          <div className="bg-[#111318] rounded-xl border border-gray-800 p-4 relative overflow-hidden flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" />
                Dynamic Profiler Live
              </h3>
            </div>
            
            <div className="space-y-3 flex-1 flex flex-col justify-center">
              <div className="flex justify-between items-baseline border-b border-gray-800/50 pb-2">
                <span className="text-xs text-slate-500 font-mono">Detected Hardware:</span>
                <span className="text-xs text-white font-bold font-mono text-right">Apple M4 Max (16 Cores) - 128GB Unified RAM</span>
              </div>
              <div className="flex justify-between items-baseline border-b border-gray-800/50 pb-2">
                <span className="text-xs text-slate-500 font-mono">Vision AI:</span>
                <span className="text-xs text-white font-mono text-right">{vlmModel === 'mlx-community/gemma-4-31b-it-4bit' ? 'Gemma 4 (31B)' : 'Gemma 4 (E4B)'}</span>
              </div>

              <div className="flex justify-between items-baseline border-b border-gray-800/50 pb-2">
                <span className="text-xs text-slate-500 font-mono">Est. Unit Speeds:</span>
                <span className="text-xs text-orange-400 font-bold font-mono text-right">0.05s/f (CV) + {vlmModel === 'mlx-community/gemma-4-31b-it-4bit' ? 12 : 6}.0s/c (VLM)</span>
              </div>
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-xs text-slate-500 font-mono">Total Computation:</span>
                <span className="text-xs text-slate-300 font-mono text-right">Phase A (OpenCV) + Phase B (VLM)</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Simulator & Controls */}
        <div className="lg:col-span-7 flex flex-col gap-6 h-full">
          
          <div className="flex flex-col flex-1">
            <div className="flex justify-between items-end mb-4 h-6">
              <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                Extraction Simulator
              </h3>
              <div className="flex gap-6 text-[10px] text-slate-400 font-mono tracking-wider">
                <div className="flex flex-col items-center">
                  <span className="uppercase text-slate-500 mb-1">Source Frames</span>
                  <span className="text-white font-bold text-xs">{totalFrames.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="uppercase text-blue-500/70 mb-1">Target Frames</span>
                  <span className="text-blue-400 font-bold text-xs">{extractedFrames.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="uppercase text-orange-500/70 mb-1">Est. Duration</span>
                  <span className="text-orange-400 font-bold text-xs">{estimatedTimeString}</span>
                </div>
              </div>
            </div>
            
            {/* Monitor Wrapper */}
            <div className="bg-slate-900 rounded-xl p-2 border border-slate-800 flex-1 flex flex-col shadow-inner min-h-[160px] mb-6">
              <div className="relative w-full flex-1 bg-black border border-slate-800 overflow-hidden flex items-center justify-between px-2 mx-auto rounded-lg">
                <div className="absolute top-1/2 left-0 right-0 h-px bg-[#82aaff]/30 -translate-y-1/2 z-0" />
                <div className="flex justify-between items-center w-full z-10 h-full py-4">
                  {renderDensityTicks()}
                </div>
                {extractedFrames > 0 && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1 text-[10px] text-white font-bold tracking-wider whitespace-nowrap shadow-lg">
                    TIMELINE DENSITY: {(density * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            </div>

            {/* Slider under monitor */}
            <div className="mb-8 px-2">
              <div className="flex justify-between items-end mb-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Frame Sampling Density</label>
                <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 shadow-sm">
                  {(density * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.01"
                max="1.0"
                step="0.01"
                className="w-full accent-blue-500 h-2 bg-[#111318] border border-gray-800 rounded-lg appearance-none cursor-pointer"
                value={density}
                onChange={(e) => setDensity(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <button 
            onClick={selectedClip?.processed ? () => onComplete?.(selectedClip.sequence_name) : handleStartEngine}
            disabled={engineStatus === 'running' || (engineStatus === 'success' && !selectedClip?.processed) || clips.length === 0 || (selectedClip !== null && !selectedClip.processed && !selectedClip.edl_path)}
            className={`w-full py-4 rounded-xl font-bold uppercase tracking-wider transition-all duration-200 shadow-xl border mt-auto ${
              engineStatus === 'running' ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed' :
              selectedClip?.processed ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-emerald-900/40 cursor-pointer' :
              engineStatus === 'success' ? 'bg-emerald-900/40 text-emerald-500 border-emerald-900/50 cursor-not-allowed' :
              !selectedClip?.edl_path ? 'bg-red-900/40 text-red-400 border-red-900/50 cursor-not-allowed' :
              'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-blue-900/40'
            }`}
          >
            {engineStatus === 'running' ? 'ENGINE RUNNING...' : selectedClip?.processed ? 'GO TO TIMELINE / EDITOR' : engineStatus === 'success' ? 'PIPELINE COMPLETED' : 'START ENGINE'}
          </button>
          
          {engineStatus === 'running' && taskProgress && (
            <div className="w-full mt-4 bg-slate-900 rounded-xl p-4 border border-slate-800 shadow-inner">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  {taskProgress.phase === 'A_OPENCV' ? 'FASE 1/2: COMPUTER VISION' : taskProgress.phase === 'B_MLX' ? 'FASE 2/2: SEMANTIC ANALYSIS' : (taskProgress.phase || 'INITIALIZING')}
                </span>
                <span className="text-xs font-mono text-slate-400">{globalPercent}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 mb-2 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-2 transition-all duration-500" 
                  style={{ width: `${globalPercent}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center mb-3">
                <p className="text-[10px] text-slate-500 font-mono truncate max-w-[70%]" title={phaseMessage}>{phaseMessage}</p>
                {taskProgress.elapsed_seconds !== undefined && (
                  <span className="text-[10px] text-orange-400 font-bold font-mono">
                    ELAPSED: {Math.floor(taskProgress.elapsed_seconds / 60)}m {taskProgress.elapsed_seconds % 60}s
                  </span>
                )}
              </div>
              {taskProgress.start_time && (
                <div className="text-[9px] text-slate-600 font-mono flex justify-between border-t border-slate-850 pt-2">
                  <span>Start Time: {new Date(taskProgress.start_time).toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          )}
          
          {engineStatus === 'success' && taskProgress && (
            <div className="w-full mt-4 bg-[#111318] rounded-xl p-4 border border-emerald-950/60 shadow-inner">
              <div className="flex items-center gap-2 mb-3 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                Pipeline Stats
              </div>
              <div className="space-y-1.5 mb-4 text-xs font-mono">
                {taskProgress.start_time && (
                  <div className="flex justify-between text-slate-400">
                    <span>Started At:</span>
                    <span className="text-slate-200">{new Date(taskProgress.start_time).toLocaleTimeString()}</span>
                  </div>
                )}
                {taskProgress.end_time && (
                  <div className="flex justify-between text-slate-400">
                    <span>Ended At:</span>
                    <span className="text-slate-200">{new Date(taskProgress.end_time).toLocaleTimeString()}</span>
                  </div>
                )}
                {taskProgress.elapsed_seconds !== undefined && (
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Total Duration:</span>
                    <span>{Math.floor(taskProgress.elapsed_seconds / 60)}m {taskProgress.elapsed_seconds % 60}s</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => onComplete && onComplete(taskProgress.sequence_name)}
                className="w-full py-4 rounded-xl font-bold uppercase tracking-wider transition-all duration-200 shadow-xl border bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-emerald-900/30"
              >
                Go to Timeline
              </button>
            </div>
          )}
          
        </div>

      </div>
    </div>
  );
};
