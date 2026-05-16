# 🐺 SOTA (State of the Art)

> [!NOTE]
> AG: Questo documento riflette lo stato corrente dell'architettura e delle automazioni locali del AI Video Editor.

## Architettura e Infrastruttura (Python AI Engine)
- **Struttura:** Il cuore del motore è isolato nella cartella `engine/` ed eseguito in un Virtual Environment (Python 3.13).
- **Core Tecnologico:** `OpenCV` (per analisi Laplaciana ed estrazione frame), `Ultralytics YOLOv8n` (per Person Detection).
- **Infrastruttura Dati (Drop Zone):** L'Engine si basa su un'architettura **Symmetrical Workflow** totalmente agnostica basata sul protocollo EDL (CMX3600) a 50fps. Usa la cartella `engine/input/` come Drop-Zone per leggere dinamicamente (tramite `glob`) il proxy `.mp4` e l'ingest `.edl`.
- **Topologia Stagna:** Gli output sono rigorosamente confinati in `engine/output/` e i nomi dei file generati ereditano il nome sequenza (`sequence_name`) bypassando le hardcodifiche.

## Moduli a Microservizi
1. **edl_parser.py**: Ingest EDL puro, calcolo TC-to-Float.
2. **pancake_editor.py**: Motore semantico di estrazione tagli con Human-in-the-Loop generativo.
3. **edl_exporter.py**: Esportatore Premiere-ready (CMX3600), calcolo Float-to-TC, accoppiamento RAW e Proxy.
4. **main.py**: Orchestratore CLI interattivo.

## Automazione (Open Agent Manager)
- I flussi di rilascio (`/wolf_flow`) validano e wrappano commit complessi sul repo `origin develop`.
