import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DirectorConfig } from '../../hooks/usePancakeData';
import { X, Check } from 'lucide-react';

interface AdvancedDirectorModalProps {
  config: DirectorConfig;
  sourceResolution?: { width: number; height: number };
  onClose: (newConfig?: DirectorConfig) => void;
}

export function AdvancedDirectorModal({ config, sourceResolution, onClose }: AdvancedDirectorModalProps) {
  const [localConfig, setLocalConfig] = useState<DirectorConfig>(config);

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
      <div className="w-full max-w-6xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h2 className="text-xl font-bold text-slate-200 tracking-wider flex items-center gap-2">
              🎨 AI Director Creative Settings
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Configure Machine Vision targets, NLP prompts, and precise Focus Area tracking.
            </p>
          </div>
          <button 
            onClick={handleCancel}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
