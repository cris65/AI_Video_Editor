import { useState, useEffect, useRef, memo } from 'react';
import { Users, Info, Activity, X, MapPin, Tag, AlertCircle } from 'lucide-react';
import type { PancakeClip } from '../../hooks/usePancakeData';

interface ClipCardProps {
  clip: PancakeClip;
  sequenceName: string;
  isActive?: boolean;
  onClick?: () => void;
  constraints?: Array<{ type: 'IN' | 'OUT' | 'BM'; time: number }>;
  onRemoveConstraint?: (time: number) => void;
  overrideMode?: 'KEEP' | 'TRASH' | 'BROLL';
  markerNumbers?: Map<string, number>;
}

export const ClipCard = memo(function ClipCard({ clip, sequenceName, isActive, onClick, constraints, onRemoveConstraint, overrideMode, markerNumbers }: ClipCardProps) {
  let finalUsable = clip.is_usable !== false;
  let isBroll = clip.tag.includes('B-ROLL');
  
  if (overrideMode === 'KEEP') { finalUsable = true; isBroll = false; }
  if (overrideMode === 'TRASH') { finalUsable = false; }
  if (overrideMode === 'BROLL') { finalUsable = true; isBroll = true; }
  
  const isRejected = !finalUsable;
  const [expanded, setExpanded] = useState(false);
  const [showRejectPopup, setShowRejectPopup] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive) {
      if (cardRef.current) {
        cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [isActive]);

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

  const score = clip.cinematography?.visual_quality_score ?? 0;
  
  // Calculate which frame in storyboard_paths corresponds to best_moment (BM)
  let bestMomentPath = '';
  if (clip.storyboard_paths && clip.storyboard_paths.length > 0) {
    const durationSec = clip.end - clip.start;
    if (durationSec > 0) {
      const fraction = (clip.best_moment - clip.start) / durationSec;
      const clampedFraction = Math.max(0, Math.min(1, fraction));
      const frameIdx = Math.round(clampedFraction * (clip.storyboard_paths.length - 1));
      bestMomentPath = clip.storyboard_paths[frameIdx] || '';
    } else {
      bestMomentPath = clip.storyboard_paths[0] || '';
    }
  } else if (clip.storyboard_path) {
    bestMomentPath = clip.storyboard_path;
  }

  const fileName = bestMomentPath ? bestMomentPath.split('/').pop() : '';
  const imageUrl = fileName ? `/engine/output/${sequenceName}/storyboards/${fileName}` : '';
  const clipName = fileName ? fileName.split('_')[0] : 'Unknown';
  const duration = (clip.end - clip.start).toFixed(1);

  const baseWrapperClass = overrideMode === 'KEEP'
    ? "bg-emerald-950/10 border-emerald-500/40 hover:border-emerald-500/60"
    : overrideMode === 'BROLL'
      ? "bg-blue-950/10 border-blue-500/40 hover:border-blue-500/60"
      : overrideMode === 'TRASH'
        ? "bg-red-950/20 border-red-500/50 hover:border-red-500/70"
        : isRejected 
          ? "bg-red-950/10 border-red-500/30 hover:border-red-500/50" 
          : isBroll
            ? "bg-blue-950/10 border-blue-500/30 hover:border-blue-500/50"
            : "bg-slate-900 border-slate-800 hover:border-slate-700";

  const activeGlow = isActive 
    ? (isRejected 
        ? "ring-2 ring-red-500 ring-offset-2 ring-offset-slate-950 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] z-10" 
        : isBroll
          ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-950 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] z-10"
          : "ring-2 ring-emerald-500 ring-offset-2 ring-offset-slate-950 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] z-10")
    : "";

  const cardWrapperClass = `cursor-pointer border rounded-xl overflow-hidden shadow-lg transition-all group flex flex-col ${baseWrapperClass} ${activeGlow}`;

  return (
    <div className={cardWrapperClass} ref={cardRef} onClick={onClick}>
      {/* Thumbnail */}
      <div className="relative aspect-video bg-slate-950 overflow-hidden">
        {fileName ? (
          <img 
            src={imageUrl} 
            alt="Storyboard" 
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${isRejected ? 'opacity-80' : ''}`}
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-slate-600 text-xs">
            No Storyboard
          </div>
        )}

        {/* Override Badge OR Minimal REJECTED Badge */}
        {overrideMode ? (
          <div className="absolute top-2 right-2 flex items-center justify-center z-30">
            <span className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold border backdrop-blur-md shadow-sm
              ${overrideMode === 'KEEP' ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/50' 
                : overrideMode === 'BROLL' ? 'bg-blue-950/90 text-blue-400 border-blue-500/50'
                : 'bg-red-950/90 text-red-400 border-red-500/50'}
            `}>
              {overrideMode === 'KEEP' ? 'FORCED KEEP' : overrideMode === 'BROLL' ? 'FORCED B-ROLL' : 'FORCED TRASH'}
            </span>
          </div>
        ) : isRejected ? (
          <div className="absolute top-2 right-2 flex items-center justify-center z-30">
            <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-950/90 text-red-400 text-[10px] font-bold border border-red-500/30 backdrop-blur-md shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              REJECTED
            </span>
          </div>
        ) : null}

        {/* Constraints Badge */}
        {constraints && constraints.length > 0 && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center justify-center z-30">
            {constraints.length === 1 ? (
              <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border backdrop-blur-md shadow-lg
                ${constraints[0].type === 'IN' ? 'bg-blue-500/90 text-white border-blue-400' : ''}
                ${constraints[0].type === 'OUT' ? 'bg-purple-500/90 text-white border-purple-400' : ''}
                ${constraints[0].type === 'BM' ? 'bg-yellow-500/90 text-yellow-950 border-yellow-400' : ''}
              `}>
                {constraints[0].type === 'IN' && 'FORCED IN'}
                {constraints[0].type === 'OUT' && 'FORCED OUT'}
                {constraints[0].type === 'BM' && '🔥 BEST MOMENT'}
                <span className="opacity-80 ml-1">[{constraints[0].time.toFixed(2)}s]</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border backdrop-blur-md shadow-lg bg-slate-900/90 text-emerald-400 border-emerald-500/50">
                🔥 {constraints.length} MARKERS SET
              </span>
            )}
          </div>
        )}
        
        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start z-20 pointer-events-none">
          <div className="flex flex-col gap-1.5">
            <span className="px-2 py-1 rounded bg-slate-950/80 text-white text-xs font-bold font-mono border border-slate-800 backdrop-blur-md shadow-sm w-fit">
              {clipName}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border backdrop-blur-md w-fit ${getBadgeColor(clip.tag)}`}>
              {clip.tag}
            </span>
          </div>
          
          <div className="flex gap-2">
            {!isRejected && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-slate-950/80 text-slate-300 backdrop-blur-md border border-slate-800/50">
                <Users size={12} />
                {clip.yolo_omniscient_data?.total_objects ?? 0}
              </span>
            )}
          </div>
        </div>
        
        {/* Bottom Bar: Palette & Score */}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-slate-950/90 to-transparent flex justify-between items-end z-20">
          <div className="flex gap-1">
            {clip.technical_quality?.cinematic_palette?.map((color, idx) => (
              <div key={idx} className="w-3 h-3 rounded-full border border-slate-800 shadow-sm" style={{ backgroundColor: color }} title={color} />
            ))}
          </div>
          <div className="flex items-center gap-2">
             <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${isActive ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' : 'text-slate-300 bg-slate-950/80 border-slate-800'}`}>
               {clip.start.toFixed(1)}s - {clip.end.toFixed(1)}s <span className="ml-1 opacity-70">({duration}s)</span>
             </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col z-20">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${isRejected ? 'text-red-300' : 'text-slate-200'}`}>Score MLX</span>
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

        {/* Actionable Constraints List */}
        {constraints && constraints.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {constraints.map((c, idx) => {
              const markerNum = markerNumbers ? markerNumbers.get(`${clip.start.toFixed(3)}_${idx}`) : undefined;
              return (
              <div 
                key={`${c.time}-${idx}`}
                className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold shadow-sm transition-colors group/badge
                  ${c.type === 'IN' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : ''}
                  ${c.type === 'OUT' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' : ''}
                  ${c.type === 'BM' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' : ''}
                `}
              >
                <span className="flex items-center gap-1">
                  {c.type === 'IN' && 'IN'}
                  {c.type === 'OUT' && 'OUT'}
                  {c.type === 'BM' && (
                    <svg width="7" height="9.5" viewBox="0 0 10 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="inline-block">
                      <path d="M0 0H10V10L5 14L0 10V0Z" />
                    </svg>
                  )}
                  {markerNum !== undefined && (
                    <span className="text-[9px] font-bold font-mono bg-slate-700/50 px-1 rounded ml-0.5">
                      M{markerNum}
                    </span>
                  )}
                  <span className="opacity-80 ml-0.5">[{c.time.toFixed(2)}s]</span>
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRemoveConstraint) onRemoveConstraint(c.time);
                  }}
                  className={`opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded
                    ${c.type === 'IN' ? 'hover:bg-blue-500/20 text-blue-400' : ''}
                    ${c.type === 'OUT' ? 'hover:bg-purple-500/20 text-purple-400' : ''}
                    ${c.type === 'BM' ? 'hover:bg-yellow-500/20 text-yellow-500' : ''}
                  `}
                  title="Remove Marker"
                >
                  <X size={12} strokeWidth={3} />
                </button>
              </div>
            );
          })}
          </div>
        )}

        <div className="relative w-full">
          {showRejectPopup && (
            <div className="absolute bottom-[calc(100%+4px)] left-0 w-full p-2 bg-slate-900 border border-red-900 rounded-md text-center shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-1 duration-200">
              <p className="text-[10px] text-red-400 font-bold leading-tight flex items-center justify-center gap-1">
                <AlertCircle size={10} className="shrink-0" /> Clip rejected due to technical flaws. Semantic analysis bypassed.
              </p>
            </div>
          )}
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              if (isRejected) {
                setShowRejectPopup(true);
                setTimeout(() => setShowRejectPopup(false), 2500);
                return;
              }
              setExpanded(!expanded); 
            }}
            className={`w-full flex items-center justify-between text-[10px] uppercase font-bold tracking-wider py-1.5 border-t transition-colors ${
              isRejected ? 'text-red-400 hover:text-red-300 border-red-500/20 cursor-not-allowed opacity-70 bg-red-950/20' : 'text-slate-400 hover:text-slate-200 border-slate-800/50 bg-slate-900/50'
            }`}
          >
            <span className="flex items-center gap-1.5 px-2"><Info size={12} /> Semantic Analysis</span>
            <span className="font-mono px-2">{expanded ? '-' : '+'}</span>
          </button>
        </div>

        {expanded && (
          <div className="mt-2 space-y-3 text-xs text-slate-400 bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
            {clip.cinematography?.technical_flaws && clip.cinematography.technical_flaws !== 'Nessuno' && clip.cinematography.technical_flaws !== 'None' && clip.cinematography.technical_flaws !== 'ANALYSIS_FAILED' && (
              <div className={isRejected ? "p-2 bg-red-500/10 border border-red-500/30 rounded-md" : ""}>
                <strong className="text-red-400 block mb-1 flex items-center gap-1"><Activity size={12} /> {isRejected ? "Motivo Scarto (Flaws)" : "Technical Flaws"}</strong>
                <p className="text-red-300/90 leading-relaxed font-medium">{clip.cinematography.technical_flaws}</p>
              </div>
            )}
            {clip.semantic_analysis && (
              <div className={`border-b border-slate-800 pb-2 ${isRejected ? 'opacity-70' : ''}`}>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <strong className="text-slate-300 block mb-0.5">Narrative Energy</strong>
                    <span className="text-amber-400 font-bold font-mono">{clip.semantic_analysis.narrative_energy_score}/10</span>
                  </div>
                  <div>
                    <strong className="text-slate-300 block mb-0.5">Emotional Tone</strong>
                    <span className="text-blue-400 font-semibold">{clip.semantic_analysis.emotional_tone || 'N/A'}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {clip.semantic_analysis.subject_count !== undefined && (
                    <span className="bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-medium">
                      Subjects: {clip.semantic_analysis.subject_count}
                    </span>
                  )}
                  {clip.semantic_analysis.gaze_direction && clip.semantic_analysis.gaze_direction !== 'NONE' && (
                    <span className="bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-medium">
                      Gaze: {clip.semantic_analysis.gaze_direction}
                    </span>
                  )}
                  {clip.semantic_analysis.subject_screen_position && clip.semantic_analysis.subject_screen_position !== 'NONE' && (
                    <span className="bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-medium">
                      Pos: {clip.semantic_analysis.subject_screen_position.replace('_', ' ')}
                    </span>
                  )}
                </div>
                
                {/* Location and Props */}
                {clip.semantic_analysis.setting_location && clip.semantic_analysis.setting_location !== 'ANALYSIS_FAILED' && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-300 bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800/80 w-fit">
                    <MapPin size={11} className="text-rose-400 shrink-0" />
                    <span className="font-semibold text-slate-300">{clip.semantic_analysis.setting_location}</span>
                  </div>
                )}
                {clip.semantic_analysis.key_props && clip.semantic_analysis.key_props.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                    <Tag size={10} className="text-sky-400 shrink-0 mr-0.5" />
                    {clip.semantic_analysis.key_props.map((prop, pidx) => (
                      <span key={pidx} className="bg-sky-950/40 border border-sky-900/50 text-sky-400 px-1.5 py-0.5 rounded text-[9px] font-medium">
                        {prop}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className={isRejected ? 'opacity-70' : ''}>
              <strong className="text-slate-300 block mb-1">Cinematography & Scene</strong>
              {clip.cinematography?.shot_size && (
                <div className="mb-1.5">
                  <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
                    Size: {clip.cinematography.shot_size}
                  </span>
                </div>
              )}
              <p className="leading-relaxed">{clip.cinematography?.scene_description || 'N/A'}</p>
            </div>
            {clip.story?.director_note && clip.story.director_note !== 'ANALYSIS_FAILED' && (
              <div className={`border-t border-slate-800 pt-2 ${isRejected ? 'opacity-70' : ''}`}>
                <strong className="text-slate-300 block mb-1">Director's Note</strong>
                <p className="leading-relaxed italic text-slate-300">"{clip.story.director_note}"</p>
              </div>
            )}
            <div className={isRejected ? 'opacity-70' : ''}>
              <strong className="text-slate-300 block mb-1">Action Continuity</strong>
              {clip.continuity?.match_cut_potential && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded text-[10px] font-bold">
                    MATCH CUT
                  </span>
                  {clip.continuity.match_cut_vector && clip.continuity.match_cut_vector !== 'NONE' && (
                    <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                      {clip.continuity.match_cut_vector}
                    </span>
                  )}
                </div>
              )}
              <p className="leading-relaxed">{clip.continuity?.action_description || 'N/A'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
