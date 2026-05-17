import { useState, useEffect, useRef, useCallback } from 'react';
import { usePancakeData } from '../../hooks/usePancakeData';
import { useVideoShortcuts } from '../../hooks/useVideoShortcuts';
import { ClipCard } from './ClipCard';
import { VideoPlayerSync } from './VideoPlayerSync';
import { InteractiveTimeline } from './InteractiveTimeline';
import { LayoutGrid, AlertCircle, Loader2, CheckCircle2, CloudUpload, Filter } from 'lucide-react';

interface PancakeDashboardProps {
  sequenceName: string;
}

export type ConstraintType = 'IN' | 'OUT' | 'BM';

export interface UserConstraint {
  type: ConstraintType;
  time: number;
}

export function PancakeDashboard({ sequenceName }: PancakeDashboardProps) {
  const { data, hitlData, loading, error } = usePancakeData(sequenceName);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [userConstraints, setUserConstraints] = useState<Record<string, UserConstraint[]>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [clipOverrides, setClipOverrides] = useState<Record<string, 'KEEP' | 'TRASH' | 'BROLL'>>({});
  const [filterMode, setFilterMode] = useState<'ALL' | 'VALID' | 'BROLL' | 'TRASH'>('ALL');

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
  }, [hitlData]);

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
        triggerSave(next, clipOverrides);
        
        return next;
      });
    }
  }, [combinedTimeline, fps, clipOverrides]);

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
      triggerSave(next, clipOverrides);
      return next;
    });
  }, [clipOverrides]);

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
        triggerSave(userConstraints, next);
        return next;
      });
    }
  }, [combinedTimeline, userConstraints]);

  const triggerSave = async (constraintsToSave: Record<string, UserConstraint[]>, overridesToSave: Record<string, 'KEEP' | 'TRASH' | 'BROLL'>) => {
    setSaveStatus('saving');
    try {
      const payload = { hitl_constraints: constraintsToSave, clip_overrides: overridesToSave };
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
      setSaveStatus('idle'); // Idealmente potremmo gestire l'errore visivamente
    }
  };

  useVideoShortcuts(videoRef, combinedTimeline, fps, handleConstraint, handleOverride);

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
  }, [combinedTimeline]);

  const handleSeek = useCallback((time: number) => {
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
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <VideoPlayerSync 
              src={videoUrl} 
              ref={videoRef} 
            />
          </div>
          <div className="shrink-0 mt-4">
            <InteractiveTimeline 
              timeline={filteredTimeline} 
              videoRef={videoRef} 
              duration={videoDuration} 
              userConstraints={userConstraints}
              clipOverrides={clipOverrides}
            />
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
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {filteredTimeline.map((clip) => (
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
            ))}
          </div>
        </aside>

      </main>
    </div>
  );
}
