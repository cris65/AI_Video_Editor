# 🐺 SOTA (State of the Art)

**Version:** v0.1.22 - 2026-05-18

> [!NOTE]
> AG: Questo documento riflette lo stato corrente dell'architettura e delle automazioni locali del AI Video Editor.

## Architettura e Infrastruttura (Python AI Engine)
- **Struttura:** Il cuore del motore è isolato nella cartella `engine/` ed eseguito in un Virtual Environment (Python 3.13).
- **Core Tecnologico:** `OpenCV` (per analisi Laplaciana ed estrazione frame), `Ultralytics YOLOv8n` (per Person Detection).
- **Infrastruttura Dati (Drop Zone):** L'Engine si basa su un'architettura **Symmetrical Workflow** totalmente agnostica basata sul protocollo EDL (CMX3600) a 50fps. Usa la cartella `engine/input/` come Drop-Zone per leggere dinamicamente qualsiasi container video.
- **Topologia Stagna:** Gli output sono confinati in `engine/output/` con nomenclatura `_Stringout_Cut.edl`, e i file d'ingresso vengono automaticamente spostati in `engine/archive/` al termine del processo.

## Moduli a Microservizi
1. **edl_parser.py**: Ingest EDL puro. Estrae la mappa temporale (Record IN / Source IN) e rileva automaticamente il Naming Base dalla root della clip ("* FROM CLIP NAME").
2. **pancake_editor.py**: Motore semantico di analisi frame (Blacklist filtering, Center-Weighted Focus, Action Peak, Dual Threshold Soft Focus, Cinematic Palette K-Means, Optical Flow Sparse, Semantic Storyboard). Intercetta i Timecode IN sicuri e calcola dinamicamente il nome univoco per ciascun JPEG generato.
3. **xml_exporter.py (ex edl_exporter.py)**: Esportatore Premiere-ready (FCP7 XML). È completamente "Resolution-Agnostic", legge la risoluzione custom dal file `hitl_data.json` o da UI, forza il Pixel Aspect Ratio (PAR) a square (1.0) ed è compatibile con le custom resolutions definite dal regista.
4. **mlx_client.py**: Microservizio Sincrono che agisce come gateway LLM Vision. Interroga l'API locale `127.0.0.1:8080/v1/chat/completions` (OpenAI format, modello gemma-4-e4b) caricando i base64 per arricchire il JSON con punteggio e analisi semantica continuativa. Dotato di auto-retry e salvataggio incrementale atomico.
5. **director.py**: AI Director generativo ("Regista Ragionante") che elabora il Final Cut montando sequenze logiche (CoT) partendo dallo Stringout e dai vincoli HITL, generando un _final_edit.json e un _gemma_recipe.json con reasoning dettagliato.
6. **main.py**: Orchestratore CLI interamente automatizzato (Zero-Click Pipeline). Passa attraverso tre fasi (Taglio YOLO, Inferenza LLM Vision su MLX, e Scrittura XML).
7. **Frontend HITL (React/Vite)**: Interfaccia utente Human-In-The-Loop. Architettura Split-View NLE-style con Video Player sincronizzato e Timeline Interattiva (Stringout & Director's Cut). Integra un'ingegneria Anti-Lag spinta (60fps): il data-binding temporale usa `requestAnimationFrame` scavalcando lo state React globale, e implementa navigazione tastiera e Vertical Playlist con `React.memo`. Include un sistema Multi-Anchor (vincoli multipli per clip), un sistema di Override Non-Distruttivo (KEEP/TRASH/BROLL) con filtri avanzati. La UI è sincronizzata real-time: cliccando un marker o una clip nell'inspector verticale, la playhead orizzontale esegue il seek istantaneamente. Include playhead "Premiere style" in SVG e settaggi risoluzione custom per l'export. I dati sono salvati su sidecar JSON (`_hitl_data.json`) via endpoint Node locale.
   - **Timeline Orizzontale Interattiva (NLE DnD & Zoom Engine):** La `FinalCutTimeline` è un workspace NLE-style interattivo. I blocchi clip sono flex-item proporzionali alla durata (no `position: absolute`). Il drag orizzontale usa `@dnd-kit/core` + `horizontalListSortingStrategy` e un custom `snapToCursorModifier` per assicurare che il drag-overlay agganci perfettamente il cursore compensando il clamping della larghezza massima (max 350px) durante lo zoom spinto.
   - **Zoom Engine e Clip Ghosting:** Integrazione di uno Zoom Engine `(1x - 50x)` controllato via slider UI o `Ctrl+Scroll`. Le clip riposizionate manualmente assumono uno stato "Dirty" o "Ghosting" in tempo reale (trasparenza globale con un elegante alone interno scuro e bordo bianco) finché il pulsante "SAVE ORDER" persiste l'ordine su `_hitl_data.json` sotto la chiave `clip_order_override`. Questo provoca il refetch della timeline originaria che "lava" lo stato dirty, certificando il salvataggio avvenuto con successo. Waveform overlay e playhead RAF-driven sono inviolabili e renderizzano Z-indexed sopra le clip in drag.

## Automazione (Open Agent Manager)
- I flussi di rilascio (`/wolf_flow`) validano e wrappano commit complessi sul repo `origin develop`.
