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

export interface PancakeData {
  stringout_timeline: PancakeClip[];
}

export function usePancakeData(sequenceName: string) {
  const [data, setData] = useState<PancakeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/engine/output/${sequenceName}/LLM_Export_Package/${sequenceName}_stringout.json`);
        if (!res.ok) {
          throw new Error(`Errore HTTP: ${res.status} - Impossibile caricare il JSON. Assicurati che l'Engine abbia esportato correttamente in LLM_Export_Package.`);
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Errore sconosciuto durante il caricamento dei dati');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sequenceName]);

  return { data, loading, error };
}
