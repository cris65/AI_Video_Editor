import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DirectorConfig, AudioBeat } from '../../hooks/usePancakeData';
import { X, Check } from 'lucide-react';

// ----------------------------------------------------------------------------
// GRAPHICAL VISUALIZERS FOR AUDIO & RHYTHM TAB
// ----------------------------------------------------------------------------

function RhythmicStrictnessVisualizer({ strictness }: { strictness: number }) {
  const bleedPx = Math.max(0, (50 - strictness) * 2);
  
  return (
    <div className="w-full h-24 bg-slate-900 rounded-lg overflow-hidden relative border border-slate-800 mt-4 flex items-center px-4">
      {/* Background Fake Waveform - Sharp Peaks */}
      <div className="absolute inset-0 opacity-40 flex items-end justify-center pb-2">
        <svg width="100%" height="70%" preserveAspectRatio="none" viewBox="0 0 100 100">
           <path 
             d="M0,100 L5,100 C7.5,100 7.5,30 10,30 C12.5,30 12.5,100 15,100 L25,100 C27.5,100 27.5,60 30,60 C32.5,60 32.5,100 35,100 L45,100 C47.5,100 47.5,15 50,15 C52.5,15 52.5,100 55,100 L65,100 C67.5,100 67.5,50 70,50 C72.5,50 72.5,100 75,100 L85,100 C87.5,100 87.5,25 90,25 C92.5,25 92.5,100 95,100 L100,100" 
             fill="none" 
             stroke="#f59e0b" 
             strokeWidth="2" 
             strokeLinejoin="round"
             strokeLinecap="round" 
             vectorEffect="non-scaling-stroke" 
           />
        </svg>
      </div>

      {/* Musical Grid Lines (Beats) */}
      <div className="absolute inset-0 flex justify-between px-12 items-center opacity-60">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-full w-px bg-amber-500/80 flex flex-col pt-1 items-center">
            <span className="text-[7px] text-amber-500 bg-slate-900/80 px-0.5 rounded">♪ Beat</span>
          </div>
        ))}
      </div>
      
      {/* Thick CUT Clips */}
      <div className="relative w-full flex justify-center gap-4 z-10">
        <div 
          className="h-6 bg-blue-500/80 rounded-none border border-blue-400 transition-all duration-300 shadow-lg flex justify-center items-center"
          style={{ width: `calc(40% + ${bleedPx}px)`, marginLeft: `-${bleedPx/2}px` }}
        >
          <span className="text-[9px] text-white font-bold tracking-wider">Clip A</span>
        </div>
        <div 
          className="h-6 bg-indigo-500/80 rounded-none border border-indigo-400 transition-all duration-300 shadow-lg flex justify-center items-center"
          style={{ width: `calc(40% + ${bleedPx}px)`, marginRight: `-${bleedPx/2}px` }}
        >
          <span className="text-[9px] text-white font-bold tracking-wider">Clip B</span>
        </div>
      </div>
      
      {/* Indicator Text */}
      <div className="absolute inset-0 flex items-end justify-center pointer-events-none pb-1 z-20">
        <span className="text-[8px] font-bold uppercase tracking-widest text-white/70 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
          {strictness >= 80 ? 'Surgical Cuts' : strictness <= 20 ? 'Organic Narrative' : 'Balanced Sync'}
        </span>
      </div>
    </div>
  );
}

function EnergyThresholdVisualizer({ threshold, audioBeats }: { threshold: number, audioBeats?: AudioBeat[] }) {
  // Use real audio beats if available, otherwise fallback to fake peaks
  let points = "";
  if (audioBeats && audioBeats.length > 0) {
    points = audioBeats.map((b, i) => {
      const x = (i / (audioBeats.length - 1)) * 1000;
      const y = 100 - (Math.min(1.0, b.energy ?? 0.5) * 100);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  } else {
    const fakeEnergies = [0.1, 0.4, 0.8, 0.3, 0.2, 0.9, 0.7, 0.5, 0.1, 0.6, 1.0, 0.4, 0.3, 0.8, 0.2];
    points = fakeEnergies.map((e, i) => {
      const x = (i / (fakeEnergies.length - 1)) * 1000;
      const y = 100 - (e * 100);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  const lineY = 100 - (threshold * 100);

  return (
    <div className="w-full h-32 bg-slate-900 rounded-lg overflow-hidden relative border border-slate-800 mt-2 flex items-center justify-center p-4">
      <div className="absolute inset-0 pt-6 pb-2 px-4">
        <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="thresholdGrad" x1="0" y1="0" x2="0" y2="100%">
              <stop offset={`${lineY}%`} stopColor="#f59e0b" /> {/* amber-500 */}
              <stop offset={`${lineY}%`} stopColor="#475569" /> {/* slate-600 */}
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
          </defs>

          {/* Threshold Line */}
          <line x1="0" y1={lineY} x2="1000" y2={lineY} stroke="#ef4444" strokeWidth="1" strokeDasharray="4 4" opacity="0.8" />
          <text x="0" y={lineY - 4} fill="#ef4444" fontSize="12" fontWeight="bold" fontFamily="monospace" opacity="0.8">CUTOFF</text>
          
          {/* Peak Path */}
          <polyline 
            points={points} 
            fill="none" 
            stroke="url(#thresholdGrad)" 
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

function MarkerStrategyVisualizer({ strategy }: { strategy: string }) {
  return (
    <div className="w-full h-24 bg-slate-900 rounded-lg relative border border-slate-800 mt-4 flex items-center justify-center p-2">
      {/* Central Marker */}
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-emerald-500/50 z-0 border-l border-dashed border-emerald-500" />
      <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-emerald-950 border border-emerald-500 text-emerald-500 text-[10px] px-1 rounded z-10">♪ Beat</div>

      {strategy === 'HARD_CUT' && (
        <div className="flex w-full h-10 gap-1 relative z-10 items-center justify-center">
          <div className="h-full bg-blue-600/80 rounded-l border border-blue-400 w-1/2 ml-4 flex items-center justify-end pr-2 text-[8px] text-white/70 font-bold">Clip A</div>
          <div className="h-full bg-indigo-600/80 rounded-r border border-indigo-400 w-1/2 mr-4 flex items-center pl-2 text-[8px] text-white/70 font-bold">Clip B</div>
        </div>
      )}

      {strategy === 'BROLL_BRIDGE' && (
        <div className="flex flex-col w-full h-full justify-center relative z-10 mt-4">
          <div className="h-6 bg-purple-500/80 rounded border border-purple-400 w-1/3 mx-auto flex items-center justify-center text-[8px] text-white font-bold mb-1 shadow-lg z-20">B-Roll</div>
          <div className="h-6 bg-blue-600/80 rounded border border-blue-400 w-3/4 mx-auto flex items-center justify-center text-[8px] text-white/50 z-10 opacity-60">Continuous A-Roll</div>
        </div>
      )}

      {strategy === 'DYNAMIC_PRIORITY' && (
        <div className="flex flex-col w-full h-full items-center justify-center relative z-10 mt-2">
          <div className="text-[20px] mb-1 animate-bounce">🧠</div>
          <div className="text-[8px] text-emerald-400 font-bold uppercase tracking-wider">AI Chooses Strategy</div>
        </div>
      )}
    </div>
  );
}

interface AdvancedDirectorModalProps {
  config: DirectorConfig;
  audioBeats?: AudioBeat[];
  audioBpm?: number | null;
  audioDuration?: number | null;
  sourceResolution?: { width: number; height: number };
  onClose: (newConfig?: DirectorConfig) => void;
}

export function AdvancedDirectorModal({ config, audioBeats, audioBpm, audioDuration, sourceResolution, onClose }: AdvancedDirectorModalProps) {
  const [localConfig, setLocalConfig] = useState<DirectorConfig>(config);
  const [activeTab, setActiveTab] = useState<'visual' | 'audio' | 'system'>('visual');

  const isAudioLocked = Boolean(audioDuration && localConfig.target_duration === audioDuration);

  // Sync if needed, though mostly it runs isolated
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (key: keyof DirectorConfig, value: any) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveAndClose = () => {
    onClose(localConfig);
  };

  const handleCancel = () => {
    onClose(); // No args = no save
  };

  // --- Safe Zone Math ---
  const srcW = sourceResolution?.width || 1920;
  const srcH = sourceResolution?.height || 1080;

  const boxWidthPct = 40;
  const maxMargin = 60; // 100 - 40

  let safeZoneMargin = localConfig.safe_zone_margin ?? 30;
  if (safeZoneMargin > maxMargin) safeZoneMargin = maxMargin;
  if (safeZoneMargin < 0) safeZoneMargin = 0;
  
  const rightMargin = maxMargin - safeZoneMargin;

  return createPortal(
  <div className="fixed inset-0 z-system-modal flex items-center justify-center p-4 sm:p-8 bg-slate-950/90 backdrop-blur-md">
      <div className="w-full max-w-6xl h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex flex-col border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between p-6 pb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-200 tracking-wider flex items-center gap-2">
                🎨 AI Director Creative Settings
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Configure Machine Vision targets, NLP prompts, and audio/rhythm synchronization parameters.
              </p>
            </div>
            <button 
              onClick={handleCancel}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          {/* TABS */}
          <div className="flex px-6 gap-6">
            <button 
              onClick={() => setActiveTab('visual')}
              className={`py-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-colors ${activeTab === 'visual' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              Visual & Narrative
            </button>
            <button 
              onClick={() => setActiveTab('audio')}
              className={`py-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-colors ${activeTab === 'audio' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              Audio & Rhythm
            </button>
            <button 
              onClick={() => setActiveTab('system')}
              className={`py-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-colors ${activeTab === 'system' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              Engine & System
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {activeTab === 'visual' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            
            {/* LEFT COLUMN: Textual & ML Parameters */}
            <div className="space-y-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                    Vision Targets
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-2">Target Product (Hero Object)</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg text-sm px-4 py-3 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" 
                        placeholder="e.g. Red Sports Car, Smartphone..."
                        value={localConfig.target_product || ""}
                        onChange={(e) => handleChange('target_product', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-2">Expected Subjects (Global Count)</label>
                      <input 
                        type="number" 
                        min="0"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg text-sm px-4 py-3 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" 
                        placeholder="e.g. 1"
                        value={localConfig.expected_subjects ?? 1}
                        onChange={(e) => handleChange('expected_subjects', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-2">Secondary Elements</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg text-sm px-4 py-3 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500" 
                        placeholder="e.g. Trees, Animals, Background extras..."
                        value={localConfig.secondary_elements || ""}
                        onChange={(e) => handleChange('secondary_elements', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2 mt-8">
                    NLP Directives
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-2">Director's Vision (Positive Prompt)</label>
                      <textarea 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg text-sm px-4 py-3 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 h-28 resize-none" 
                        placeholder="e.g. Fast-paced style, quick cuts, high energy..."
                        value={localConfig.style_prompt || ""}
                        onChange={(e) => handleChange('style_prompt', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-2">Ignore List (Negative Prompt)</label>
                      <textarea 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg text-sm px-4 py-3 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 h-20 resize-none" 
                        placeholder="e.g. Blurry shots, people talking..."
                        value={localConfig.ignore_list || ""}
                        onChange={(e) => handleChange('ignore_list', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Safe Zone Interactive UI */}
            <div>
              <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                Spatial Tracking
              </h3>
              
              <div className="pt-2 pb-2">
                <div className="flex justify-between items-end mb-4">
                  <label className="block text-sm text-white font-bold tracking-wider">
                    Focus Area Configurator (Deep Analysis)
                  </label>
                  <div className="flex gap-6 text-[10px] text-slate-400 font-mono tracking-wider">
                    <div className="flex flex-col items-end">
                      <span className="uppercase text-slate-500 mb-1">Left Margin</span>
                      <span className="text-white font-bold text-xs">{safeZoneMargin.toFixed(1)}%</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="uppercase text-slate-500 mb-1">Focus Area</span>
                      <span className="text-white font-bold text-xs">{boxWidthPct}%</span>
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="uppercase text-slate-500 mb-1">Right Margin</span>
                      <span className="text-white font-bold text-xs">{rightMargin.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                
                {/* Monitor Wrapper */}
                <div className="bg-slate-900 rounded-xl p-4 lg:p-6 border border-slate-800">
                  <div 
                    className="relative w-full bg-black border border-slate-800 overflow-hidden flex items-center justify-center mx-auto shadow-inner"
                    style={{ aspectRatio: `${srcW} / ${srcH}` }}
                  >
                    {/* Tracking Block */}
                    <div 
                      className="absolute h-full border-l-2 border-r-2 border-t-2 border-b-2 border-[#82aaff] bg-transparent transition-all duration-75 ease-out z-10"
                      style={{ width: `${boxWidthPct}%`, left: `${safeZoneMargin}%` }}
                    >
                      {/* Top Label */}
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-sm border border-white/50 rounded-full px-4 py-1.5 text-[10px] text-white font-bold tracking-wider whitespace-nowrap shadow-lg">
                        FOCUS AREA: {boxWidthPct}%
                      </div>
                    </div>
                    
                    {/* Left Arrow */}
                    {safeZoneMargin > 0 && (
                      <div className="absolute top-[80%] left-0 h-px bg-[#82aaff]" style={{ width: `${safeZoneMargin}%` }}>
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-[#82aaff]"></div>
                      </div>
                    )}
                    
                    {/* Right Arrow */}
                    {rightMargin > 0 && (
                      <div className="absolute top-[80%] right-0 h-px bg-[#82aaff]" style={{ width: `${rightMargin}%` }}>
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[4px] border-y-transparent border-r-[6px] border-r-[#82aaff]"></div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Slider Controls */}
                <div className="mt-8">
                  <div className="flex items-center gap-4 mb-6">
                    <span className="text-xs text-slate-300 font-bold tracking-wider uppercase whitespace-nowrap">Free Position (%)</span>
                    <input 
                      type="range" 
                      min="0" 
                      max={maxMargin}
                      step="1"
                      className="flex-1 accent-[#82aaff] h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                      value={safeZoneMargin}
                      onChange={(e) => handleChange('safe_zone_margin', Number(e.target.value))}
                    />
                    <div className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-center text-sm text-white font-mono shadow-inner">
                      {safeZoneMargin.toFixed(0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
          )}
          {activeTab === 'audio' && (
          <div className="flex flex-col space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* LEFT COLUMN: Audio Controls */}
              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2 flex justify-between items-center">
                    <span>Rhythm Sync Strictness</span>
                    {audioBpm && (
                      <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded flex items-center border border-slate-700 normal-case font-mono shadow-inner">
                        🎵 {audioBpm} BPM
                      </span>
                    )}
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between mb-2">
                        <label className="block text-[10px] text-slate-500 uppercase tracking-wider">Tolerance Window</label>
                        <span className="text-[10px] font-mono font-bold text-amber-500">{localConfig.rhythmic_strictness ?? 50}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" max="100" step="5"
                        className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                        value={localConfig.rhythmic_strictness ?? 50}
                        onChange={(e) => handleChange('rhythmic_strictness', Number(e.target.value))}
                      />
                      <RhythmicStrictnessVisualizer strictness={localConfig.rhythmic_strictness ?? 50} />
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Audio Marker Handlers */}
              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                    Audio Marker Prioritization
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-2">♪ Marker Strategy</label>
                      <select 
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg text-sm px-4 py-3 text-slate-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        value={localConfig.audio_marker_priority || 'DYNAMIC_PRIORITY'}
                        onChange={(e) => handleChange('audio_marker_priority', e.target.value)}
                      >
                        <option value="HARD_CUT">HARD CUT (Exact synchronization at marker)</option>
                        <option value="BROLL_BRIDGE">B-ROLL BRIDGE (Allow B-Roll overlay over marker)</option>
                        <option value="DYNAMIC_PRIORITY">DYNAMIC PRIORITY (LLM decides based on energy)</option>
                      </select>
                      <MarkerStrategyVisualizer strategy={localConfig.audio_marker_priority || 'DYNAMIC_PRIORITY'} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* FULL WIDTH BOTTOM: Energy Threshold Visualizer */}
            <div className="w-full bg-slate-900/50 p-4 rounded-xl border border-slate-800">
              <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                Energy Analysis & Filtering
              </h3>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider">Minimum Energy Threshold (Cutoff)</label>
                  <span className="text-[10px] font-mono font-bold text-amber-500">{(localConfig.energy_threshold ?? 0.4).toFixed(2)}</span>
                </div>
                <input 
                  type="range" 
                  min="0.0" max="1.0" step="0.05"
                  className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  value={localConfig.energy_threshold ?? 0.4}
                  onChange={(e) => handleChange('energy_threshold', Number(e.target.value))}
                />
              </div>
              <EnergyThresholdVisualizer threshold={localConfig.energy_threshold ?? 0.4} audioBeats={audioBeats} />
            </div>
          </div>
          )}
          {activeTab === 'system' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* LEFT COLUMN: Technical Settings */}
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                  AI Brain Selection
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-2">Model</label>
                    <select
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg text-sm px-4 py-3 text-slate-200 focus:border-indigo-500 focus:outline-none"
                      value={localConfig.ai_model || 'gemma-4-4b'}
                      onChange={(e) => handleChange('ai_model', e.target.value)}
                    >
                      <option value="gemma-4-4b">Gemma 4 (E4B) - Fast Local</option>
                      <option value="gemma-4-31b">Gemma 4 (31B) - Deep Insight</option>
                      <option value="llama-3.3-70b">Llama 3.3 (70B) - Cloud</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-2">Director Seed</label>
                    <input
                      type="number"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg text-sm px-4 py-3 text-slate-200 focus:border-indigo-500 focus:outline-none font-mono"
                      value={localConfig.seed ?? -1}
                      onChange={(e) => handleChange('seed', Number(e.target.value))}
                      placeholder="-1 (Random)"
                      min={-1}
                    />
                    <p className="text-[9px] text-slate-500 mt-1">-1 = random every time · any positive integer = reproducible edit</p>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2 mt-8">
                  Sequence Format
                </h3>
                <div className="w-full">
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-2">Target Resolution</label>
                    <select
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg text-sm px-4 py-3 text-slate-200 focus:border-indigo-500 focus:outline-none mb-1"
                      value={!["3840x2160", "1920x1080", "1080x1920"].includes(localConfig.export_resolution || "1920x1080") ? "custom" : (localConfig.export_resolution || "1920x1080")}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newRes = val === "custom" ? "1000x1000" : val;
                        handleChange('export_resolution', newRes);
                      }}
                    >
                      <option value="3840x2160">4K UHD (3840x2160)</option>
                      <option value="1920x1080">Full HD (1920x1080)</option>
                      <option value="1080x1920">Vertical (1080x1920)</option>
                      <option value="custom">Custom...</option>
                    </select>
                    {!["3840x2160", "1920x1080", "1080x1920"].includes(localConfig.export_resolution || "1920x1080") && (
                      <div className="flex gap-2 mt-2">
                        <input 
                          type="number" 
                          className="w-full bg-slate-950 border border-slate-700 rounded text-xs px-2 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none" 
                          placeholder="W"
                          value={localConfig.export_resolution?.split('x')[0] || ""}
                          onChange={(e) => {
                            const h = localConfig.export_resolution?.split('x')[1] || "1080";
                            handleChange('export_resolution', `${e.target.value}x${h}`);
                          }}
                        />
                        <span className="text-slate-500 self-center font-bold text-[10px]">x</span>
                        <input 
                          type="number" 
                          className="w-full bg-slate-950 border border-slate-700 rounded text-xs px-2 py-2 text-slate-200 focus:border-indigo-500 focus:outline-none" 
                          placeholder="H"
                          value={localConfig.export_resolution?.split('x')[1] || ""}
                          onChange={(e) => {
                            const w = localConfig.export_resolution?.split('x')[0] || "1920";
                            handleChange('export_resolution', `${w}x${e.target.value}`);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Duration Mode */}
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-bold text-sky-400 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">
                  Time Architecture
                </h3>
                <div className="space-y-6 bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-2">Target Duration (sec)</label>
                    <input 
                      type="number" 
                      disabled={isAudioLocked}
                      className={`w-full rounded-lg text-lg font-mono font-bold px-4 py-3 border text-center transition-colors ${
                        isAudioLocked 
                          ? 'opacity-50 cursor-not-allowed bg-slate-800/50 text-slate-500 border-slate-700' 
                          : 'bg-slate-950 border-slate-700 text-sky-400 focus:border-sky-500 focus:outline-none'
                      }`}
                      value={localConfig.target_duration || 60}
                      onChange={(e) => handleChange('target_duration', Number(e.target.value))}
                    />
                    {isAudioLocked && (
                      <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] font-bold text-amber-500 bg-amber-500/10 py-1 rounded">
                        <span>🔒 Locked to Audio Track</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-4 border-t border-slate-800">
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-3">Duration Mode</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => handleChange('duration_mode', 'ORGANIC')}
                        className={`py-3 px-4 rounded-lg flex flex-col items-center justify-center gap-1 border transition-all ${
                          (localConfig.duration_mode ?? 'ORGANIC') === 'ORGANIC' 
                          ? 'bg-sky-900/40 border-sky-500 text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.2)]' 
                          : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'
                        }`}
                      >
                        <span className="text-xs font-bold uppercase tracking-wider">Organic</span>
                        <span className="text-[9px] text-center opacity-70">Allows +/- 10% drift for narrative flow</span>
                      </button>
                      <button 
                        onClick={() => handleChange('duration_mode', 'STRICT')}
                        className={`py-3 px-4 rounded-lg flex flex-col items-center justify-center gap-1 border transition-all ${
                          localConfig.duration_mode === 'STRICT' 
                          ? 'bg-rose-900/40 border-rose-500 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]' 
                          : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'
                        }`}
                      >
                        <span className="text-xs font-bold uppercase tracking-wider">Strict</span>
                        <span className="text-[9px] text-center opacity-70">Forces exact duration unconditionally</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-900 flex justify-end gap-4 shrink-0">
          <button 
            onClick={handleCancel}
            className="px-6 py-2.5 rounded-lg font-bold text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSaveAndClose}
            className="px-8 py-2.5 rounded-lg font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all flex items-center gap-2"
          >
            <Check size={18} />
            Save & Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
