import { useState, useEffect, useRef, useCallback } from 'react';
import { usePancakeData } from '../../hooks/usePancakeData';
import { useVideoShortcuts } from '../../hooks/useVideoShortcuts';
import { ClipCard } from './ClipCard';
import { VideoPlayerSync } from './VideoPlayerSync';
import { InteractiveTimeline } from './InteractiveTimeline';
import { LayoutGrid, AlertCircle, Loader2, CheckCircle2, ListVideo } from 'lucide-react';

interface PancakeDashboardProps {
  sequenceName: string;
}

export function PancakeDashboard({ sequenceName }: PancakeDashboardProps) {
  const { data, loading, error } = usePancakeData(sequenceName);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Anti-Lag: React State limits re-renders strictly to when the active clip changes.
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const combinedTimeline = data?.stringout_timeline || [];
  
  // Initialize keyboard shortcuts
  useVideoShortcuts(videoRef, combinedTimeline);

  // Calculate duration from the last clip
  const videoDuration = combinedTimeline.length > 0 
    ? Math.max(...combinedTimeline.map(c => c.end)) 
    : 0;

  // Anti-Lag mechanism: Check active clip via requestAnimationFrame
  useEffect(() => {
    let animationFrameId: number;
    let prevActiveIndex: number | null = null;

    const checkActiveClip = () => {
      if (videoRef.current && combinedTimeline.length > 0) {
        const currentTime = videoRef.current.currentTime;
        
        // Find current clip index
        const newActiveIndex = combinedTimeline.findIndex(c => currentTime >= c.start && currentTime < c.end);
        const finalIndex = newActiveIndex !== -1 ? newActiveIndex : null;

        if (finalIndex !== prevActiveIndex) {
          prevActiveIndex = finalIndex;
          setActiveIndex(finalIndex); // Fire react render ONLY when active clip changes
        }
      }
      animationFrameId = requestAnimationFrame(checkActiveClip);
    };

    animationFrameId = requestAnimationFrame(checkActiveClip);
    return () => cancelAnimationFrame(animationFrameId);
  }, [combinedTimeline]);

  // Callback for card click (memoized to prevent re-renders of ClipCard)
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

  // Carichiamo il video master proxy direttamente dalla cartella output
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
            <p className="text-xs text-slate-500 font-mono mt-0.5">{sequenceName} • {combinedTimeline.length} segmenti sincronizzati</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/80 rounded-full text-xs font-medium text-slate-300 border border-slate-700 shadow-sm">
             <CheckCircle2 size={14} className="text-blue-400" />
             Timeline Mode
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
              timeline={combinedTimeline} 
              videoRef={videoRef} 
              duration={videoDuration} 
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
          
          {/* Scrollable List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {combinedTimeline.map((clip, idx) => (
              <ClipCard 
                key={`${clip.start}-${idx}`} 
                clip={clip} 
                sequenceName={sequenceName} 
                isActive={idx === activeIndex}
                onClick={() => handleSeek(clip.start)}
              />
            ))}
          </div>
        </aside>

      </main>
    </div>
  );
}
