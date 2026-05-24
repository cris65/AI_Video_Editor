import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePancakeData, DirectorConfig, FinalCutClip, VersionEntry, VersionDirectorConfig } from '../../hooks/usePancakeData';
import { useVideoShortcuts } from '../../hooks/useVideoShortcuts';
import { ClipCard } from './ClipCard';
import { VideoPlayerSync } from './VideoPlayerSync';
import { UniversalTimeline } from './UniversalTimeline';
import type { UniversalClip } from '../../types/UniversalClip';
import { DirectorSettingsPanel } from './DirectorSettingsPanel';
import { useSequencePlayer } from '../../hooks/useSequencePlayer';
import { AudioSettingsModal } from './AudioSettingsModal';
import { VersionHistoryDropdown } from './VersionHistoryDropdown';
import { LayoutGrid, AlertCircle, Loader2, CheckCircle2, CloudUpload, Filter, Film, PlaySquare, RefreshCw, Wand2, Eye, X, Activity, MapPin, Tag, Music, Cpu } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function getSegmentColor(clip: any, isTrash = false): string {
  if (isTrash) return 'bg-red-500/80 hover:bg-red-400 border-r border-slate-950';
  if (clip.role === 'PILLAR') return 'bg-amber-500/20 border-amber-500/40';
  if (clip.tag && clip.tag.includes('B-ROLL')) return 'bg-blue-500/80 hover:bg-blue-400 border-r border-slate-950';
  return 'bg-emerald-500/80 hover:bg-emerald-400 border-r border-slate-950';
}

interface TelemetryRecord {
  vlm_model_id: string;
  session_start_time: string;
  session_end_time: string;
  total_frames: number;
  extracted_frames: number;
  cv_duration_sec: number;
  mlx_duration_sec: number;
  total_duration_sec: number;
}

interface PancakeDashboardProps {
  sequenceName: string;
  onOpenEngine?: () => void;
  initialTargetVersion?: number;
}

export type ConstraintType = 'IN' | 'OUT' | 'BM' | 'AUDIO';

export interface UserConstraint {
  type: ConstraintType;
  time: number;
}

export interface AudioMarkerFilter {
  types: string[];
  minEnergy: number;
}

export const PancakeDashboard: React.FC<PancakeDashboardProps> = ({ sequenceName, onOpenEngine, initialTargetVersion }) => {
  const {
    data, hitlData, finalCutTimeline, gemmaRecipe,
    audioBpm, audioDuration, audioWaveforms, audioBeats,
    versionHistory, activeVersion,
    loading, error,
    refetchFinalCut, refetchAudioData, fetchVersionHistory, loadVersion
  } = usePancakeData(sequenceName);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [userConstraints, setUserConstraints] = useState<Record<string, UserConstraint[]>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [clipOverrides, setClipOverrides] = useState<Record<string, any>>({});
  const [filterMode, setFilterMode] = useState<'ALL' | 'VALID' | 'BROLL' | 'TRASH'>('ALL');
  const [directorConfig, setDirectorConfig] = useState<DirectorConfig>({ target_duration: 60, style_prompt: "" });
  const [isDirectorSettingsOpen, setIsDirectorSettingsOpen] = useState(true);
  const [waveformView, setWaveformView] = useState<'amplitude' | 'energy'>('amplitude');
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  // Local mutable order — derived from immutable finalCutTimeline source.
  // Re-synced whenever the Director re-generates the cut.
  const [orderedFinalCut, setOrderedFinalCut] = useState<FinalCutClip[]>([]);
  const [pendingSeek, setPendingSeek] = useState<number | null>(null);
  const hasAutoSuggested = useRef(false);
  const [lastTelemetry, setLastTelemetry] = useState<TelemetryRecord | null>(null);
  const [audioMarkerFilters, setAudioMarkerFilters] = useState<AudioMarkerFilter>({
    types: ['percussive', 'harmonic', 'beat', 'bpm_grid'],
    minEnergy: 0.4
  });
  const [hiddenMarkers, setHiddenMarkers] = useState<string[]>([]);

  const toggleMarkerVisibility = useCallback((type: string) => {
    setHiddenMarkers(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  }, []);

  const latestStateRef = useRef({ userConstraints, clipOverrides, directorConfig });
  useEffect(() => {
    latestStateRef.current = { userConstraints, clipOverrides, directorConfig };
  });

  // Debounced Sync: Timeline Slider -> Engine Config -> Backend Save
  // Prevents saving 50 times per second while dragging, avoiding network race conditions
  // and ensuring the Engine Modal reflects the true final value chosen on mouse up.
  useEffect(() => {
    const handler = setTimeout(() => {
      const { userConstraints: currentConstraints, clipOverrides: currentOverrides, directorConfig: currentConfig } = latestStateRef.current;
      if (audioMarkerFilters.minEnergy !== (currentConfig.energy_threshold ?? 0.4)) {
        const nextConfig = { ...currentConfig, energy_threshold: audioMarkerFilters.minEnergy };
        setDirectorConfig(nextConfig);
        triggerSave(currentConstraints, currentOverrides, nextConfig);
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(handler);
  }, [audioMarkerFilters.minEnergy]);

  const formatModelName = (modelId: string) => {
    if (!modelId) return "VLM";
    if (modelId.includes("gemma-4-e4b")) return "Gemma 4 E4B it";
    return modelId.split('/').pop() || modelId;
  };

  const formatDuration = (totalSec: number) => {
    if (totalSec <= 60) {
      return `${Math.round(totalSec)}s`;
    }
    const mins = Math.floor(totalSec / 60);
    const secs = Math.round(totalSec % 60);
    return `${mins}m ${secs}s`;
  };

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch('/system_logs/performance_history.json');
        if (res.ok) {
          const text = await res.text();
          if (text.trim()) {
            const history = JSON.parse(text);
            if (Array.isArray(history) && history.length > 0) {
              setLastTelemetry(history[history.length - 1]);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to fetch or parse telemetry history:", err);
      }
    };
    fetchTelemetry();
  }, []);

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
      setAudioMarkerFilters(prev => ({
        ...prev,
        minEnergy: hitlData.director_config.energy_threshold ?? 0.4
      }));
    }
  }, [hitlData]);

  // Sync orderedFinalCut from source whenever finalCutTimeline is refreshed (e.g. after Update Cut)
  useEffect(() => {
    if (hitlData && hitlData.clip_order_override && hitlData.clip_order_override.length === finalCutTimeline.length) {
      setOrderedFinalCut(hitlData.clip_order_override);
    } else {
      setOrderedFinalCut(finalCutTimeline);
    }
  }, [finalCutTimeline, hitlData]);

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

  // Precision Stopwatch
  const [regenerationElapsed, setRegenerationElapsed] = useState(0);
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRegenerating) {
      setRegenerationElapsed(0);
      interval = setInterval(() => {
        setRegenerationElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRegenerating]);

  const formatElapsedTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const combinedTimeline = data?.stringout_timeline || [];
  const fps = data?.metadata?.fps || 25;

  const handleConstraint = useCallback((type: ConstraintType | 'CLEAR' | 'CLEAR_ALL' | 'CLEAR_TYPE_IN' | 'CLEAR_TYPE_OUT' | 'CLEAR_TYPE_BM' | 'CLEAR_TYPE_AUDIO', time: number) => {
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
        } else if (type.startsWith('CLEAR_TYPE_')) {
          const targetType = type.replace('CLEAR_TYPE_', '');
          const constraints = next[clipKey] || [];
          const updated = constraints.filter(c => c.type !== targetType);
          if (updated.length === 0) {
            delete next[clipKey];
          } else {
            next[clipKey] = updated;
          }
        } else {
          // IN, OUT, BM, AUDIO -> push
          next[clipKey] = [...(next[clipKey] || []), { type: type as ConstraintType, time }];
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

  const handleGlobalBookend = useCallback((type: 'START' | 'END', time: number) => {
    const clipIndex = combinedTimeline.findIndex(c => time >= c.start && time < c.end);
    console.log(`[handleGlobalBookend] type=${type}, time=${time}, clipIndex=${clipIndex}`);
    if (clipIndex !== -1) {
      const clipKey = combinedTimeline[clipIndex].start.toString();
      console.log(`[handleGlobalBookend] target clipKey=${clipKey}`);

      setClipOverrides(prev => {
        const next = { ...prev };
        const targetKey = type === 'START' ? 'is_global_start' : 'is_global_end';

        const wasAlreadySet = typeof next[clipKey] === 'object' && next[clipKey] !== null && (next[clipKey] as any)[targetKey];
        console.log(`[handleGlobalBookend] wasAlreadySet=${wasAlreadySet} for ${clipKey}`);

        // SINGLETON RULE: Remove the flag from all other clips first
        for (const k in next) {
          const val = next[k];
          if (typeof val === 'object' && val !== null) {
            if ((val as any)[targetKey]) {
              const obj = { ...(val as any) };
              delete obj[targetKey];
              next[k] = obj;
            }
          }
        }

        // Toggle logic: Apply only if it wasn't already set
        if (!wasAlreadySet) {
          const currentOverride = next[clipKey];
          const timeKey = type === 'START' ? 'bookend_start_time' : 'bookend_end_time';
          const newObj: any = { [targetKey]: true, [timeKey]: time };

          if (typeof currentOverride === 'string') {
            newObj.force_status = currentOverride;
          } else if (typeof currentOverride === 'object' && currentOverride !== null) {
            Object.assign(newObj, currentOverride);
            newObj[targetKey] = true;
            newObj[timeKey] = time;
          }

          next[clipKey] = newObj;
        }

        console.log(`[handleGlobalBookend] next clipOverrides:`, next);
        triggerSave(userConstraints, next, directorConfig);
        return next;
      });
    } else {
      console.log(`[handleGlobalBookend] No clip found at time ${time}`);
    }
  }, [combinedTimeline, userConstraints, directorConfig]);

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
    overridesToSave: Record<string, any>,
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
      const orchestratePayload = {
        sequence_name: sequenceName,
        hitl_constraints: userConstraints,
        clip_overrides: clipOverrides,
        director_config: directorConfig,
      };
      const res = await fetch('http://localhost:8000/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orchestratePayload),
      });
      if (!res.ok) throw new Error('Orchestration failed');
      const result = await res.json();
      if (!result.ok) throw new Error(result.error ?? 'Director error');
      await refetchFinalCut();
      await fetchVersionHistory();
      setIsPreviewMode(true);
    } catch (err) {
      console.error('Failed to regenerate cut:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Direct Export (Deterministic Bypass): sends the current D&D order directly to Python.
  // Always visible — the user can trigger it even without reordering (just tagging TRASH/KEEP).
  const handleDirectExport = useCallback(async (stringoutOrder: number[], switchToPreview = true) => {
    setIsRegenerating(true);
    try {
      const orchestratePayload = {
        sequence_name: sequenceName,
        hitl_constraints: userConstraints,
        clip_overrides: clipOverrides,
        director_config: directorConfig,
        bypass_llm: true,
        stringout_order: stringoutOrder,
      };
      const res = await fetch('http://localhost:8000/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orchestratePayload),
      });
      if (!res.ok) throw new Error('Direct Export failed');
      const result = await res.json();
      if (!result.ok) throw new Error((result as { error?: string }).error ?? 'Director error');
      await refetchFinalCut();
      await fetchVersionHistory();
      if (switchToPreview) setIsPreviewMode(true);
    } catch (err) {
      console.error('Direct Export failed:', err);
    } finally {
      setIsRegenerating(false);
    }
  }, [sequenceName, userConstraints, clipOverrides, directorConfig, refetchFinalCut, fetchVersionHistory]);

  // Rehydration Engine: loads a historical version and restores its directorConfig
  const handleVersionSelect = useCallback(async (entry: VersionEntry) => {
    const config: VersionDirectorConfig | null = await loadVersion(entry);
    if (config) {
      setDirectorConfig({
        target_duration: config.target_duration,
        style_prompt: config.style_prompt,
        rhythmic_strictness: config.rhythmic_strictness,
        energy_threshold: config.energy_threshold,
        audio_marker_priority: config.audio_marker_priority,
        duration_mode: config.duration_mode,
        seed: config.seed,
        ai_model: config.ai_model,
      });
    }
  }, [loadVersion]);

  // Auto-load targeted version if provided from EngineControls
  const hasAutoLoadedTarget = useRef(false);
  useEffect(() => {
    if (initialTargetVersion !== undefined && versionHistory?.versions?.length && !hasAutoLoadedTarget.current) {
      const entry = versionHistory.versions.find((v: VersionEntry) => v.version === initialTargetVersion);
      if (entry) {
        hasAutoLoadedTarget.current = true;
        handleVersionSelect(entry);
      }
    }
  }, [initialTargetVersion, versionHistory, handleVersionSelect]);


  // useSequencePlayer now consumes orderedFinalCut so playback respects manual reorder.
  const { currentTimelineTime, activeClipIndex, seekToTimelineTime, virtualTimeRef } = useSequencePlayer(
    videoRef,
    audioRef,
    orderedFinalCut,
    isPreviewMode
  );

  // Execute pending seek ONLY after orderedFinalCut has been updated in state
  useEffect(() => {
    if (pendingSeek !== null) {
      seekToTimelineTime(pendingSeek);
      setPendingSeek(null);
    }
  }, [orderedFinalCut, pendingSeek, seekToTimelineTime]);

  // Global marker numbers: PRIMARY namespace is the STRINGOUT (combinedTimeline).
  // The user adds markers during Stringout review → those get M1, M2, M3...
  // DC is a later refinement — DC clips inherit the SAME M# from the Stringout namespace.
  // Key format: `${clip.start.toFixed(3)}_${mIdx}` (source time = unified anchor for both timelines).
  const globalMarkerNumbers = useMemo(() => {
    const map = new Map<string, number>();
    // 1. Flatten all constraints with their absolute time position
    const flat: { key: string; mIdx: number; time: number }[] = [];
    combinedTimeline.forEach((clip) => {
      const clipConstraints = userConstraints[clip.start.toString()] || [];
      clipConstraints.forEach((c, mIdx) => {
        const isOrphan = c.time < clip.start || c.time > clip.end;
        if (!isOrphan) {
          flat.push({ key: clip.start.toFixed(3), mIdx, time: c.time });
        }
      });
    });
    // 2. Sort by absolute time (leftmost = M1)
    flat.sort((a, b) => a.time - b.time);
    // 3. Assign sequential M# in chronological order
    flat.forEach((entry, i) => {
      map.set(`${entry.key}_${entry.mIdx}`, i + 1);
    });
    return map;
  }, [combinedTimeline, userConstraints]);

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

  const filteredTimeline = useMemo(() => {
    let result = combinedTimeline;

    if (filterMode === 'VALID') {
      result = result.filter(clip => {
        const override = clipOverrides[clip.start.toString()];
        const forceStatus = typeof override === 'string' ? override : override?.force_status;
        const isUsable = forceStatus === 'TRASH' ? false : (forceStatus === 'KEEP' || forceStatus === 'BROLL' ? true : clip.is_usable !== false);
        const isBroll = forceStatus === 'BROLL' ? true : (forceStatus === 'KEEP' ? false : clip.tag.includes('B-ROLL'));
        return isUsable && !isBroll;
      });
    } else if (filterMode === 'BROLL') {
      result = result.filter(clip => {
        const override = clipOverrides[clip.start.toString()];
        const forceStatus = typeof override === 'string' ? override : override?.force_status;
        const isUsable = forceStatus === 'TRASH' ? false : (forceStatus === 'KEEP' || forceStatus === 'BROLL' ? true : clip.is_usable !== false);
        const isBroll = forceStatus === 'BROLL' ? true : (forceStatus === 'KEEP' ? false : clip.tag.includes('B-ROLL'));
        return isUsable && isBroll;
      });
    } else if (filterMode === 'TRASH') {
      result = result.filter(clip => {
        const override = clipOverrides[clip.start.toString()];
        const forceStatus = typeof override === 'string' ? override : override?.force_status;
        const isUsable = forceStatus === 'TRASH' ? false : (forceStatus === 'KEEP' || forceStatus === 'BROLL' ? true : clip.is_usable !== false);
        return !isUsable;
      });
    }

    // Sort chronologically only — no teleportation (bookends are metadata for LLM, not UI reordering)
    return [...result].sort((a, b) => a.start - b.start);
  }, [combinedTimeline, filterMode, clipOverrides]);

  const soClips: UniversalClip[] = useMemo(() => {
    return filteredTimeline.map(clip => {
      const override = clipOverrides[clip.start.toString()];
      const forceStatus = typeof override === 'string' ? override : override?.force_status;
      const isTrash = forceStatus === 'TRASH' || (forceStatus !== 'KEEP' && forceStatus !== 'BROLL' && clip.is_usable === false);
      return {
        id: clip.start.toString(),
        displayStart: clip.start,
        displayEnd: clip.end,
        colorClass: getSegmentColor(clip, isTrash),
        label: clip.clip_name,
        isTrash,
        sourceStart: clip.start,
        sourceEnd: clip.end,
        sourceClipStart: clip.start,
        bestMoment: clip.best_moment !== undefined && clip.best_moment > clip.start && clip.best_moment < clip.end && !isTrash ? clip.best_moment : undefined
      };
    });
  }, [filteredTimeline, clipOverrides]);

  const soTotalDuration = useMemo(() => {
    return soClips.reduce((acc, c) => acc + (c.sourceEnd - c.sourceStart), 0);
  }, [soClips]);

  const dcClips: UniversalClip[] = useMemo(() => {
    // We map against finalCutTimeline to ensure P#/F# labels match the source
    return orderedFinalCut.map(clip => {
      // Find its original chronological index to assign the correct P/F label
      const originalIdx = finalCutTimeline.findIndex(
        c => Math.abs(c.source_clip_start - clip.source_clip_start) < 0.1 && Math.abs(c.source_in - clip.source_in) < 0.01
      );
      
      let pCount = 0; let fCount = 0;
      for (let k = 0; k <= originalIdx && k < finalCutTimeline.length; k++) {
        if (finalCutTimeline[k].role === 'PILLAR') pCount++;
        else fCount++;
      }
      
      const isMoved = originalIdx !== orderedFinalCut.indexOf(clip);

      return {
        id: `${clip.source_clip_start}_${clip.source_in}`,
        displayStart: clip.timeline_in,
        displayEnd: clip.timeline_out,
        colorClass: getSegmentColor(clip),
        label: clip.role === 'PILLAR' ? `P${pCount}` : `F${fCount}`,
        isLocked: clip.locked,
        isMoved,
        isTrash: false,
        sourceStart: clip.source_in,
        sourceEnd: clip.source_out,
        sourceClipStart: clip.source_clip_start
      };
    });
  }, [orderedFinalCut, finalCutTimeline]);

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
      <Toaster position="top-right" />
      {/* Header */}
      <header className="shrink-0 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800 px-4 py-2 flex items-center justify-between shadow-md z-50">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20 shadow-inner shrink-0">
            <LayoutGrid className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold text-white tracking-tight shrink-0">Pancake HITL Dashboard</h1>
            <div className="flex items-center gap-3 mt-0.5 font-mono text-[10px] min-w-0">
              <span className="text-slate-500 truncate min-w-0">{sequenceName}</span>
              <span className="text-slate-500 whitespace-nowrap shrink-0">• {combinedTimeline.length} segmenti • {fps.toFixed(2)} fps</span>

              {/* Save Status Indicator */}
              <div className="flex items-center gap-1.5 min-w-[80px]">
                {saveStatus === 'saving' && <span className="text-[10px] text-emerald-400 animate-pulse flex items-center gap-1"><CloudUpload size={12} /> Salvataggio...</span>}
                {saveStatus === 'saved' && <span className="text-[10px] text-slate-500 flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" /> Salvato</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Master Toggle */}
        <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-700 shadow-inner mx-2">
          <button
            onClick={onOpenEngine}
            className="flex items-center gap-1.5 px-3 py-1 mr-1 text-[10px] font-bold rounded-md transition-all bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30"
            title="Image Engine Controls"
          >
            <Cpu size={12} />
            Engine Control
          </button>

          <button
            onClick={() => setIsPreviewMode(false)}
            className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${!isPreviewMode ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Film size={12} />
            Stringout
          </button>

          <button
            onClick={() => setIsAudioModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 ml-1 text-[10px] font-bold rounded-md transition-all bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30"
            title="Audio Rhythm Engine"
          >
            <Music size={12} />
            Audio Track
          </button>

          <button
            onClick={() => setIsPreviewMode(true)}
            disabled={finalCutTimeline.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1 ml-1 text-[10px] font-bold rounded-md transition-colors ${isPreviewMode ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-slate-500 hover:text-slate-300'} ${finalCutTimeline.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={finalCutTimeline.length === 0 ? "Final Cut non ancora generato" : "Preview Director's Cut"}
          >
            <PlaySquare size={12} />
            Director's Cut
          </button>

          <button
            onClick={() => setIsRecipeModalOpen(true)}
            disabled={!gemmaRecipe || gemmaRecipe.length === 0}
            className={`flex items-center gap-1.5 px-2.5 py-1 ml-1 text-[10px] font-bold rounded-md transition-all ${!gemmaRecipe || gemmaRecipe.length === 0
              ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500'
              : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
              }`}
            title={!gemmaRecipe ? "Recipe non disponibile" : "View AI Recipe"}
          >
            <Eye size={12} />
          </button>

          <button
            onClick={handleRegenerateCut}
            disabled={isRegenerating || saveStatus === 'saving'}
            className={`flex items-center gap-1 px-2.5 py-1 ml-1 text-[10px] font-bold rounded-md transition-all ${isRegenerating || saveStatus === 'saving' ? 'bg-amber-500/20 text-amber-500'
              : finalCutTimeline.length === 0
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                : 'bg-slate-800 text-slate-400 hover:text-amber-400 hover:bg-slate-700'
              }`}
            title={finalCutTimeline.length === 0 ? "Avvia la generazione del primo montaggio" : "Aggiorna il montaggio applicando le tue nuove regole"}
          >
            {isRegenerating ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : finalCutTimeline.length === 0 ? (
              <Wand2 size={12} className="animate-pulse" />
            ) : (
              <RefreshCw size={12} />
            )}
            {isRegenerating ? `Elaborazione... (Elapsed: ${formatElapsedTimer(regenerationElapsed)})` : (finalCutTimeline.length === 0 ? 'Generate Cut' : 'Regenerate Cut')}
          </button>

          {/* Version History Dropdown */}
          {versionHistory && versionHistory.versions.length > 0 && (
            <div className="ml-1 z-50">
              <VersionHistoryDropdown
                versions={versionHistory.versions}
                activeVersion={activeVersion || undefined}
                onSelectVersion={handleVersionSelect}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex bg-slate-900 rounded-md p-0.5 border border-slate-700 shadow-inner">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${filterMode === 'ALL' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
            >
              ALL
            </button>
            <button
              onClick={() => setFilterMode('VALID')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${filterMode === 'VALID' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              VALID
            </button>
            <button
              onClick={() => setFilterMode('BROLL')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${filterMode === 'BROLL' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              B-ROLL
            </button>
            <button
              onClick={() => setFilterMode('TRASH')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${filterMode === 'TRASH' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-slate-400 hover:text-slate-200'}`}
            >
              TRASH
            </button>
          </div>
          <span className={`flex items-center gap-1 px-2 py-0.5 bg-slate-900/80 rounded-md text-[10px] font-bold border shadow-sm whitespace-nowrap transition-colors ${filterMode === 'VALID' ? 'text-emerald-400 border-emerald-500/30' :
            filterMode === 'BROLL' ? 'text-blue-400 border-blue-500/30' :
              filterMode === 'TRASH' ? 'text-red-400 border-red-500/30' :
                'text-slate-300 border-slate-700'
            }`}>
            <Filter size={10} className="opacity-80" />
            {filterMode === 'BROLL' ? 'B-ROLL' : filterMode}: {filteredTimeline.length} Clips
          </span>
        </div>
      </header>

      <main className="flex-1 p-2 flex flex-col lg:flex-row gap-2 max-w-[1920px] mx-auto w-full min-h-0">

        {/* Left Side: Player & Timeline */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Telemetry Display Container */}
          <div className="flex items-center justify-between mb-1 h-[24px] shrink-0">
            <div className="text-slate-400 text-[10px] font-medium flex items-center gap-2">
              {lastTelemetry ? (
                <>
                  <Activity size={16} className="text-blue-400" />
                  <span className="text-slate-300 font-semibold">{formatModelName(lastTelemetry.vlm_model_id)}</span>
                  <span className="text-slate-600">•</span>
                  <span>Analyzed {lastTelemetry.extracted_frames} frames in {formatDuration(lastTelemetry.total_duration_sec)}</span>
                </>
              ) : (
                <span className="text-slate-500 italic text-xs">No telemetry data available</span>
              )}
            </div>

            {/* Global IN/OUT Constraints */}
            {!isPreviewMode && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 px-1">Bookends</span>
                <button
                  onClick={() => handleGlobalBookend('START', isPreviewMode ? currentTimelineTime : (videoRef.current?.currentTime ?? 0))}
                  title="Global Sequence IN (Bookend)"
                  className="flex items-center gap-1 px-3 py-1 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/40 text-blue-400 rounded-lg transition-all text-xs font-black tracking-wider shadow-sm hover:scale-[1.02] hover:shadow-blue-500/20 hover:shadow-md"
                >
                  <span className="text-blue-300 font-black">[</span> IN
                </button>
                <button
                  onClick={() => handleGlobalBookend('END', isPreviewMode ? currentTimelineTime : (videoRef.current?.currentTime ?? 0))}
                  title="Global Sequence OUT (Bookend)"
                  className="flex items-center gap-1 px-3 py-1 bg-purple-500/10 hover:bg-purple-500/25 border border-purple-500/40 text-purple-400 rounded-lg transition-all text-xs font-black tracking-wider shadow-sm hover:scale-[1.02] hover:shadow-purple-500/20 hover:shadow-md"
                >
                  OUT <span className="text-purple-300 font-black">]</span>
                </button>
              </div>
            )}
          </div>

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
              <UniversalTimeline
                mode="director_cut"
                clips={dcClips}
                videoRef={videoRef}
                virtualTimeRef={virtualTimeRef}
                duration={videoDuration}
                userConstraints={userConstraints}
                hiddenMarkers={hiddenMarkers}
                toggleMarkerVisibility={toggleMarkerVisibility}
                audioWaveforms={audioWaveforms}
                waveformView={waveformView}
                setWaveformView={setWaveformView}
                audioDuration={audioDuration}
                audioBeats={audioBeats}
                audioBpm={audioBpm}
                markerNumbers={globalMarkerNumbers}
                dcActions={{
                  onBookendStart: () => handleGlobalBookend('START', currentTimelineTime),
                  onBookendEnd: () => handleGlobalBookend('END', currentTimelineTime),
                  onLockToggle: () => { /* Lock logic implemented via ClipCard currently */ },
                  onDirectExportDC: (newOrderedClips?: UniversalClip[]) => {
                    const clipStarts = newOrderedClips
                      ? newOrderedClips.map(c => c.sourceClipStart)
                      : orderedFinalCut.map(c => c.source_clip_start);
                    handleDirectExport(clipStarts);
                  },
                  onSeek: seekToTimelineTime
                }}
                audioMarkerFilters={audioMarkerFilters}
                setAudioMarkerFilters={setAudioMarkerFilters}
              />
            ) : (
              <UniversalTimeline
                mode="stringout"
                clips={soClips}
                globalTimeline={combinedTimeline}
                videoRef={videoRef}
                duration={soTotalDuration}
                userConstraints={userConstraints}
                hiddenMarkers={hiddenMarkers}
                toggleMarkerVisibility={toggleMarkerVisibility}
                audioWaveforms={audioWaveforms}
                waveformView={waveformView}
                setWaveformView={setWaveformView}
                audioDuration={audioDuration}
                audioBeats={audioBeats}
                audioBpm={audioBpm}
                markerNumbers={globalMarkerNumbers}
                audioMarkerFilters={audioMarkerFilters}
                setAudioMarkerFilters={setAudioMarkerFilters}
                onSaveStringoutOrder={(validClips) => handleDirectExport(validClips.map(c => c.start), false)}
              />
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
            <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-sm overflow-hidden">
              <button
                onClick={() => setIsDirectorSettingsOpen(!isDirectorSettingsOpen)}
                className="w-full flex items-center justify-between p-4 bg-slate-900/50 hover:bg-slate-800/50 transition-colors"
              >
                <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Wand2 size={14} className="text-amber-400" />
                  AI Director Settings
                </h3>
                <div className="flex items-center gap-3">
                  {audioBpm && (
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full flex items-center border border-slate-700">
                      🎵 {audioBpm} BPM
                    </span>
                  )}
                  <span className="text-slate-500 font-mono text-sm">{isDirectorSettingsOpen ? '-' : '+'}</span>
                </div>
              </button>

              {isDirectorSettingsOpen && (
                <DirectorSettingsPanel
                  config={directorConfig}
                  audioBeats={audioBeats}
                  audioBpm={audioBpm}
                  onSave={(newConfig) => {
                    setDirectorConfig(newConfig);
                    setAudioMarkerFilters(prev => ({ ...prev, minEnergy: newConfig.energy_threshold ?? 0.4 }));
                    triggerSave(userConstraints, clipOverrides, newConfig);
                  }}
                  onRegenerate={handleRegenerateCut}
                  isRegenerating={isRegenerating}
                  saveStatus={saveStatus}
                  regenerationElapsed={regenerationElapsed}
                />
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

            {isPreviewMode ? (
              orderedFinalCut.map((clip, idx) => {
                const matchingPancakeClip = combinedTimeline.find(
                  pc => Math.abs(pc.start - clip.source_clip_start) < 0.1
                );
                const matchedSemantic = matchingPancakeClip?.semantic_analysis;
                const matchedCine = matchingPancakeClip?.cinematography;
                const matchedStory = matchingPancakeClip?.story;


                // Original Gemma index: position in the immutable source (for reference numbering)
                const originalIdx = finalCutTimeline.findIndex(
                  c => Math.abs(c.source_clip_start - clip.source_clip_start) < 0.1 && Math.abs(c.source_in - clip.source_in) < 0.01
                );
                let pillarCount = 0; let fillerCount = 0;
                for (let k = 0; k <= originalIdx && k < finalCutTimeline.length; k++) {
                  if (finalCutTimeline[k].role === 'PILLAR') pillarCount++;
                  else fillerCount++;
                }
                const seqLabel = clip.role === 'PILLAR' ? `P${pillarCount}` : `F${fillerCount}`;

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
                      <span className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1.5 ${clip.role === 'PILLAR' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        <span className="text-[9px] opacity-60 font-mono">{seqLabel}</span>
                        {clip.role === 'PILLAR' ? 'PILLAR' : 'FILLER'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">IN: {clip.timeline_in.toFixed(1)}s</span>
                    </div>
                    <div className="text-xs text-slate-300 pointer-events-none mb-2">
                      Source: <span className="font-mono">{clip.source_in.toFixed(1)} &rarr; {clip.source_out.toFixed(1)}</span>
                    </div>

                    {/* Marker Rows — DB-style, click-to-seek */}
                    {(() => {
                      // Match constraints by source_clip_start key
                      const constraintKey = Object.keys(userConstraints).find(
                        k => Math.abs(parseFloat(k) - clip.source_clip_start) < 0.1
                      );
                      const markerList = constraintKey ? userConstraints[constraintKey] : [];

                      interface DCMarkerItem {
                        isNativeBM: boolean;
                        type: 'IN' | 'OUT' | 'BM' | 'AUDIO';
                        time: number;
                        markerNum?: number;
                      }
                      const items: DCMarkerItem[] = [];

                      // Add native BM if defined and within range
                      if (matchingPancakeClip && matchingPancakeClip.best_moment && matchingPancakeClip.best_moment > matchingPancakeClip.start && matchingPancakeClip.best_moment < matchingPancakeClip.end) {
                        items.push({
                          isNativeBM: true,
                          type: 'BM',
                          time: matchingPancakeClip.best_moment,
                        });
                      }

                      // Add user constraints
                      markerList.forEach((c, mIdx) => {
                        const markerNum = globalMarkerNumbers.get(`${clip.source_clip_start.toFixed(3)}_${mIdx}`);
                        items.push({
                          isNativeBM: false,
                          type: c.type,
                          time: c.time,
                          markerNum,
                        });
                      });

                      if (items.length === 0) return null;

                      // Sort chronologically
                      items.sort((a, b) => a.time - b.time);

                      const BORDER_COLOR: Record<string, string> = {
                        IN: '#3b82f6',
                        OUT: '#a855f7',
                        BM: '#f97316', // User BM is orange
                        AUDIO: '#22c55e',
                      };

                      return (
                        <div className="mb-2 flex flex-col border border-slate-800 rounded-lg overflow-hidden">
                          {items.map((item, mIdx) => {
                            const borderColor = item.isNativeBM ? '#eab308' : (BORDER_COLOR[item.type] ?? '#94a3b8');
                            const typeIcon = item.type === 'BM'
                              ? <svg width="7.5" height="10" viewBox="0 0 10 14" fill="currentColor" className="inline-block"><path d="M0 0H10V10L5 14L0 10V0Z" /></svg>
                              : item.type === 'AUDIO' ? <span>&#9834;</span>
                                : <span className="text-[9px] font-black">{item.type}</span>;
                            return (
                              <button
                                key={`dc-marker-${mIdx}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSeek(item.time);
                                }}
                                className="w-full flex items-center gap-2 px-2 py-1 text-left transition-colors hover:bg-slate-800/40 border-b border-slate-800/40 last:border-b-0 cursor-pointer group"
                                style={{ borderLeft: `3px solid ${borderColor}` }}
                              >
                                <span className="text-[10px] shrink-0" style={{ color: borderColor }}>
                                  {typeIcon}
                                </span>

                                {item.isNativeBM ? (
                                  <span
                                    className="text-[9px] font-bold font-mono px-1 py-0 rounded shrink-0"
                                    style={{
                                      backgroundColor: '#eab30822',
                                      color: '#eab308',
                                      border: '1px solid #eab30855',
                                    }}
                                  >
                                    BM
                                  </span>
                                ) : (
                                  item.markerNum !== undefined && (
                                    <span
                                      className="text-[9px] font-bold font-mono px-1 py-0 rounded shrink-0"
                                      style={{
                                        backgroundColor: `${borderColor}22`,
                                        color: borderColor,
                                        border: `1px solid ${borderColor}55`,
                                      }}
                                    >
                                      {item.type === 'IN' ? 'IN' : item.type === 'OUT' ? 'OUT' : item.type === 'BM' ? 'M' : 'A'}{item.markerNum}
                                    </span>
                                  )
                                )}

                                <span className="text-[10px] font-mono text-slate-300 shrink-0">[{formatTime(item.time)}]</span>
                                <span className="text-[9px] font-mono text-slate-500 flex-1">
                                  SRT {(clip.timeline_in + (item.time - clip.source_in)).toFixed(2)}s
                                </span>

                                {!item.isNativeBM ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (constraintKey) handleRemoveSpecificConstraint(constraintKey, item.time);
                                    }}
                                    className="opacity-40 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-700/50 shrink-0"
                                    style={{ color: borderColor }}
                                    title="Remove Marker"
                                  >
                                    <X size={10} strokeWidth={2} />
                                  </button>
                                ) : (
                                  <span className="w-[14px] h-[14px]" /> // Spacer
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Semantic Analysis Panel */}
                    {(matchingPancakeClip) && (
                      <div className="mt-2.5 space-y-2 pt-2.5 border-t border-slate-800/80 text-left pointer-events-none">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {matchedSemantic?.narrative_energy_score !== undefined && (
                            <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5 text-[10px] text-amber-400 font-medium">
                              <Activity size={10} className="shrink-0" />
                              <span>Energy: {matchedSemantic.narrative_energy_score}/10</span>
                            </div>
                          )}
                          {matchedSemantic?.emotional_tone && matchedSemantic.emotional_tone !== 'ANALYSIS_FAILED' && (
                            <div className="bg-blue-500/10 border border-blue-500/25 rounded px-1.5 py-0.5 text-[10px] text-blue-400 font-medium">
                              <span>Tone: {matchedSemantic.emotional_tone}</span>
                            </div>
                          )}
                          {matchedCine?.shot_size && (
                            <div className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-300 font-bold">
                              <span>Size: {matchedCine.shot_size}</span>
                            </div>
                          )}
                        </div>

                        {matchedSemantic && (
                          <>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {matchedSemantic.subject_count !== undefined && (
                                <span className="bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-medium">
                                  Subjects: {matchedSemantic.subject_count}
                                </span>
                              )}
                              {matchedSemantic.gaze_direction && matchedSemantic.gaze_direction !== 'NONE' && (
                                <span className="bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-medium">
                                  Gaze: {matchedSemantic.gaze_direction}
                                </span>
                              )}
                              {matchedSemantic.subject_screen_position && matchedSemantic.subject_screen_position !== 'NONE' && (
                                <span className="bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-medium">
                                  Pos: {matchedSemantic.subject_screen_position.replace('_', ' ')}
                                </span>
                              )}
                            </div>

                            {/* Location and Props */}
                            {matchedSemantic.setting_location && matchedSemantic.setting_location !== 'ANALYSIS_FAILED' && (
                              <div className="mt-1.5 flex items-center gap-1.5 text-[9px] text-slate-300 bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-800/80 w-fit">
                                <MapPin size={9} className="text-rose-400 shrink-0" />
                                <span className="font-semibold text-slate-300">{matchedSemantic.setting_location}</span>
                              </div>
                            )}
                            {matchedSemantic.key_props && matchedSemantic.key_props.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1 items-center">
                                <Tag size={9} className="text-sky-400 shrink-0 mr-0.5" />
                                {matchedSemantic.key_props.map((prop, pidx) => (
                                  <span key={pidx} className="bg-sky-950/40 border border-sky-900/50 text-sky-400 px-1 py-0.5 rounded text-[8px] font-medium">
                                    {prop}
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        )}

                        {matchedCine?.scene_description && matchedCine.scene_description !== 'ANALYSIS_FAILED' && (
                          <div className="text-[11px] text-slate-300 leading-relaxed bg-slate-950/40 p-2 rounded border border-slate-900/60">
                            <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">Scene Description</span>
                            {matchedCine.scene_description}
                          </div>
                        )}

                        {matchingPancakeClip.continuity?.match_cut_potential && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded text-[9px] font-bold">
                              MATCH CUT
                            </span>
                            {matchingPancakeClip.continuity.match_cut_vector && matchingPancakeClip.continuity.match_cut_vector !== 'NONE' && (
                              <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider">
                                {matchingPancakeClip.continuity.match_cut_vector}
                              </span>
                            )}
                          </div>
                        )}

                        {matchedStory?.director_note && matchedStory.director_note !== 'ANALYSIS_FAILED' && (
                          <div className="text-[11px] text-slate-400 italic leading-relaxed border-l-2 border-slate-700 pl-2 py-0.5">
                            <span className="text-[9px] text-slate-500 font-bold not-italic block uppercase tracking-wider mb-0.5">Director's Note</span>
                            "{matchedStory.director_note}"
                          </div>
                        )}
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
                  onSeekToMarker={(time) => handleSeek(time)}
                  overrideMode={
                    typeof clipOverrides[clip.start.toString()] === 'string'
                      ? (clipOverrides[clip.start.toString()] as any)
                      : clipOverrides[clip.start.toString()]?.force_status
                  }
                  isGlobalStart={clipOverrides[clip.start.toString()]?.is_global_start}
                  isGlobalEnd={clipOverrides[clip.start.toString()]?.is_global_end}
                  bookendStartTime={clipOverrides[clip.start.toString()]?.bookend_start_time}
                  bookendEndTime={clipOverrides[clip.start.toString()]?.bookend_end_time}
                  onClearOverride={() => handleOverride('CLEAR', clip.start)}
                  onClearBookend={(type) => handleGlobalBookend(type, clip.start)}
                  markerNumbers={globalMarkerNumbers}
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

      {/* Phase 2: Audio Rhythm Engine Modal */}
      {isAudioModalOpen && (
        <AudioSettingsModal
          sequenceName={sequenceName}
          currentDuration={directorConfig.target_duration}
          onUpdateDuration={(newDur) => setDirectorConfig(prev => ({ ...prev, target_duration: newDur }))}
          initialAudioData={
            audioDuration && audioBpm && audioWaveforms
              ? { bpm: audioBpm, duration: audioDuration, waveform: audioWaveforms.amplitude || [] }
              : null
          }
          onClose={() => {
            refetchAudioData();
            setIsAudioModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
