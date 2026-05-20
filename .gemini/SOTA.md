# 🐺 SOTA (State of the Art)

**Version:** v0.1.36 - 2026-05-20

> [!NOTE]
> AG: Questo documento riflette lo stato corrente dell'architettura e delle automazioni locali del AI Video Editor.
> È la fonte di verità tecnica. Non descrive il flusso temporale (→ `PIPELINE.md`) né le feature UI (→ `FEATURES.md`)

---

## Architettura e Infrastruttura (Python AI Engine)

- **Struttura:** Il cuore del motore è isolato nella cartella `engine/` ed eseguito in un Virtual Environment (Python 3.13).
- **Core Tecnologico:** `OpenCV` (analisi Laplaciana, Optical Flow Farneback, K-Means palette), `Ultralytics YOLOv8n` (Person Detection).
- **Infrastruttura Dati (Drop Zone):** Architettura **Symmetrical Workflow** agnostica basata sul protocollo EDL (CMX3600) a 50fps. La cartella `engine/input/` funge da Drop-Zone a scansione automatica.
- **Topologia Stagna:** Gli output sono confinati in `engine/output/{sequence_name}/LLM_Export_Package/`. I file d'ingresso vengono spostati nella stessa cartella di output al termine del processo (non in `archive/`).

---

## Schema JSON del Payload Clip (Struttura Annidato — v0.1.34)

Il `_stringout.json` usa uno schema a **due livelli di profondità**. Le chiavi piatte legacy (`motion`, `people_count`, `cinematic_palette`, ecc.) sono state eliminate.

**Fase 1 — Sempre presente dopo `pancake_editor.py`:**
```json
{
  "start": 0.0, "end": 3.4, "tag": "MAIN_A", "best_moment": 1.2,
  "storyboard_paths": ["..."], "is_usable": true,
  "technical_quality": { "blur_score": 42.7, "is_soft_focus": false, "motion_intensity": 1.4, "camera_direction": "PAN_LEFT", "cinematic_palette": ["#1a2b3c"] },
  "spatial_configuration": { "safe_zone_tag": "MAIN_A", "focus_area": null },
  "yolo_omniscient_data": { "total_objects": 2, "detections": [] }
}
```

**Fase 2 — Opzionale, iniettato da `mlx_client.py` dopo la Vision LLM pass:**
```json
{
  "cinematography": { "scene_description": "...", "lighting_type": "NATURAL", "visual_quality_score": 8, "technical_flaws": "", "shot_size": "MS" },
  "semantic_analysis": { "subject_action": "...", "gaze_direction": "NONE", "emotional_tone": "...", "narrative_energy_score": 7, "subject_screen_position": "NONE", "subject_count": 1, "setting_location": "Outdoor Garden", "key_props": ["Wicker Swing"] },
  "continuity":     { "action_description": "...", "emotion_arc": "Calm", "match_cut_potential": true, "match_cut_vector": "NONE" },
  "commercial":     { "product_visibility": "LOW", "brand_safe": true, "reaction_type": "JOY" },
  "story":          { "narrative_role": "ESTABLISHING", "recommended_position": "OPENING", "director_note": "..." }
}
```

---

## Moduli a Microservizi (Pipeline A→E)

1. **`edl_parser.py`** — Ingest EDL puro. Estrae la mappa temporale (Record IN / Source IN) e il Naming Base dalla root della clip (`* FROM CLIP NAME`).
2. **`pancake_editor.py`** — Motore semantico di Fase A. Center-Weighted Laplacian, Dual Threshold Soft Focus, Action Peak tracking, Cinematic Palette K-Means, Optical Flow Farneback, Semantic Storyboard. Tutta la logica di finalizzazione è centralizzata nell'helper privato `_finalize_block()` per eliminare duplicazioni.
3. **`mlx_client.py`** — Fase B. Gateway nativo MLX locale per l'inferenza Vision LLM. Esegue l'analisi con temperatura hardcodata a 0.0 per la stabilità ed estrae i dettagli semantici estesi (setting_location, key_props). Inietta i 5 macro-oggetti annidati con fallback strutturato esplicito e salvataggio atomico progressivo.
4. **`bgm_generator.py`** — Fase C. Genera la BGM (click track mock o MusicGen). Estrae keyword da `cinematography.scene_description` e `continuity.action_description` per costruire il prompt musicale.
5. **`audio_analyzer.py`** — Fase C. Estrae i beat timestamps dalla BGM e li salva in `_audio_beats.json`.
6. **`director.py`** — Fase D. AI Director ragionante. Riceve la lista clip con i dati semantici, interpella Gemma 4 per una `editing_recipe`, poi applica la recipe su una griglia matematica di beat. Gestisce il sistema Pillar/Filler e il Safety Net auto-fill. Output: `_final_edit.json` + `_gemma_recipe.json`.
7. **`edl_exporter.py`** — Fase E. Export Stringout grezzo in CMX3600 EDL.
8. **`xml_exporter.py`** — Fase E. Export Director's Cut in FCP7 XML (Resolution-Agnostic, legge risoluzione da `hitl_data.json`).
9. **`api_server.py`** — Runtime server FastAPI (:8000). Espone `/api/system/profiler` (rilevamento hardware Apple Silicon) e `/api/orchestrate` (endpoint POST che riceve il payload ibrido dalla UI e attiva la Fase D isolata).
10. **`main.py`** — Orchestratore CLI Zero-Click. Esegue in sequenza le 5 fasi, con skip automatico della Fase B se MLX Server è offline. Registra le telemetrie prestazionali dell'esecuzione (tempi di OpenCV/YOLO, MLX e frame elaborati) scrivendole in `system_logs/performance_history.json` tramite `performance_tracker.py`.

---

## Il Principio della "Gerarchia del Calcolo" (UX Critica)

> [!IMPORTANT]
> **L'analisi visiva pesante avviene UNA SOLA VOLTA, nella pipeline `python main.py`.
> Il bottone "Regenerate Cut" nella UI non ricalcola il video e non tocca i frame. Invoca solo l'LLM testuale (Director) per una riorganizzazione logica del JSON.**

Il sistema applica una separazione netta tra i due tipi di operazione:

| Operazione | Dove | Durata tipica | Cosa fa |
|---|---|---|---|
| `python main.py` | Terminale | **3-10 minuti** | Analisi frame fisici (YOLO), inferenza Vision LLM per ogni clip (Gemma Fase B), generazione beat. |
| Bottone **"Regenerate Cut"** | UI | **1-3 secondi** | Passa lo stato JSON all'LLM (Fase D testuale) per farsi restituire una recipe di riordino logico. Non tocca pixel. |

**Motivazione architetturale:** Il `_stringout.json` (il "Passaporto Semantico") è immutabile dopo la Fase B. Contiene già tutti i metadati fisici e semantici. Il Director (Fase D) riceve via API solo quel JSON testuale e i vincoli HITL dell'utente, chiedendo a Gemma una nuova `recipe` per riarrangiare i puntatori temporali (rispettando il parametro deterministico Seed). È l'equivalente di riordinare le righe di un foglio Excel tramite LLM — non di rielaborare visivamente il file video.

**Implicazione per la UI:** Il feedback visivo del bottone deve comunicare chiaramente questa asimmetria. Un semplice spinner da 500ms è sufficiente e onesto. Non mostrare mai un progress bar che simuli un'elaborazione lunga su questa operazione.

---

## Frontend HITL (React/Vite)

- **Interfaccia Split-View NLE-style:** Video Player sincronizzato + Timeline Interattiva (Stringout & Director's Cut). Anti-Lag Engine 60fps via `requestAnimationFrame` sul DOM, scavalcando il React state globale. `React.memo` su tutte le clip card.
- **Timeline Orizzontale Interattiva (DnD & Zoom Engine):** `FinalCutTimeline` con blocchi flex proporzionali alla durata. Drag via `@dnd-kit/core` + `horizontalListSortingStrategy` + custom `snapToCursorModifier`. Zoom Engine `1x-50x` via slider o `Ctrl+Scroll`.
- **Clip Ghosting & Save Order:** Clip riposizionate assumono stato "Dirty" (trasparenza + alone scuro + bordo bianco). Il salvataggio è ottimistico: persiste l'ordine in `_hitl_data.json` sotto `clip_order_override` senza trigger re-fetch dell'engine.
- **Sistema Multi-Anchor (BM/IN/OUT):** Vincoli multipli per clip via shortcut (`M`, `I`, `O`), rimovibili chirurgicamente via `X`. Visualizzati come lista interattiva nella ClipCard.
- **Override Non-Distruttivi (KEEP/TRASH/BROLL):** Shortcut `K`, `T`, `B`. Stato visualizzato istantaneamente con glow e badge. Salvati su sidecar `_hitl_data.json`.
- **Director Settings Panel & Orchestrazione:** Sidebar rapida che invia l'intero stato ibrido (Seed, Constraints, Overrides, Analysis FPS) all'endpoint FastAPI `/api/orchestrate`. Creative Settings Portal full-screen per prompt e parametri NLP.
- **Interfaccia TypeScript `PancakeClip`:** Rispecchia fedelmente lo schema JSON annidato v0.1.34 con 7 sotto-interfacce typed (`technical_quality`, `spatial_configuration`, `yolo_omniscient_data`, `cinematography?`, `continuity?`, `commercial?`, `story?`). Zero chiavi piatte legacy.
- **Integrazione Telemetrica del Dashboard:** Middleware in Vite per servire staticamente `/system_logs/performance_history.json`. Visualizzazione delle performance dell'ultimo run (nome del modello VLM formattato, frame estratti e durata in minuti/secondi) posizionato simmetricamente sopra il Video Player principale tramite icona di attività di `lucide-react`.

---

## Automazione (Wolf Stack)

- **Trinity Startup:** `npm run wolf:dev` orchestra 3 sottoprocessi via `concurrently`: `dev:ui` (Vite :5173), `dev:api` (FastAPI :8000), `dev:llm` (MLX :8080 con gemma-4-e4b-it-4bit).
- **`dev:all`:** Comando dormiente (Vite + Supabase Functions). Riservato alla futura integrazione del layer dati (autenticazione, profili). Non usare nella pipeline corrente.
- **Release Flow:** `/wolf_flow` valida (ESLint + TSC), committa e pusha su `origin develop`.
