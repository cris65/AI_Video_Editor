# 🗺️ STRUCTURE (Architettura delle Directory)

> [!NOTE]
> Questo documento mappa la topologia ufficiale del repository per l'AI Video
> Editor. Consulta questo file prima di assumere path relativi o assoluti, con
> particolare attenzione alla cartella output dell'engine.

## 📁 ROOT Directory (`/`)

La radice del progetto funge da **Frontend Command Center**. Contiene
l'applicazione React (Vite) e i file di configurazione principali:

- `src/`: Codice sorgente React/TypeScript, componenti UI per il sistema HITL
  (Human-In-The-Loop).
- `package.json` / `vite.config.ts`: Configurazione Frontend e comandi Node
  (`npm run`).
- `tailwind.config.js`: Design System e configurazione CSS.

## 📁 ENGINE Directory (`/engine`)

Il cuore dell'elaborazione AI (Python). Questo ambiente isolato è strettamente
Offline-First. Non interagisce direttamente con il frontend via codice, ma
tramite payload generati su file system.

- `venv/`: Virtual Environment Python (Py 3.13).
- `input/`: Drop-Zone per i file video grezzi e gli EDL di partenza.
- `archive/`: Storage di quarantena/pulizia post-elaborazione.
- `output/`: Destinazione degli artefatti elaborati. Struttura interna rigorosa:
  - `output/{sequence_name}/`: Cartella radice per la singola timeline.
  - `output/{sequence_name}/storyboards/`: I frame .jpg estratti da FFmpeg.
  - `output/{sequence_name}/LLM_Export_Package/`: Il "caveau" dei dati. Contiene
    il Passaporto Semantico (`{sequence_name}_stringout.json`), letto e
    sovrascritto atomicamente dalle Fasi A, B e C, e l'EDL finale generato
    (`_Stringout_Cut.edl`).
- `main.py`: Orchestratore CLI principale (Gestisce le Fasi A, B e C).
- `edl_parser.py` / `edl_exporter.py`: Ingest ed export protocollo CMX3600.
- `pancake_editor.py`: Motore semantico OpenCV e YOLOv8 (Fase A).
- `mlx_client.py`: Gateway HTTP sincrono-sequenziale verso l'API MLX locale per
  LLM Vision (Fase B).

## 📁 SUPABASE Directory (`/supabase`)

Contiene le migrazioni SQL e la configurazione dell'infrastruttura di database
per tracciare lo stato dei task e l'avanzamento dei lavori sulla UI.

- `migrations/`: Script SQL atomici incrementali.
- `seed.sql`: Dati di base per la simulazione e testing locale.

## 📁 .GEMINI Directory (`/.gemini` e `.agents`)

Il cervello del WOLF STACK. Contiene questa Knowledge Base, i file di
configurazione dell'agente e i workflow in `.agents/workflows/`.
