# 🗺️ STRUCTURE (Architettura delle Directory)

**Version:** v0.1.30 - 2026-05-20

> [!NOTE]
> Questo documento mappa la topologia ufficiale del repository per l'AI Video
> Editor. Consulta questo file prima di assumere path relativi o assoluti, con
> particolare attenzione alla cartella output dell'engine.

---

## Il Modello Concettuale a 3 Dimensioni

Il sistema è definito da tre dimensioni ortogonali e complementari:

- **STRUTTURA** (questo file) → *Come* i dati sono organizzati: il JSON annidato, l'albero delle directory, i moduli Python. Lo scheletro statico.
- **PIPELINE** (vedi `PIPELINE.md`) → *Quando* i dati si muovono: la sequenza temporale Fase A→E. Il nastro trasportatore.
- **FEATURE** (vedi `FEATURES.md`) → *Cosa* vede l'utente: i bottoni UI, i pannelli, gli shortcut. Il volante dell'auto.

---

## 📁 ROOT Directory (`/`)

La radice del progetto funge da **Frontend Command Center**. Contiene
l'applicazione React (Vite) e i file di configurazione principali:

- `src/`: Codice sorgente React/TypeScript, componenti UI per il sistema HITL (Human-In-The-Loop).
- `package.json` / `vite.config.ts`: Configurazione Frontend e comandi Node (`npm run`).
- `tailwind.config.js`: Design System e configurazione CSS.
- `.gemini/`: Knowledge Base del Wolf Stack (vedere sezione dedicata).

---

## 📁 ENGINE Directory (`/engine`)

Il cuore dell'elaborazione AI (Python). Questo ambiente isolato è strettamente
Offline-First. Non interagisce direttamente con il frontend via codice, ma
tramite payload generati su file system.

- `venv/`: Virtual Environment Python (Py 3.13).
- `input/`: Drop-Zone per i file video grezzi (`.mp4`, `.mov`, `.mxf`, `.avi`) e gli EDL di partenza.
- `archive/`: Storage di quarantena/pulizia post-elaborazione.
- `output/`: Destinazione degli artefatti elaborati. Struttura interna rigorosa:
  - `output/{sequence_name}/`: Cartella radice per la singola timeline.
  - `output/{sequence_name}/storyboards/`: I frame `.jpg` estratti a 3 (IN / BEST / OUT) e uniti orizzontalmente.
  - `output/{sequence_name}/LLM_Export_Package/`: Il "caveau" dei dati. Contiene il Passaporto Semantico (`_stringout.json`), letto e arricchito atomicamente dalle Fasi A e B, più tutti i file prodotti dalle Fasi C, D, E.

### Moduli Python (Engine)

| File | Fase | Ruolo |
|---|---|---|
| `main.py` | Orchestratore | Entry point CLI. Esegue le Fasi A→E in sequenza. |
| `edl_parser.py` | Fase A | Ingest protocollo CMX3600. Estrae `sequence_name` e `clip_map`. |
| `pancake_editor.py` | Fase A | Motore semantico OpenCV + YOLOv8. Produce il `_stringout.json` con schema annidato. |
| `mlx_client.py` | Fase B | Gateway HTTP sincrono verso MLX Server (:8080). Arricchisce il JSON con i 4 macro-oggetti LLM. |
| `bgm_generator.py` | Fase C | Genera la colonna sonora (mock click track o MusicGen reale). |
| `audio_analyzer.py` | Fase C | Estrae i beat timestamps dal file audio. |
| `director.py` | Fase D | AI Director. Risolve i vincoli HITL e produce il `_final_edit.json`. |
| `edl_exporter.py` | Fase E | Export del Stringout grezzo in formato CMX3600 EDL. |
| `xml_exporter.py` | Fase E | Export del Director's Cut in formato FCP7 XML per Premiere/FCPX. |
| `api_server.py` | Runtime | FastAPI server (:8000). Espone `/api/system/profiler` per il Hardware Profiler UI. |

---

## 📁 SUPABASE Directory (`/supabase`)

Contiene le migrazioni SQL e la configurazione dell'infrastruttura di database.

> **📌 Stato attuale: DORMIENTE.** L'infrastruttura Supabase è presente nel
> repository ma non è attiva nella pipeline corrente. È mantenuta per la futura
> integrazione del layer dati (autenticazione utenti, profili, gestione progetti).
> Quando quella fase sarà attiva, `npm run dev:all` diventerà il comando di boot
> per l'intero stack compreso il layer dati.

- `migrations/`: Script SQL atomici incrementali.
- `seed.sql`: Dati di base per la simulazione e testing locale.

---

## 📁 .GEMINI Directory (`/.gemini` e `.agents`)

Il cervello del WOLF STACK. Contiene la Knowledge Base, i file di
configurazione dell'agente e i workflow in `.agents/workflows/`.

| File | Scopo |
|---|---|
| `PIPELINE.md` | Flusso operativo completo: avvio server, fasi A→E, struttura output, cheat sheet. |
| `FEATURES.md` | Specifiche funzionali: capacità engine e UI HITL. |
| `STRUCTURE.md` | Questo file. Topologia del repository. |
| `SOTA.md` | State of the Art: architettura tecnica implementata. |
| `SCHEMA.md` | Interfacce TypeScript e struttura JSON dei payload. |
| `WOLF_PROTOCOL.md` | Lifecycle di sviluppo e regole operative del Wolf Stack. |
| `TESTING.md` | Dottrina di testing ibrida locale. |
| `VISION.md` | Visione prodotto e obiettivi a lungo termine. |
| `EVOLUTION.md` | Roadmap e fasi di sviluppo. |
| `plans/` | Documenti di pianificazione e audit generati da AG. |
