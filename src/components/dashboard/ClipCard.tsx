import { useState } from 'react';
import { Users, Info, Activity } from 'lucide-react';
import type { PancakeClip } from '../../hooks/usePancakeData';

interface ClipCardProps {
  clip: PancakeClip;
  sequenceName: string;
}

export function ClipCard({ clip, sequenceName }: ClipCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getBadgeColor = (tag: string) => {
    if (tag.includes('MAIN_A')) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (tag.includes('EDGE_DANGER')) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (tag.includes('TRASH')) return 'bg-gray-800 text-gray-500 border-gray-700';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30'; // B-ROLL
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-emerald-500';
    if (score >= 6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const score = clip.visual_quality_score || 0;
  const fileName = clip.storyboard_path ? clip.storyboard_path.split('/').pop() : '';
  const imageUrl = `/engine/output/${sequenceName}/storyboards/${fileName}`;
  const clipName = fileName ? fileName.split('_')[0] : 'Unknown';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg transition-all hover:border-slate-700 group flex flex-col">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-slate-950 overflow-hidden">
        {fileName ? (
          <img 
            src={imageUrl} 
            alt="Storyboard" 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-slate-600 text-xs">
            No Storyboard
          </div>
        )}
        
        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
          <div className="flex flex-col gap-1.5">
            <span className="px-2 py-1 rounded bg-slate-950/80 text-white text-xs font-bold font-mono border border-slate-800 backdrop-blur-md shadow-sm w-fit">
              {clipName}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border backdrop-blur-md w-fit ${getBadgeColor(clip.tag)}`}>
              {clip.tag}
            </span>
          </div>
          
          <div className="flex gap-2">
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-slate-950/80 text-slate-300 backdrop-blur-md border border-slate-800/50">
              <Users size={12} />
              {clip.people_count || 0}
            </span>
          </div>
        </div>
        
        {/* Bottom Bar: Palette & Score */}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-slate-950/90 to-transparent flex justify-between items-end">
          <div className="flex gap-1">
            {clip.cinematic_palette?.map((color, idx) => (
              <div key={idx} className="w-3 h-3 rounded-full border border-slate-800 shadow-sm" style={{ backgroundColor: color }} title={color} />
            ))}
          </div>
          <div className="flex items-center gap-2">
             <span className="text-xs font-mono text-slate-300 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
               {clip.start.toFixed(1)}s - {clip.end.toFixed(1)}s
             </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-200">Score MLX</span>
            <div className="flex items-center gap-1">
              <div className="text-lg font-bold text-white w-6 text-center">{score}</div>
              <span className="text-xs text-slate-500">/10</span>
            </div>
          </div>
          
          {/* Indicator Bar */}
          <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full ${getScoreColor(score)} transition-all duration-1000`}
              style={{ width: `${(score / 10) * 100}%` }}
            />
          </div>
        </div>

        <button 
          onClick={() => setExpanded(!expanded)}
          className="mt-auto w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-2 border-t border-slate-800/50 transition-colors"
        >
          <span className="flex items-center gap-1.5"><Info size={14} /> Semantic Analysis</span>
          <span className="text-slate-600 font-mono">{expanded ? '-' : '+'}</span>
        </button>

        {expanded && (
          <div className="mt-2 space-y-3 text-xs text-slate-400 bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
            <div>
              <strong className="text-slate-300 block mb-1">Scene & Lighting</strong>
              <p className="leading-relaxed">{clip.scene_and_lighting || 'N/A'}</p>
            </div>
            <div>
              <strong className="text-slate-300 block mb-1">Action Continuity</strong>
              <p className="leading-relaxed">{clip.action_continuity || 'N/A'}</p>
            </div>
            {clip.technical_flaws && clip.technical_flaws !== 'Nessuno' && clip.technical_flaws !== 'None' && clip.technical_flaws !== 'ANALYSIS_FAILED' && (
              <div>
                <strong className="text-red-400 block mb-1 flex items-center gap-1"><Activity size={12} /> Technical Flaws</strong>
                <p className="text-red-300/80 leading-relaxed">{clip.technical_flaws}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
