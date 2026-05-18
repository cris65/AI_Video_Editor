# 🐺 SOTA (State of the Art)

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
3. **edl_exporter.py**: Esportatore Premiere-ready (CMX3600), gestisce dinamicamente i "Boundary Crossing".
4. **mlx_client.py**: Microservizio Sincrono che agisce come gateway LLM Vision. Interroga l'API locale `127.0.0.1:8080/v1/chat/completions` (OpenAI format, modello gemma-4-e4b) caricando i base64 per arricchire il JSON con punteggio e analisi semantica continuativa. Dotato di auto-retry e salvataggio incrementale atomico.
5. **director.py**: AI Director generativo ("Regista Ragionante") che elabora il Final Cut montando sequenze logiche (CoT) partendo dallo Stringout e dai vincoli HITL, generando un _final_edit.json e un _gemma_recipe.json con reasoning dettagliato.
6. **main.py**: Orchestratore CLI interamente automatizzato (Zero-Click Pipeline). Passa attraverso tre fasi (Taglio YOLO, Inferenza LLM Vision su MLX, e Scrittura EDL).
7. **Frontend HITL (React/Vite)**: Interfaccia utente Human-In-The-Loop. Architettura Split-View NLE-style con Video Player sincronizzato e Timeline Interattiva (Stringout & Director's Cut). Integra un'ingegneria Anti-Lag spinta (60fps): il data-binding temporale usa `requestAnimationFrame` scavalcando lo state React globale, e implementa navigazione tastiera e Vertical Playlist con `React.memo`. Include un sistema Multi-Anchor (vincoli multipli per clip), un sistema di Override Non-Distruttivo (KEEP/TRASH/BROLL) con filtri avanzati, e un rendering vettoriale SVG ad alta risoluzione (2000pti) per la forma d'onda audio. I dati sono salvati su sidecar JSON (`_hitl_data.json`) via endpoint Node locale.

## Automazione (Open Agent Manager)
- I flussi di rilascio (`/wolf_flow`) validano e wrappano commit complessi sul repo `origin develop`.
