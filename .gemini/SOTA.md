# 🐺 State of the Architecture (SOTA)

**Version:** v0.1.69 - 2026-05-24

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
2. **`pancake_editor.py`** — Motore semantico di Fase A. Center-Weighted Laplacian, Dual Threshold Soft Focus, Action Peak tracking, Cinematic Palette K-Means, Optical Flow Farneback, Semantic Storyboard (Native VLM Extraction a 896x896). Tutta la logica di finalizzazione è centralizzata nell'helper privato `_finalize_block()` per eliminare duplicazioni.
3. **`mlx_client.py`** — Fase B. Gateway nativo MLX locale per l'inferenza Vision LLM. Configura Gemma 4 in modalità Reasoning prepandendo il token `<|think|>` al prompt di sistema con parametri di campionamento specifici (`temperature=1.0`, `top_p=0.95`, `top_k=64`). Integra un parser regex greedy per isolare il payload JSON ignorando i tag e il testo di ragionamento (`<|channel>thought`). Inietta i 5 macro-oggetti annidati con fallback strutturato esplicito e salvataggio atomico progressivo.
4. **`bgm_generator.py`** — Fase C. Genera la BGM (click track mock o MusicGen). Estrae keyword da `cinematography.scene_description` e `continuity.action_description` per costruire il prompt musicale.
5. **`audio_analyzer.py`** — Fase C. Estrae i beat timestamps dalla BGM, calcola la Dual Waveform (Amplitude via np.abs e Energy via onset_env_b) a 80 pts/sec e li salva in `_audio_beats.json`.
6. **`director.py`** — Fase D. AI Director ragionante. Riceve la lista clip con i dati semantici, interpella il modello LLM selezionato per una `editing_recipe`, poi applica la recipe su una griglia matematica di beat. Implementa il **Virtual Sub-Clipping**: clona in ram le clip sorgente se presentano marker multipli distanti >2.0s. Introduce il **Deterministic Bypass**: se invocato con `bypass_llm=True`, salta la chiamata LLM assemblando la timeline solo con clip marcate o in KEEP. Il sincronismo ritmico è garantito dalla **Geometra Math**, che calcola l'offset di taglio (`trim_in`) in base al ruolo del marker (IN, OUT, M/AUDIO) e all'allocazione del beat, applicando clamping di sicurezza. Gestisce il sistema Pillar/Filler e il Safety Net auto-fill. Output: `_final_edit.json` (symlink-like fallback pointer) + `_gemma_recipe.json`. **History Archive System (Non-Destructive Local Versioning):** ad ogni inferenza, salva l'iterazione in `LLM_Export_Package/` come `_final_edit_vN.json` e `_gemma_recipe_vN.json`, documentati nel `_version_log.json` che funge da indice con metadata (timestamp, user constraints, target duration, model, seed). Misura anche e registra con precisione millimetrica l'`inference_time_seconds` telemetrico.
7. **`edl_exporter.py`** — Fase E. Export Stringout grezzo in CMX3600 EDL.
8. **`xml_exporter.py`** — Fase E. Export Director's Cut in FCP7 XML (Resolution-Agnostic, legge risoluzione da `hitl_data.json`).
9. **`api_server.py`** — Runtime server FastAPI (:8000). Espone `/api/system/profiler` (rilevamento hardware Apple Silicon), `/api/orchestrate` (endpoint POST che riceve il payload ibrido dalla UI e attiva la Fase D isolata), `/api/projects/completed` (Version-Aware con payload esteso LLM count), e i nuovi endpoint dell'Audio Rhythm Engine (`/api/audio/files`, `/api/audio/analyze`).
10. **`main.py`** — Orchestratore CLI Zero-Click. Esegue in sequenza le 5 fasi, con skip automatico della Fase B se MLX Server è offline.

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

**Implicazione per la UI:** La UI fornisce un **Precision Stopwatch** (Elapsed MM:SS timer) legato a `isRegenerating` sul bottone, bypassando profiler fittizi per NLP. 

---

## Frontend HITL (React/Vite)

- **Version-Aware Home Screen:** La lista "Progetti Completati" espone un badge per informare l'utente sul numero di Director's Cut esistenti e il modello LLM usato nell'ultima inferenza (con relativo tempo espresso in `MM:SS`), senza entrare nel progetto. Integra i dati del `source_metadata` (risoluzione, framerate e durata sorgente) estratti dal motore Python, esibendo le card dei video con dettagli tecnici avanzati. La History è esplorabile tramite il componente universale DRY `VersionHistoryDropdown`, il quale espone nativamente la durata reale (`duration_seconds`) della singola iterazione di montaggio, ed è riutilizzabile ovunque grazie ai render props. Fallback strutturato (Zero `any` policy) per i progetti pre-versioning.
- **Interfaccia Split-View NLE-style:** Video Player sincronizzato + Timeline Interattiva (Stringout & Director's Cut). Anti-Lag Engine 60fps via `requestAnimationFrame` sul DOM, scavalcando il React state globale. `React.memo` su tutte le clip card.
- **Timeline Orizzontale Interattiva — Absolute Tracking Engine:** `UniversalTimeline` con blocchi flex. Zoom Engine via rotella del mouse con `anchorFrac` matematico. Pan (`P`) e Scrub (`P+L`) operano tramite **Absolute Tracking Refs** (`panDragRef`, `scrubDragRef`): al primo `mousemove` si fotografa `startX` e `startWindow`, ogni successivo calcolo usa la differenza assoluta rispetto al punto di ancoraggio iniziale. Questo elimina il drift causato dal React State Batching durante movimenti lenti (mouse gaming ad alta frequenza). Il container di zoom nel `UniversalTimelineTrack` non ha transizioni CSS (`transition-all` rimosso) per garantire zoom istantaneo e playhead inchiodato. Durante pan/scrub, `isModifying` disabilita `pointer-events` sulle clip per prevenire D&D accidentale. Il playhead è un unico nodo `w-px` con SVG `absolute` annidato, eliminando il subpixel snapping differenziale.
- **Audio Rhythm Engine & Dual Waveform:** Estrazione avanzata delle tracce audio (Percussive/Harmonic, Beats, BPM) tramite `librosa`. Overlay d'onda SVG proporzionale. Alert UI intelligente per il deflag forzato sul Target Duration in caso di mancata corrispondenza durata clip-audio.
- **Clip Ghosting & Save Order:** Clip riposizionate assumono stato "Dirty" (trasparenza + alone scuro + bordo bianco). Il salvataggio è ottimistico: persiste l'ordine in `_hitl_data.json` sotto `clip_order_override` senza trigger re-fetch dell'engine.
- **Sistema Multi-Anchor (BM/IN/OUT/AUDIO) + Bookend globali:** Vincoli multipli per clip via shortcut. I Bookend globali utilizzano `clipOverrides` con marcatore posizionato al timestamp esatto della playhead.
- **Override Non-Distruttivi (KEEP/TRASH/BROLL):** Shortcut `K`, `T`, `B`. Stato visualizzato istantaneamente con glow e badge nella UI. 
- **Director Settings Panel & Orchestrazione:** Sidebar rapida che invia l'intero stato ibrido (Seed, Constraints, Overrides) all'endpoint FastAPI `/api/orchestrate`. Creative Settings Portal (`AdvancedDirectorModal`) full-screen per prompt e parametri NLP. Include visualizzatori vettoriali (SVG) per la `Rhythmic Strictness` (onde di Bezier + clip tolleranza). Il selettore modello AI espone 3 opzioni mappate su modelli MLX.
- **Interfaccia TypeScript `PancakeClip`:** Rispecchia fedelmente lo schema JSON annidato v0.1.34 con 7 sotto-interfacce typed. Zero chiavi piatte legacy.
- **Integrazione Telemetrica del Dashboard:** Middleware in Vite per servire staticamente `/system_logs/performance_history.json`. Visualizzazione delle performance dell'ultimo run.
- **NLE Header Layout — DRY Universal (UI-006):** `UniversalTimelineHeader` usa una struttura flex `justify-between` con tre zone: LEFT (timecode monocromatico), CENTER (absolute + centered: clip legend data-driven — `A-ROLL/B-ROLL/REJECTED` in Stringout, `PILLAR/FILLER` in Director's Cut → separatore `|` → bottoni Wave / Audio / Shortcuts universali su entrambi i modi — NON più condizionati a `mode === 'stringout'`), RIGHT (durata totale in SO, SAVE ORDER button in DC). La prop `onDirectExportDC` accetta `(newOrderedClips?: UniversalClip[]) => void`: se invocata dal DnD hook, usa l'ordine post-drag; se invocata dal button SAVE ORDER (senza argomenti), usa `orderedFinalCut` come fallback.
- **Universal Ripple Edit (UI-006):** `useUniversalDnd.displayClips` memo applica il cursor gapless su TUTTI i modi (rimozione del guard `if (mode === 'stringout')`). Tutte le clip, indipendentemente dal modo, vengono rimpacchettate sequenzialmente senza gap dopo ogni riordino DnD. Il campo `mode` è stato rimosso dai deps del memo poiché non più referenziato in quel contesto.
- **DC Click-to-Seek (UI-006):** `handleTimelineClick` in `UniversalTimeline` ora delega a `props.dcActions.onSeek(seekTime)` in DC mode invece di impostare direttamente `videoRef.currentTime` (source time grezzo). `onSeek` è mappato a `seekToTimelineTime` di `useSequencePlayer` in `PancakeDashboard`, che traduce il tempo timeline in source time rispettando `timeline_in/out`.
- **Track Height DRY (UI-006):** Il container `UniversalTimelineTrack` ha altezza fissa `64px` per entrambi i modi (rimosso il ternario `mode === 'director_cut' ? '120px' : '64px'`).
- **BPM Grid Overlay & Propagation (UI-006 & UI-007):** Vertical BPM grid lines are moved from the ruler layer (`h-[24px]`) to a dedicated overlay at `top-[24px] / bottom-0`, matching the height of the clips. Waveform in DC mode is corrected from `top-[72px]` to `top-[24px] bottom-0`. Corrected BPM `leftPct` calculation to be relative to `audioDuration` scaled by the timeline fraction, ensuring accurate alignment with the physical waveform. Tiled synthetic beat lines beyond `audioDuration` up to `totalDuration` using the analyzed BPM interval (dashed, semi-transparent styling) for metronome reference.
- **Active Marker Toolbar Footer:** `UniversalTimeline` ha un footer `justify-center` con due gruppi semantici: HUMAN (`IN`, `OUT`, `M`) e MACHINE (`A` per audio Librosa, `BM Analysis` per YOLO). Ogni bottone funge da toggle `hiddenMarkers` passato al renderer della traccia. Il marker `AUDIO` è classificato come MACHINE perché generato da `audio_analyzer.py` (Librosa), non da constraint umani.
- **Keyboard Shortcuts Panel:** `TimelineKeyboardShortcuts` espone solo la reference keyboard, senza toggle marker (rimossi e spostati nel footer toolbar).

---

## Automazione (Wolf Stack)

- **Trinity Startup:** `npm run wolf:dev` orchestra 3 sottoprocessi via `concurrently`: `dev:ui` (Vite :5173), `dev:api` (FastAPI :8000), `dev:llm` (MLX :8080 con gemma-4-e4b-it-4bit).
- **`dev:all`:** Comando dormiente (Vite + Supabase Functions). Riservato alla futura integrazione del layer dati (autenticazione, profili). Non usare nella pipeline corrente.
- **Release Flow:** `/wolf_flow` valida (ESLint + TSC), committa ed esporta localmente la KB in `WOLF_EXPORTS`. Un git hook `post-commit` sincronizza in modo differenziale `WOLF_EXPORTS` su Google Drive per allineare la memoria con Gemini Web/App.
- **WOLF Guardian System:** Architettura di sicurezza a due livelli (Fast Guardian su `pre-commit` con Gemini Flash e WOLF Guardian su `pre-push` con Gemini Pro) per intercettare e auto-correggere (max 3 tentativi) regressioni semantiche non intenzionali basate sui `git diff`. Mantiene una memoria di autoapprendimento persistente JSON in `.wolf/guardian_memory.json` tramite `scripts/wolf_guardian/logger.js`.
- **Order Versioning & Namespace Rules:** Tutti i task, piani e commit seguono un rigoroso tracciamento progressivo nei namespace `[UI-XXX]`, `[WOLF-XXX]`, `[ENG-XXX]`, memorizzato in `.wolf/orders_ledger.md`. Le "Epic" incrementano l'intero (es. `[WOLF-001]`), mentre le iterazioni atomiche incrementano i decimali (es. `[WOLF-001.1]`).
