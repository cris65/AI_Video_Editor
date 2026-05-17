import { useState, useEffect } from 'react';

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
        let loadedHitlData = { hitl_constraints: {}, clip_overrides: {} };
        try {
          const hitlRes = await fetch(`/engine/output/${sequenceName}/LLM_Export_Package/${sequenceName}_hitl_data.json`);
          if (hitlRes.ok) {
            const hitlJson = await hitlRes.json();
            loadedHitlData = {
              hitl_constraints: hitlJson.hitl_constraints || {},
              clip_overrides: hitlJson.clip_overrides || {}
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
      } catch (err: any) {
        setError(err.message || 'Errore sconosciuto durante il caricamento dei dati');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sequenceName]);

  return { data, hitlData, loading, error };
}
