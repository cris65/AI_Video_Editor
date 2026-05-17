# 🚀 EVOLUTION (Roadmap & Fasi)

> [!NOTE]
> Questo documento traccia la direzione del prodotto e la fase corrente di
> sviluppo per l'AI Video Editor. Mantiene lo stato di avanzamento rigorosamente
> allineato all'architettura Offline-First (Python/MLX/YOLO) e all'interfaccia
> HITL (React).

## 🎯 Obiettivo Globale

Creare un ecosistema di montaggio video Local-First e automatizzato, che abbatte
i tempi di pre-selezione tramite inferenza AI (YOLO + MLX Vision) pur mantenendo
totale agnosticità (EDL CMX3600) verso Adobe Premiere Pro.

---

## 🟢 FASE 1: Core AI Engine & Pipeline Dati (IN CORSO)

La pipeline è divisa in tre sotto-fasi rigorosamente sequenziali.

**FASE A: Analisi Spaziale (Pancake Cut / YOLO)**

- [x] Generazione Stringout e Asset Proxy (estrazione frame temporalizzati).
- [x] Rilevamento della Safe Zone tramite YOLO/OpenCV.
- [x] Estrazione del `people_count` da YOLO e iniezione nel dizionario della clip.

**FASE B: Analisi Semantica (MLX Vision)**

- [x] Sviluppo `mlx_client.py` svincolato da ComfyUI.
- [x] Chiamate sincrone-sequenziali per protezione VRAM.
- [x] Salvataggio JSON atomico e incrementale (Incremental Checkpointing).
- [x] Fix puntamento path verso `LLM_Export_Package`.
- [x] Pulizia stringa `visual_quality_score` in numero intero tramite Regex.

**FASE C: Il "Regista" (Assembly & EDL Export) - PROSSIMA**

- [ ] Lettura del "Passaporto" JSON arricchito.
- [ ] Logica decisionale testuale (LLM standard) per il montaggio creativo in
      base a continuità e score.
- [ ] Esportazione CMX3600 sicura con gestione Boundary Crossing.

---

## 🟡 FASE 2: Frontend HITL (Human-In-The-Loop) & Supabase

- [ ] Inizializzazione ambiente React puro (root) purificato dal vecchio
      template CRM.
- [ ] Dashboard HITL per ispezione visiva del JSON: l'utente deve poter leggere
      l'analisi di MLX, vedere i frame estratti, e forzare manualmente i valori
      (es. correggere il `people_count` o lo score).
- [ ] Integrazione Supabase per il salvataggio degli stati di avanzamento delle
      timeline.

## 🔴 FASE 3: Orchestrazione Avanzata (FUTURA)

- [ ] Rilevamento di anomalie video avanzate (micro-mosso, drop frame).
- [ ] Esportazione XML multi-track per NLE alternativi (DaVinci/FCPX).
- [ ] Packaging e automazione esecuzione batch in background.
