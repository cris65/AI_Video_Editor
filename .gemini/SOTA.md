# 🐺 SOTA (State of the Art)

> [!NOTE]
> AG: Questo documento riflette lo stato corrente dell'architettura e delle automazioni locali del AI Video Editor.

## Architettura e Infrastruttura (Python AI Engine)
- **Struttura:** Il cuore del motore è isolato nella cartella `engine/` ed eseguito in un Virtual Environment (Python 3.13).
- **Core Tecnologico:** `OpenCV` (per analisi Laplaciana ed estrazione frame), `Ultralytics YOLOv8n` (per Person Detection).
- **Infrastruttura Dati (Drop Zone):** L'Engine si basa su un'architettura **Symmetrical Workflow** totalmente agnostica basata sul protocollo EDL (CMX3600) a 50fps. Usa la cartella `engine/input/` come Drop-Zone per leggere dinamicamente qualsiasi container video.
- **Topologia Stagna:** Gli output sono confinati in `engine/output/` con nomenclatura `_Stringout_Cut.edl`, e i file d'ingresso vengono automaticamente spostati in `engine/archive/` al termine del processo.

## Moduli a Microservizi
1. **edl_parser.py**: Ingest EDL puro, calcolo TC-to-Float a 50fps.
2. **pancake_editor.py**: Motore semantico di analisi frame (Blacklist filtering, Center-Weighted Focus, Action Peak, Dual Threshold Soft Focus, Cinematic Palette K-Means, Optical Flow Sparse, Semantic Storyboard). Gestisce anche l'estrazione di un Trash Reel diagnostico e l'impacchettamento finale.
3. **edl_exporter.py**: Esportatore Premiere-ready (CMX3600), gestisce dinamicamente i "Boundary Crossing" spezzando eventi a cavallo di clip multiple.
4. **main.py**: Orchestratore CLI interamente automatizzato (Zero-Click Pipeline). Gestisce il routing granulare degli I/O, convogliando gli output e l'auto-cleanup per sequence_name.

## Automazione (Open Agent Manager)
- I flussi di rilascio (`/wolf_flow`) validano e wrappano commit complessi sul repo `origin develop`.
