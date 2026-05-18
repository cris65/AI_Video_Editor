import { useState, useEffect } from 'react';

export interface DirectorConfig {
  ai_model?: 'gemma-4-4b' | 'gemma-4-31b';
  target_duration: number;
  style_prompt: string;
  export_resolution?: string;
  analysis_fps?: number;
  target_product?: string;
  expected_subjects?: number;
  secondary_elements?: string;
  ignore_list?: string;
  safe_zone_margin?: number;
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
}

export interface PancakeClip {
  start: number;
  end: number;
  tag: string;
  best_moment: number;
  people_count: number;
  storyboard_path: string;
  cinematic_palette: string[];
  motion: {
    intensity: number;
    direction: string;
  };
  scene_and_lighting?: string;
  action_continuity?: string;
  visual_quality_score?: number;
  technical_flaws?: string;
  is_usable?: boolean;
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

export function usePancakeData(sequenceName: string) {
  const [data, setData] = useState<PancakeData | null>(null);
  const [hitlData, setHitlData] = useState<any>({});
  const [finalCutTimeline, setFinalCutTimeline] = useState<FinalCutClip[]>([]);
  const [gemmaRecipe, setGemmaRecipe] = useState<any[] | null>(null);
  const [audioBpm, setAudioBpm] = useState<number | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioWaveform, setAudioWaveform] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        
        // 4. Carica il BPM dal file _audio_beats.json
        try {
          const audioRes = await fetch(`/engine/output/${sequenceName}/LLM_Export_Package/${sequenceName}_audio_beats.json?t=${Date.now()}`);
          if (audioRes.ok) {
            const audioJson = await audioRes.json();
            if (audioJson.tempo) {
              setAudioBpm(Math.round(audioJson.tempo));
            }
            if (audioJson.audio_duration) {
              setAudioDuration(audioJson.audio_duration);
            }
            if (audioJson.waveform) {
              setAudioWaveform(audioJson.waveform);
            }
          }
        } catch (e) {
          console.warn("Audio beats file not found or corrupted.");
        }
        
      } catch (err: any) {
        setError(err.message || 'Errore sconosciuto durante il caricamento dei dati');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sequenceName]);

  const fetchFinalCut = async () => {
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
  };

  return { data, hitlData, finalCutTimeline, gemmaRecipe, audioBpm, audioDuration, audioWaveform, loading, error, refetchFinalCut: fetchFinalCut };
}
