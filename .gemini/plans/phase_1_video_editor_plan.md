# Brief Architetturale - Fase 1: AI Video Editor - DB & Python Engine

Questo documento pianifica l'implementazione del primo MVP del progetto AI Video Editor. Coprirà l'aggiornamento della Knowledge Base, la struttura del Database (tramite migration Supabase) e la creazione dello script Python standalone per l'elaborazione video (MoviePy + OpenCV).

## User Review Required

> [!WARNING]
> La Sandbox IA ha restrizioni sull'esecuzione del Docker daemon. Conformemente alla REGOLA 1 del Wolf Protocol, l'IA non eseguirà MAI `npm run sb:up`. Una volta approvato ed eseguito il piano, il Tech Lead / PM dovrà applicare le migrazioni manualmente nel proprio host.

## Proposed Changes

### [Component Name] Knowledge Base Updates

#### [MODIFY] .gemini/VISION.md
Aggiornamento della vision per definire ufficialmente il nuovo dominio: "SaaS Local-First per AI Video Editing che utilizza Frame.io come backend di ingestione (tramite proxy) e MoviePy/OpenCV per l'elaborazione".

#### [MODIFY] .gemini/SCHEMA.md
Definizione formale dell'entità MVP `video_tasks` e della sua interfaccia.

### [Component Name] Database Migrations (MVP)

#### [NEW] supabase/migrations/<timestamp>_init_video_tasks.sql
L'IA genererà un nuovo file di migrazione usando il comando `npx supabase migration new`. Il file conterrà il codice SQL per:
- Tabella `video_tasks`.
- Colonne: `id` (uuid, primary key), `frame_io_asset_id` (text), `start_sec` (integer), `end_sec` (integer), `status` (text, default 'pending').

### [Component Name] Python Engine (quick_edit.py)

#### [NEW] engine/requirements.txt
Includerà le dipendenze: `supabase`, `requests`, `moviepy`, `opencv-python`, `python-dotenv`.

#### [NEW] engine/.env.example
Template per le variabili d'ambiente: `FRAME_IO_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.

#### [NEW] engine/quick_edit.py
Script monolitico che:
1. Connette a Supabase (http://127.0.0.1:54421).
2. Fetch di `status == 'pending'`.
3. Ingestione via Frame.io API v2 (proxy H.264).
4. Taglio via `moviepy` (`start_sec` -> `end_sec`).
5. Estrazione thumbnail con `cv2`.
6. Export in `engine/output/output.mp4` e `thumb.jpg` (creando la directory `output/` se assente).
7. Aggiornamento stato DB (`completed` o `failed` via try/except blocks).

### [Component Name] Infrastructure Config

#### [MODIFY] .gitignore
Aggiunte per proteggere secrets e output dell'engine:
```
engine/.env
engine/output/
```

## Verification Plan & QA Instructions for PM

### Manual Verification
1. L'IA terminerà il task generando tutto il codice e i file richiesti, ma fermandosi prima dell'esecuzione di Docker.
2. Il PM aprirà il proprio terminale (Host) ed eseguirà:
   ```bash
   npm run sb:up
   ```
   *Per validare:* Il database Supabase avvierà la nuova migrazione creando la tabella `video_tasks` e aggiornerà i types per il frontend.
3. Il PM dovrà creare il file `engine/.env` reale inserendo chiavi di test.
4. Il PM dovrà inizializzare un virtual environment in Python, installare i requirements ed eseguire `python engine/quick_edit.py`.
