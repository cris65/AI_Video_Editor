import { useState, useEffect, useCallback } from 'react';

export interface DirectorConfig {
  ai_model?: 'gemma-4-4b' | 'gemma-4-31b' | 'llama-3.3-70b';
  target_duration: number;
  style_prompt: string;
  export_resolution?: string;
  analysis_fps?: number;
  target_product?: string;
  expected_subjects?: number;
  secondary_elements?: string;
  ignore_list?: string;
  safe_zone_margin?: number;
  seed?: number;
  rhythmic_strictness?: number; // 0-100
  energy_threshold?: number; // 0.0 - 1.0
  audio_marker_priority?: 'HARD_CUT' | 'BROLL_BRIDGE' | 'DYNAMIC_PRIORITY';
  duration_mode?: 'STRICT' | 'ORGANIC';
}

export interface FinalCutClip {
  source_clip_start: number;
  source_clip_end: number;
  source_in: number;
  source_out: number;
  timeline_in: number;
  timeline_out: number;
  role: 'PILLAR' | 'FILLER';
  tag: string;
  // --- HITL Lock Fields (optional — present when clip is manually anchored) ---
  locked?: boolean;            // true = clip is anchored by the human director
  absolute_in?: number;        // source_in at lock time (seconds, source space)
  absolute_out?: number;       // source_out at lock time (seconds, source space)
  timeline_position?: number;  // timeline_in absolute (seconds). 0.0 = IN_GLOBAL, target_dur - clip_dur = OUT_GLOBAL
}

export interface PancakeClip {
  start: number;
  end: number;
  tag: string;
  best_moment: number;
  clip_name?: string;
  storyboard_path?: string;
  storyboard_paths?: string[];
  is_usable?: boolean;

  // Phase 1 — Physical & Spatial Analysis (always present after pancake_editor)
  technical_quality: {
    blur_score: number;
    is_soft_focus: boolean;
    motion_intensity: number;
    camera_direction: string;
    cinematic_palette: string[];
  };
  spatial_configuration: {
    safe_zone_tag: string;
    focus_area: string | null;
  };
  yolo_omniscient_data: {
    total_objects: number;
    detections: unknown[];
  };

  // Phase 2 — Semantic Analysis (optional: present only after MLX Vision pass)
  cinematography?: {
    scene_description: string;
    lighting_type: string;
    visual_quality_score: number;
    technical_flaws: string;
    shot_size: 'ECU' | 'CU' | 'MCU' | 'MS' | 'FS' | 'WS' | 'INSERT';
  };
  semantic_analysis?: {
    subject_action: string;
    gaze_direction: 'LEFT' | 'RIGHT' | 'CENTER' | 'DOWN' | 'UP' | 'NONE';
    emotional_tone: string;
    narrative_energy_score: number;
    subject_screen_position: 'LEFT_THIRD' | 'CENTER' | 'RIGHT_THIRD' | 'NONE';
    subject_count: number;
    setting_location: string;
    key_props: string[];
  };
  continuity?: {
    action_description: string;
    emotion_arc: string;
    match_cut_potential: boolean;
    match_cut_vector: 'PAN_LEFT' | 'PAN_RIGHT' | 'TILT_UP' | 'TILT_DOWN' | 'PUSH_IN' | 'PULL_OUT' | 'STATIC' | 'NONE';
  };
  commercial?: {
    product_visibility: string;
    brand_safe: boolean;
    reaction_type: string;
  };
  story?: {
    narrative_role: string;
    recommended_position: string;
    director_note: string;
  };
}

export interface PancakeMetadata {
  fps: number;
  resolution: {
    width: number;
    height: number;
  };
}

export interface PancakeData {
  metadata: PancakeMetadata;
  stringout_timeline: PancakeClip[];
}

export interface AudioBeat {
  time: number;
  energy: number;
  type: string;
}

export function usePancakeData(sequenceName: string) {
  const [data, setData] = useState<PancakeData | null>(null);
  const [hitlData, setHitlData] = useState<any>({});
  const [finalCutTimeline, setFinalCutTimeline] = useState<FinalCutClip[]>([]);
  const [gemmaRecipe, setGemmaRecipe] = useState<any[] | null>(null);
  const [audioBpm, setAudioBpm] = useState<number | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioWaveforms, setAudioWaveforms] = useState<{ amplitude: number[], energy: number[] } | null>(null);
  const [audioBeats, setAudioBeats] = useState<AudioBeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFinalCut = useCallback(async () => {
    try {
      const finalRes = await fetch(`/engine/output/${sequenceName}/LLM_Export_Package/${sequenceName}_final_edit.json?t=${Date.now()}`);
      if (finalRes.ok) {
        const finalJson = await finalRes.json();
        setFinalCutTimeline(finalJson.final_edit_timeline || []);
      }
    } catch (e) {
      console.warn("Final edit file not found. Director's Cut Preview not available.");
    }
    
    try {
      const recipeRes = await fetch(`/engine/output/${sequenceName}/LLM_Export_Package/${sequenceName}_gemma_recipe.json?t=${Date.now()}`);
      if (recipeRes.ok) {
        const recipeJson = await recipeRes.json();
        setGemmaRecipe(recipeJson);
      } else {
        setGemmaRecipe(null);
      }
    } catch (e) {
      setGemmaRecipe(null);
      console.warn("Gemma recipe file not found.");
    }
  }, [sequenceName]);

  const fetchAudioData = useCallback(async () => {
    try {
      const audioRes = await fetch(`/engine/output/${sequenceName}/LLM_Export_Package/${sequenceName}_audio_beats.json?t=${Date.now()}`);
      if (audioRes.ok) {
        const audioJson = await audioRes.json();
        if (audioJson.bpm) {
          setAudioBpm(Math.round(audioJson.bpm));
        }
        if (audioJson.total_duration_sec) {
          setAudioDuration(audioJson.total_duration_sec);
        }
        if (audioJson.waveforms) {
          setAudioWaveforms(audioJson.waveforms);
        } else if (audioJson.waveform) {
          // Fallback for old JSONs
          setAudioWaveforms({ amplitude: audioJson.waveform, energy: audioJson.waveform });
        }
        if (audioJson.beats) {
          setAudioBeats(audioJson.beats);
        }
      }
    } catch (e) {
      console.warn("Audio beats file not found or corrupted.");
    }
  }, [sequenceName]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Carica il file stringout originale (immutabile)
        const res = await fetch(`/engine/output/${sequenceName}/LLM_Export_Package/${sequenceName}_stringout.json`);
        if (!res.ok) {
          throw new Error(`Errore HTTP: ${res.status} - Impossibile caricare il JSON. Assicurati che l'Engine abbia esportato correttamente in LLM_Export_Package.`);
        }
        const json = await res.json();
        
        // 2. Tenta di caricare il file HITL parallelo (non distruttivo)
        let loadedHitlData = { 
          hitl_constraints: {}, 
          clip_overrides: {},
          director_config: { target_duration: 60, style_prompt: "" }
        };
        try {
          const hitlRes = await fetch(`/engine/output/${sequenceName}/LLM_Export_Package/${sequenceName}_hitl_data.json`);
          if (hitlRes.ok) {
            const hitlJson = await hitlRes.json();
            loadedHitlData = {
              hitl_constraints: hitlJson.hitl_constraints || {},
              clip_overrides: hitlJson.clip_overrides || {},
              director_config: hitlJson.director_config || { target_duration: 60, style_prompt: "" }
            };
          }
        } catch (e) {
          console.warn("HITL Data file not found or corrupted. Starting fresh.");
        }
        setHitlData(loadedHitlData);
        
        // Uniamo cronologicamente le clip valide e il cestino per la UI
        const combinedTimeline = [
          ...(json.stringout_timeline || []),
          ...(json.trash_timeline || [])
        ].sort((a, b) => a.start - b.start);

        setData({ 
          metadata: json.metadata || { fps: 25, resolution: { width: 1920, height: 1080 } },
          stringout_timeline: combinedTimeline 
        });

        // 3. Tenta di caricare il file _final_edit.json (Director's Cut)
        await fetchFinalCut();
        
        // 4. Carica i dati audio (BPM, Waveform, Beats)
        await fetchAudioData();
        
      } catch (err: any) {
        setError(err.message || 'Errore sconosciuto durante il caricamento dei dati');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sequenceName, fetchFinalCut, fetchAudioData]);

  return { 
    data, 
    hitlData, 
    finalCutTimeline, 
    gemmaRecipe, 
    audioBpm, 
    audioDuration, 
    audioWaveforms, 
    audioBeats, 
    loading, 
    error, 
    refetchFinalCut: fetchFinalCut, 
    refetchAudioData: fetchAudioData 
  };
}
