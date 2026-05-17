
import { usePancakeData } from '../../hooks/usePancakeData';
import { ClipCard } from './ClipCard';
import { LayoutGrid, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

interface PancakeDashboardProps {
  sequenceName: string;
}

export function PancakeDashboard({ sequenceName }: PancakeDashboardProps) {
  const { data, loading, error } = usePancakeData(sequenceName);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
        <p className="text-lg font-medium animate-pulse">Caricamento JSON da {sequenceName}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-red-950/30 border border-red-500/30 rounded-xl p-6 max-w-lg w-full text-center shadow-xl">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-400 mb-2">Errore di Caricamento</h2>
          <p className="text-red-300/80 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || !data.stringout_timeline) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center shadow-lg">
          <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">Nessun dato trovato nella sequenza.</p>
        </div>
      </div>
    );
  }

  const clips = data.stringout_timeline;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 shadow-inner">
            <LayoutGrid className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Pancake HITL Dashboard</h1>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{sequenceName} • {clips.length} segmenti rilevati</p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
           <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/80 rounded-full text-xs font-medium text-slate-300 border border-slate-700 shadow-sm">
             <CheckCircle2 size={14} className="text-blue-400" />
             Read-Only Mode
           </span>
        </div>
      </header>

      {/* Grid */}
      <main className="p-6 max-w-screen-2xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {clips.map((clip, idx) => (
            <ClipCard key={`${clip.start}-${idx}`} clip={clip} sequenceName={sequenceName} />
          ))}
        </div>
      </main>
    </div>
  );
}
