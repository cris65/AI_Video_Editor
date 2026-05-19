# 🐺 Functional Specifications (FEATURES.md)

**Version:** v0.1.31 - 2026-05-20

> [!NOTE]
> Questo documento descrive le **Feature** — ovvero il valore funzionale esposto all'utente finale,
> sia come capacità dell'engine che come interfaccia UI. Non descrive come i dati sono strutturati
> (→ `STRUCTURE.md`) né il flusso temporale di esecuzione (→ `PIPELINE.md`).

## Core Capabilities (Stringout AI Engine)

### 1. Taglio a Singolo Binario (Stringout Workflow)
Il sistema estrapola un'unica timeline ottimizzata per massimizzare la velocità di post-produzione offline:
- **Stringout Track:** Raccoglie tutti i frammenti utilizzabili del girato, classificandoli semanticamente (MAIN_A, B-ROLL, EDGE_DANGER).
- **Trash Reel:** Binario parallelo invisibile all'EDL finale ma renderizzato in `.mp4` (preview_TRASH) per il Quality Control visivo di ciò che l'algoritmo ha scartato.

### 2. Filtri Fisici e Saliency (Action Peak)
- **Center-Weighted Focus:** Il filtro Laplaciano calcola la cecità (blur) esclusivamente sul 50% centrale dell'inquadratura, tollerando lenti luminose e forti effetti bokeh ai lati.
- **Dual Threshold Soft Focus:** Seleziona rigorosamente i frame: `TRASH_BLUR` sotto `10.0`, mentre la "zona grigia" (10-25) viene ammessa nella timeline ma taggata con il suffisso `_SOFT` (es. `MAIN_A_SOFT`).
- **MOTION_THRESHOLD:** Scarta movimenti di camera estremi o sballottamenti (soglia `40.0`).
- **Action Peak (Best Moment):** Tracciamento in tempo reale del picco di nitidezza. L'engine memorizza la chiave temporanea `_max_lap` e certifica all'interno della metadata clip il `best_moment`, ovvero il millisecondo esatto del fotogramma perfetto per gli LLM successivi.
- **Boundary Crossing Split:** Tagli proxy che scavallano il bordo della clip originale vengono spezzati dinamicamente durante l'export EDL per prevenire errori "Media Offline" o pattern zebrati su Adobe Premiere.
- **DNA Cromatico (Cinematic Palette):** Tramite K-Means Clustering su OpenCV, l'algoritmo estrae al volo i 5 colori HEX dominanti di ogni clip. Il campionamento fonde 3 matrici (IN, OUT, e BEST) per una color-continuity perfetta senza pesare sulle performance CPU e RAM (Zero-Seeking).
- **Optical Flow (Motion Scoring):** Calcolo vettoriale `Farneback` ultraleggero a 160x90 per ogni blocco. Restituisce `motion_intensity` (float) e `camera_direction` (PAN_LEFT, PAN_RIGHT, TILT_UP, TILT_DOWN, STATIC) nel macro-oggetto annidato `technical_quality` dello `stringout.json`.
- **Semantic Storyboard & Smart Naming:** Estrazione al volo di tre frame (IN, BEST, OUT) a 480x270, uniti orizzontalmente. I frame estratti non sono più anonimi, ma intercettano dalla mappa EDL il VERO nome nativo (`C4369`) e il Timecode sicuro calcolato dal motore, generando `{clip_name}_{tc_safe}.jpg`.

### 3. FASE B - Vision LLM Inference (MLX Server)
L'Engine non è più "cieco". Integrando l'ecosistema MLX locale via standard OpenAI-compatible (`http://127.0.0.1:8080/v1/chat/completions`), il sistema analizza la timeline di Stringout:
- Convertendo al volo lo Semantic Storyboard in `base64` e inviando il contesto tecnico YOLO (numero soggetti rilevati in scena).
- Iniettando un Context Prompt specifico sulla Continuità Cronologica e sull'analisi commerciale.
- Ricevendo da Gemma 4 un payload JSON strutturato in **5 macro-oggetti annidati** che arricchisce ogni clip:
  - `cinematography` → `scene_description`, `lighting_type`, `visual_quality_score`, `technical_flaws`
  - `semantic_analysis` → `subject_action`, `gaze_direction`, `emotional_tone`, `narrative_energy_score`
  - `continuity` → `action_description`, `emotion_arc`, `match_cut_potential`
  - `commercial` → `product_visibility`, `brand_safe`, `reaction_type`
  - `story` → `narrative_role`, `recommended_position`, `director_note`
- Salvando il risultato validato nel dict JSON tramite una logica tollerante e autonoma (retry x3, regex cleaning, fallback strutturato esplicito per ogni sotto-chiave, salvataggio JSON progressivo atomico post-clip).
- Bypass morfologico (Skip Morbido) per l'ingest automatico se il server MLX non è avviato.
- **Integrazione Nativa Apple Silicon**: L'ambiente Python (`engine/requirements.txt`) è equipaggiato nativamente con i framework `mlx` e `mlx-lm` per l'inferenza LLM diretta sulla Unified Memory, senza dipendere da server esterni.

### 4. Automazione Drop-Zone Flessibile
- **Ingest Agnostico:** Supporto esteso a `.mp4`, `.mov`, `.mxf`, `.avi`, `.mkv`.
- **Auto-Cleanup:** Una volta emesso il file EDL (`_Stringout_Cut.edl`), i file originali nella drop zone vengono puliti e spostati direttamente nella cartella di output della rispettiva sequenza per evitare strascichi.
- **Esportazione Diretta:** Eliminato il gate manuale [Y/N]; il motore macina proxy, calcola scarti e genera CMX3600 in autonomia totale a 50fps.

### 5. FASE D - AI Director (Risoluzione Vincoli HITL)
Il Director è il modulo che chiude il loop tra l'analisi AI e le decisioni umane:
- **LLM Editing Recipe:** Gemma 4 riceve la lista dei clip usabili (con Score, Scene, Action Strategy) e produce una `editing_recipe` JSON che definisce l'ordine narrativo e i beat musicali assegnati a ogni clip.
- **Beat-Sync Math:** La recipe LLM viene applicata su una griglia matematica di beat timestamps (`_audio_beats.json`). Ogni clip viene troncata/estesa in modo da essere perfettamente sincronizzata con il ritmo musicale.
- **Pillar & Filler System:** Le clip con marker BM (Best Moment) impostati dall'utente diventano PILLAR ancorati sul beat più vicino. Le clip senza vincoli diventano FILLER, ordinati per `visual_quality_score` come criterio di spareggio.
- **Safety Net Auto-Fill:** Se la recipe LLM è troppo corta rispetto alla target duration, il Director attiva autonomamente un fallback euristico a 4-beat per riempire i gap rimanenti.
- **Export Dual-Track:** Produce `_final_edit.json` (timeline interna) + `_FinalCut.xml` (FCP7 XML pronto per Premiere/FCPX) + `_gemma_recipe.json` (reasoning del Director per debug e trasparenza).

## Frontend (React HITL Dashboard)

### 1. NLE-Style Split-View
- **Interactive Timeline**: Barra temporale sincronizzata al millisecondo, renderizza cromaticamente i segmenti validi (Verde MAIN, Blu B-ROLL) e scartati (Rosso). Supporta Filtri dinamici (ALL/VALID/BROLL/TRASH) che lasciano spazi vuoti ("buchi neri") fisici per rispettare il timing.
- **Vertical Playlist Auto-Scrollante**: L'ispettore laterale scorre autonomamente e tiene sempre a fuoco la clip attiva nel video, garantendo una UX immersiva.
- **Multi-Anchor System (BM/IN/OUT)**: Gli editor umani possono applicare molteplici vincoli temporali (markers) sulla stessa clip premendo `M`, `I`, `O`. Rimuovibili in modo chirurgico e frame-accurate tramite `X`, o visualizzati come lista interattiva direttamente nella ClipCard.
- **Forced Overrides Non-Distruttivi**: Tasti `K` (Keep), `T` (Trash), e `B` (B-Roll) permettono all'umano di scavalcare l'Intelligenza Artificiale, forzando lo stato di una clip. Le modifiche sono visualizzate istantaneamente con glow e badge (es. `FORCED B-ROLL`), e salvate in parallelo su sidecar JSON.
- **Keyboard Shortcuts Professionali**: Integrazione standard per il montaggio. Spazio per Play/Pausa, frecce orizzontali per lo scrubbing (10 frames base, +Shift per 1 frame, +Alt per 30 frames), frecce verticali per "saltare" istantaneamente ai tagli successivi/precedenti calcolati dall'Engine. Menu informativo (Info Popup) "on-click" per tutte le timeline.
- **Anti-Lag Engine (60fps)**: Data-binding del tempo completamente sganciato dal React State e demandato a un `requestAnimationFrame` diretto sul DOM. I re-render React sono bloccati tramite `React.memo` tranne quando il video sorpassa un effettivo "taglio" dell'EDL virtuale.
- **Director Settings Panel & Advanced Modal**: L'utente può accedere a un panel avanzato `🎨 AI Director Creative Settings` (tramite createPortal per superare limiti di z-index) dove impostare il *Target Product*, *Expected Subjects*, *Focus Area* e parametri NLP, salvati all'interno della `DirectorConfig`.
- **Dynamic Hardware Profiler & Trinity Startup**: L'intero ecosistema (React + Python) si avvia in parallelo con un singolo comando (`npm run wolf:dev`). Il widget hardware integrato non usa più dati mockati, ma legge il profilo dal backend (`/api/system/profiler`) che a sua volta estrae l'esatto modello del chip e la Unified RAM interrogando nativamente il kernel macOS (`sysctl`). L'ETA e i lotti di inferenza (Chunks) sono calcolati matematicamente in real-time.
