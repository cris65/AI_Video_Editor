import { useState, useEffect, useRef, useCallback } from 'react';
import { usePancakeData, DirectorConfig } from '../../hooks/usePancakeData';
import { useVideoShortcuts } from '../../hooks/useVideoShortcuts';
import { ClipCard } from './ClipCard';
import { VideoPlayerSync } from './VideoPlayerSync';
import { InteractiveTimeline } from './InteractiveTimeline';
import { FinalCutTimeline } from './FinalCutTimeline';
import { useSequencePlayer } from '../../hooks/useSequencePlayer';
import { LayoutGrid, AlertCircle, Loader2, CheckCircle2, CloudUpload, Filter, Film, PlaySquare, RefreshCw, Wand2, Eye, X } from 'lucide-react';

interface PancakeDashboardProps {
  sequenceName: string;
}

export type ConstraintType = 'IN' | 'OUT' | 'BM';

export interface UserConstraint {
  type: ConstraintType;
  time: number;
}

export function PancakeDashboard({ sequenceName }: PancakeDashboardProps) {
  const { data, hitlData, finalCutTimeline, gemmaRecipe, audioBpm, audioDuration, audioWaveform, loading, error, refetchFinalCut } = usePancakeData(sequenceName);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [userConstraints, setUserConstraints] = useState<Record<string, UserConstraint[]>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [clipOverrides, setClipOverrides] = useState<Record<string, 'KEEP' | 'TRASH' | 'BROLL'>>({});
  const [filterMode, setFilterMode] = useState<'ALL' | 'VALID' | 'BROLL' | 'TRASH'>('ALL');
  const [directorConfig, setDirectorConfig] = useState<DirectorConfig>({ target_duration: 60, style_prompt: "" });
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const hasAutoSuggested = useRef(false);

  useEffect(() => {
    if (hitlData && Object.keys(hitlData.hitl_constraints || {}).length > 0 && Object.keys(userConstraints).length === 0) {
      // Normalizzazione per retrocompatibilità
      const normalizedData: Record<string, UserConstraint[]> = {};
      for (const [key, value] of Object.entries(hitlData.hitl_constraints || {})) {
        if (Array.isArray(value)) {
          normalizedData[key] = value;
        } else if (value && typeof value === 'object') {
          normalizedData[key] = [value as UserConstraint];
        }
      }
      setUserConstraints(normalizedData);
    }
    if (hitlData && hitlData.clip_overrides && Object.keys(hitlData.clip_overrides).length > 0 && Object.keys(clipOverrides).length === 0) {
      setClipOverrides(hitlData.clip_overrides);
    }
    if (hitlData && hitlData.director_config) {
      setDirectorConfig(hitlData.director_config);
    }
  }, [hitlData]);

  useEffect(() => {
    if (audioBpm && !hasAutoSuggested.current) {
      if (!directorConfig.style_prompt) {
        hasAutoSuggested.current = true;
        let suggestion = "";
        if (audioBpm >= 110) {
          suggestion = "Stile dinamico e frenetico, molti tagli rapidi, alta energia e ritmo incalzante.";
        } else if (audioBpm <= 90) {
          suggestion = "Stile cinematico, inquadrature lunghe, respiro emotivo e tagli lenti.";
        } else {
          suggestion = "Montaggio bilanciato, ritmo regolare e fluido in perfetta sincronia con la musica.";
        }
        
        setDirectorConfig(prev => {
          const next = { ...prev, style_prompt: suggestion };
          triggerSave(userConstraints, clipOverrides, next);
          return next;
        });
      } else {
        hasAutoSuggested.current = true;
      }
    }
  }, [audioBpm]);

  const combinedTimeline = data?.stringout_timeline || [];
  const fps = data?.metadata?.fps || 25;

  const handleConstraint = useCallback((type: ConstraintType | 'CLEAR' | 'CLEAR_ALL', time: number) => {
    const clipIndex = combinedTimeline.findIndex(c => time >= c.start && time < c.end);
    if (clipIndex !== -1) {
      const clipKey = combinedTimeline[clipIndex].start.toString();
      
      setUserConstraints(prev => {
        const next = { ...prev };
        
        if (type === 'CLEAR_ALL') {
          delete next[clipKey];
        } else if (type === 'CLEAR') {
          const constraints = next[clipKey] || [];
          if (constraints.length > 0) {
            const frameTolerance = (1 / fps) + 0.01;
            // Find closest constraint within tolerance
            let closestIdx = -1;
            let minDiff = Infinity;
            for (let i = 0; i < constraints.length; i++) {
              const diff = Math.abs(constraints[i].time - time);
              if (diff <= frameTolerance && diff < minDiff) {
                minDiff = diff;
                closestIdx = i;
              }
            }
            if (closestIdx !== -1) {
              const updated = [...constraints];
              updated.splice(closestIdx, 1);
              if (updated.length === 0) {
                delete next[clipKey];
              } else {
                next[clipKey] = updated;
              }
            }
          }
        } else {
          // IN, OUT, BM -> push
          next[clipKey] = [...(next[clipKey] || []), { type, time }];
        }
        
        // Trigger Async Save (Non-Destructive)
        triggerSave(next, clipOverrides, directorConfig);
        
        return next;
      });
    }
  }, [combinedTimeline, fps, clipOverrides, directorConfig]);

  const handleRemoveSpecificConstraint = useCallback((clipKey: string, time: number) => {
    setUserConstraints(prev => {
      const next = { ...prev };
      const constraints = next[clipKey] || [];
      const updated = constraints.filter(c => c.time !== time);
      if (updated.length === 0) {
        delete next[clipKey];
      } else {
        next[clipKey] = updated;
      }
      triggerSave(next, clipOverrides, directorConfig);
      return next;
    });
  }, [clipOverrides, directorConfig]);

  const handleOverride = useCallback((type: 'KEEP' | 'TRASH' | 'BROLL' | 'CLEAR', time: number) => {
    const clipIndex = combinedTimeline.findIndex(c => time >= c.start && time < c.end);
    if (clipIndex !== -1) {
      const clipKey = combinedTimeline[clipIndex].start.toString();
      
      setClipOverrides(prev => {
        const next = { ...prev };
        if (type === 'CLEAR') {
          delete next[clipKey];
        } else {
          // Toggle logic
          if (next[clipKey] === type) {
            delete next[clipKey];
          } else {
            next[clipKey] = type;
          }
        }
        triggerSave(userConstraints, next, directorConfig);
        return next;
      });
    }
  }, [combinedTimeline, userConstraints, directorConfig]);

  async function triggerSave(
    constraintsToSave: Record<string, UserConstraint[]>, 
    overridesToSave: Record<string, 'KEEP' | 'TRASH' | 'BROLL'>,
    configToSave: DirectorConfig
  ) {
    setSaveStatus('saving');
    try {
      const payload = { hitl_constraints: constraintsToSave, clip_overrides: overridesToSave, director_config: configToSave };
      const res = await fetch(`/api/save-hitl?sequence=${sequenceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload, null, 2)
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save HITL data:', err);
      setSaveStatus('idle');
    }
  };

  const handleRegenerateCut = async () => {
    setIsRegenerating(true);
    try {
      const res = await fetch(`/api/regenerate-director-cut?sequence=${sequenceName}`, { method: 'POST' });
      if (!res.ok) throw new Error('Regeneration failed');
      await refetchFinalCut();
      setIsPreviewMode(true);
    } catch (err) {
      console.error('Failed to regenerate cut:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const { currentTimelineTime, activeClipIndex, seekToTimelineTime } = useSequencePlayer(
    videoRef, 
    audioRef, 
    finalCutTimeline, 
    isPreviewMode
  );

  useEffect(() => {
    if (isPreviewMode && activeClipIndex !== null) {
      const el = document.getElementById(`fc-card-${activeClipIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [isPreviewMode, activeClipIndex]);

  useVideoShortcuts(
    videoRef, 
    combinedTimeline, 
    fps, 
    handleConstraint, 
    handleOverride,
    isPreviewMode,
    currentTimelineTime,
    seekToTimelineTime
  );

  const videoDuration = combinedTimeline.length > 0 
    ? Math.max(...combinedTimeline.map(c => c.end)) 
    : 0;

  const filteredTimeline = combinedTimeline.filter(clip => {
    if (filterMode === 'ALL') return true;
    const clipKey = clip.start.toString();
    const override = clipOverrides[clipKey];
    
    let isUsable = clip.is_usable !== false;
    let isBroll = clip.tag.includes('B-ROLL');
    
    if (override === 'KEEP') { isUsable = true; isBroll = false; }
    if (override === 'TRASH') { isUsable = false; }
    if (override === 'BROLL') { isUsable = true; isBroll = true; }
    
    if (filterMode === 'VALID') return isUsable && !isBroll;
    if (filterMode === 'BROLL') return isUsable && isBroll;
    if (filterMode === 'TRASH') return !isUsable;
    
    return true;
  });

  useEffect(() => {
    if (isPreviewMode) return; // Disabilita check standard in preview mode
    
    let animationFrameId: number;
    let prevActiveIndex: number | null = null;

    const checkActiveClip = () => {
      if (videoRef.current && combinedTimeline.length > 0) {
        const currentTime = videoRef.current.currentTime;
        const newActiveIndex = combinedTimeline.findIndex(c => currentTime >= c.start && currentTime < c.end);
        const finalIndex = newActiveIndex !== -1 ? newActiveIndex : null;

        if (finalIndex !== prevActiveIndex) {
          prevActiveIndex = finalIndex;
          setActiveIndex(finalIndex);
        }
      }
      animationFrameId = requestAnimationFrame(checkActiveClip);
    };

    animationFrameId = requestAnimationFrame(checkActiveClip);
    return () => cancelAnimationFrame(animationFrameId);
  }, [combinedTimeline, isPreviewMode]);

  const handleSeek = useCallback((time: number) => {
    if (isPreviewMode) return; // Disabilita seek da cards in preview mode
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
        <p className="text-lg font-medium animate-pulse">Caricamento JSON da {sequenceName}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-6 max-w-lg w-full text-center shadow-xl">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-400 mb-2">Errore di Caricamento</h2>
          <p className="text-red-300/80 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!combinedTimeline.length) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center shadow-lg">
          <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">Nessun dato trovato nella sequenza.</p>
        </div>
      </div>
    );
  }

  const videoUrl = `/engine/output/${sequenceName}/${sequenceName}.mp4`;
  const audioUrl = `/engine/output/${sequenceName}/LLM_Export_Package/${sequenceName}_bgm.wav`;

  return (
    <div className="h-screen bg-slate-950 text-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 px-6 py-4 flex items-center justify-between shadow-md z-50">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 shadow-inner">
            <LayoutGrid className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Pancake HITL Dashboard</h1>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-xs text-slate-500 font-mono">{sequenceName} • {combinedTimeline.length} segmenti sincronizzati • {fps.toFixed(2)} fps</p>
              
              {/* Save Status Indicator */}
              <div className="flex items-center gap-1.5 min-w-[80px]">
                {saveStatus === 'saving' && <span className="text-[10px] text-emerald-400 animate-pulse flex items-center gap-1"><CloudUpload size={12} /> Salvataggio...</span>}
                {saveStatus === 'saved' && <span className="text-[10px] text-slate-500 flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" /> Salvato</span>}
              </div>
            </div>
          </div>
        </div>
        
        {/* Master Toggle */}
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700 shadow-inner mx-4">
          <button 
            onClick={() => setIsPreviewMode(false)}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${!isPreviewMode ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Film size={14} />
            Stringout
          </button>
          <button 
            onClick={() => setIsPreviewMode(true)}
            disabled={finalCutTimeline.length === 0}
            className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${isPreviewMode ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-slate-500 hover:text-slate-300'} ${finalCutTimeline.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={finalCutTimeline.length === 0 ? "Final Cut non ancora generato" : "Preview Director's Cut"}
          >
            <PlaySquare size={14} />
            Director's Cut
          </button>
          
          <button
            onClick={() => setIsRecipeModalOpen(true)}
            disabled={!gemmaRecipe || gemmaRecipe.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 ml-1 text-xs font-bold rounded-md transition-all ${
              !gemmaRecipe || gemmaRecipe.length === 0 
                ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500' 
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
            }`}
            title={!gemmaRecipe ? "Recipe non disponibile" : "View AI Recipe"}
          >
            <Eye size={14} />
          </button>
          
          <button
            onClick={handleRegenerateCut}
            disabled={isRegenerating || saveStatus === 'saving'}
            className={`flex items-center gap-1.5 px-3 py-1.5 ml-1 text-xs font-bold rounded-md transition-all ${
              isRegenerating || saveStatus === 'saving' ? 'bg-amber-500/20 text-amber-500' 
              : finalCutTimeline.length === 0 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' 
                : 'bg-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-700'
            }`}
            title={finalCutTimeline.length === 0 ? "Avvia la generazione del primo montaggio" : "Aggiorna il montaggio applicando le tue nuove regole"}
          >
            {isRegenerating ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : finalCutTimeline.length === 0 ? (
              <Wand2 size={14} className="animate-pulse" />
            ) : (
              <RefreshCw size={14} />
            )}
            {isRegenerating ? 'Elaborazione...' : (finalCutTimeline.length === 0 ? 'Generate Cut' : 'Update Cut')}
          </button>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700 shadow-inner mr-2">
             <button 
               onClick={() => setFilterMode('ALL')}
               className={`px-3 py-1 text-[11px] font-bold rounded-md transition-colors ${filterMode === 'ALL' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
             >
               ALL
             </button>
             <button 
               onClick={() => setFilterMode('VALID')}
               className={`px-3 py-1 text-[11px] font-bold rounded-md transition-colors ${filterMode === 'VALID' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'}`}
             >
               VALID
             </button>
             <button 
               onClick={() => setFilterMode('BROLL')}
               className={`px-3 py-1 text-[11px] font-bold rounded-md transition-colors ${filterMode === 'BROLL' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'}`}
             >
               B-ROLL
             </button>
             <button 
               onClick={() => setFilterMode('TRASH')}
               className={`px-3 py-1 text-[11px] font-bold rounded-md transition-colors ${filterMode === 'TRASH' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-slate-400 hover:text-slate-200'}`}
             >
               TRASH
             </button>
           </div>
           <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/80 rounded-full text-xs font-medium text-slate-300 border border-slate-700 shadow-sm">
             <Filter size={14} className="text-blue-400" />
             {filteredTimeline.length} Clips
           </span>
        </div>
      </header>

      {/* Main Split View */}
      <main className="flex-1 p-6 flex flex-col lg:flex-row gap-6 max-w-[1920px] mx-auto w-full min-h-0">
        
        {/* Left Side: Player & Timeline */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 min-h-0 flex items-center justify-center relative">
            <VideoPlayerSync 
              src={videoUrl} 
              ref={videoRef} 
              hideControls={isPreviewMode}
            />
            {isPreviewMode && (
              <div className="absolute top-4 left-4 bg-red-500/90 text-white px-3 py-1 rounded-md text-xs font-bold shadow-lg flex items-center gap-2 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                LIVE PREVIEW
              </div>
            )}
            <audio ref={audioRef} src={audioUrl} preload="auto" />
          </div>
          <div className="shrink-0 mt-4">
            {isPreviewMode ? (
              <>
                <FinalCutTimeline 
                  timeline={finalCutTimeline}
                  currentTime={currentTimelineTime}
                  onSeek={seekToTimelineTime}
                  userConstraints={userConstraints}
                  audioWaveform={audioWaveform}
                  audioDuration={audioDuration}
                />
              </>
            ) : (
              <>
                <InteractiveTimeline 
                  timeline={filteredTimeline} 
                  videoRef={videoRef} 
                  duration={videoDuration} 
                  userConstraints={userConstraints}
                  clipOverrides={clipOverrides}
                  audioWaveform={audioWaveform}
                  audioDuration={audioDuration}
                />
              </>
            )}
          </div>
        </div>

        {/* Right Side: Vertical Playlist Inspector */}
        <aside className="w-full lg:w-[400px] xl:w-[450px] shrink-0 flex flex-col h-full bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 bg-slate-900 shrink-0">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
              Timeline Inspector
            </h2>
          </div>
          
            <div className="p-4 border-b border-slate-800 bg-slate-900/80 shrink-0 z-10 shadow-md">
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-sm">
                <h3 className="text-xs font-bold text-slate-300 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wand2 size={14} className="text-amber-400" />
                    AI Director Settings
                  </div>
                  {audioBpm && (
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full flex items-center border border-slate-700">
                      🎵 Audio Tempo: {audioBpm} BPM
                    </span>
                  )}
                </h3>
                <div className="space-y-3">
                  <div>
                     <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Target Duration (sec)</label>
                     <input type="number" 
                            className="w-full bg-slate-950 border border-slate-700 rounded text-xs px-2 py-1.5 text-slate-200 focus:border-amber-500 focus:outline-none" 
                            value={directorConfig.target_duration}
                            onChange={(e) => setDirectorConfig({...directorConfig, target_duration: Number(e.target.value)})}
                            onBlur={() => triggerSave(userConstraints, clipOverrides, directorConfig)}
                     />
                  </div>
                  <div>
                     <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Target Resolution</label>
                     <select
                        className="w-full bg-slate-950 border border-slate-700 rounded text-xs px-2 py-1.5 text-slate-200 focus:border-amber-500 focus:outline-none mb-1"
                        value={!["3840x2160", "1920x1080", "1080x1920"].includes(directorConfig.export_resolution || "1920x1080") ? "custom" : (directorConfig.export_resolution || "1920x1080")}
                        onChange={(e) => {
                          const val = e.target.value;
                          const newRes = val === "custom" ? "1000x1000" : val;
                          const newConfig = { ...directorConfig, export_resolution: newRes };
                          setDirectorConfig(newConfig);
                          triggerSave(userConstraints, clipOverrides, newConfig);
                        }}
                     >
                       <option value="3840x2160">4K UHD (3840x2160)</option>
                       <option value="1920x1080">Full HD (1920x1080)</option>
                       <option value="1080x1920">Vertical (1080x1920)</option>
                       <option value="custom">Custom...</option>
                     </select>
                     
                     {!["3840x2160", "1920x1080", "1080x1920"].includes(directorConfig.export_resolution || "1920x1080") && (
                       <div className="flex gap-2 mb-3">
                         <input 
                           type="number" 
                           className="w-full bg-slate-950 border border-slate-700 rounded text-xs px-2 py-1 text-slate-200 focus:border-amber-500 focus:outline-none" 
                           placeholder="W"
                           value={directorConfig.export_resolution?.split('x')[0] || ""}
                           onChange={(e) => {
                              const h = directorConfig.export_resolution?.split('x')[1] || "1080";
                              setDirectorConfig({ ...directorConfig, export_resolution: `${e.target.value}x${h}` });
                           }}
                           onBlur={() => triggerSave(userConstraints, clipOverrides, directorConfig)}
                         />
                         <span className="text-slate-500 self-center font-bold text-[10px]">x</span>
                         <input 
                           type="number" 
                           className="w-full bg-slate-950 border border-slate-700 rounded text-xs px-2 py-1 text-slate-200 focus:border-amber-500 focus:outline-none" 
                           placeholder="H"
                           value={directorConfig.export_resolution?.split('x')[1] || ""}
                           onChange={(e) => {
                              const w = directorConfig.export_resolution?.split('x')[0] || "1920";
                              setDirectorConfig({ ...directorConfig, export_resolution: `${w}x${e.target.value}` });
                           }}
                           onBlur={() => triggerSave(userConstraints, clipOverrides, directorConfig)}
                         />
                       </div>
                     )}
                  </div>
                  <div>
                     <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Director's Prompt</label>
                     <textarea 
                            className="w-full bg-slate-950 border border-slate-700 rounded text-xs px-2 py-1.5 text-slate-200 focus:border-amber-500 focus:outline-none h-20 resize-none" 
                            placeholder="Es. Stile frenetico, molti tagli rapidi, alta energia..."
                            value={directorConfig.style_prompt}
                            onChange={(e) => setDirectorConfig({...directorConfig, style_prompt: e.target.value})}
                            onBlur={() => triggerSave(userConstraints, clipOverrides, directorConfig)}
                     />
                  </div>
                </div>
              </div>
            </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {isPreviewMode ? (
              // In Preview Mode, mostriamo le clip del Final Cut
              finalCutTimeline.map((clip, idx) => {
                // Find constraints for this clip
                let constraints: UserConstraint[] = [];
                let matchedKey = clip.source_clip_start.toString();
                for (const key of Object.keys(userConstraints)) {
                  if (Math.abs(parseFloat(key) - clip.source_clip_start) < 0.1) {
                    constraints = userConstraints[key];
                    matchedKey = key;
                    break;
                  }
                }

                return (
                  <div 
                    key={`fc-card-${idx}`} 
                    id={`fc-card-${idx}`}
                    onClick={() => {
                      if (videoRef.current) {
                        seekToTimelineTime(clip.timeline_in);
                      }
                    }}
                    className={`p-3 rounded-lg border cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${activeClipIndex === idx ? 'bg-slate-800 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-slate-900/50 border-slate-800'} transition-all`}
                    title="Clicca per spostare la playhead su questa clip nel Director's Cut"
                  >
                     <div className="flex justify-between items-center mb-2 pointer-events-none">
                       <span className={`text-xs font-bold px-2 py-0.5 rounded ${clip.role === 'PILLAR' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-400'}`}>
                         {clip.role === 'PILLAR' ? 'PILLAR' : 'FILLER'}
                       </span>
                       <span className="text-[10px] text-slate-500 font-mono">IN: {clip.timeline_in.toFixed(1)}s</span>
                     </div>
                     <div className="text-xs text-slate-300 pointer-events-none mb-2">
                       Source: <span className="font-mono">{clip.source_in.toFixed(1)} &rarr; {clip.source_out.toFixed(1)}</span>
                     </div>
                     
                     {/* Constraints List */}
                     {constraints && constraints.length > 0 && (
                       <div className="mt-2 space-y-1.5 pt-2 border-t border-slate-800">
                         {constraints.map((c, cIdx) => {
                           const globalTime = clip.timeline_in + (c.time - clip.source_in);
                           const isMarkerActive = isPreviewMode && Math.abs(globalTime - currentTimelineTime) < 0.5;
                           
                           return (
                              <div 
                                key={cIdx} 
                                className={`flex items-center justify-between px-2 py-1 rounded border transition-all cursor-pointer hover:scale-[1.02] ${isMarkerActive ? 'bg-amber-500/20 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : 'bg-slate-950/50 border-slate-800/50 hover:bg-slate-900/80'}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  seekToTimelineTime(globalTime);
                                }}
                              >
                               <div className="flex items-center gap-2">
                                 <div className="w-4 flex justify-center">
                                 {c.type === 'IN' && <span className="text-blue-400 font-bold text-xs">[</span>}
                                 {c.type === 'OUT' && <span className="text-purple-400 font-bold text-xs">]</span>}
                                 {c.type === 'BM' && (
                                   <svg width="7.5" height="10.5" viewBox="0 0 10 14" fill="currentColor" className="text-white">
                                     <path d="M0 0H10V10L5 14L0 10V0Z" />
                                   </svg>
                                 )}
                               </div>
                               <span className="text-[10px] font-mono text-slate-400">{c.time.toFixed(2)}s</span>
                             </div>
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleRemoveSpecificConstraint(matchedKey, c.time);
                               }}
                               className="text-slate-500 hover:text-red-400 transition-colors p-1"
                               title="Rimuovi"
                             >
                               <X size={12} />
                             </button>
                           </div>
                           );
                         })}
                       </div>
                     )}
                  </div>
                );
              })
            ) : (
              filteredTimeline.map((clip) => (
                <ClipCard 
                  key={`${clip.start}-${clip.end}`} 
                  clip={clip} 
                  sequenceName={sequenceName} 
                  isActive={combinedTimeline.indexOf(clip) === activeIndex}
                  onClick={() => handleSeek(clip.start)}
                  constraints={userConstraints[clip.start.toString()]}
                  onRemoveConstraint={(time) => handleRemoveSpecificConstraint(clip.start.toString(), time)}
                  overrideMode={clipOverrides[clip.start.toString()]}
                />
              ))
            )}
          </div>
        </aside>

      </main>

      {/* QA Feature: AI Recipe Modal */}
      {isRecipeModalOpen && gemmaRecipe && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsRecipeModalOpen(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
              <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                Gemma 4 Raw Recipe
              </h3>
              <button 
                onClick={() => setIsRecipeModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <pre className="text-xs text-emerald-400 font-mono bg-slate-950 p-4 rounded-lg border border-slate-800 shadow-inner overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(gemmaRecipe, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
