# 🎬 AI Video Editor — Pipeline Operativa & Flusso di Produzione

**Version:** v0.1.26 - 2026-05-19
**Scope:** Guida operativa per l'avvio dell'ambiente di sviluppo e l'esecuzione della pipeline di analisi video completa.

---

## 1. 🚀 Avvio Ambiente di Sviluppo (The Trinity Stack)

Il progetto richiede **3 server attivi contemporaneamente**. Il comando master è:

```bash
npm run wolf:dev
```

Questo comando lancia in parallelo (via `concurrently`) i tre processi:

| Label | Comando sottostante | Servizio | Porta |
|---|---|---|---|
| `UI` | `npm run dev:ui` | Vite (React Frontend) | `:5173` |
| `API` | `npm run dev:api` | FastAPI (The Surveyor) | `:8000` |
| `LLM` | `npm run dev:llm` | MLX Server (Gemma 4 4-bit) | `:8080` |

> **📌 NOTA su `dev:all`:** Questo comando avvia Vite + Supabase Functions ed è al momento un comando dormiente ereditato dal boilerplate Wolf-Stack. **Non serve nella pipeline attuale**, ma è intenzionalmente mantenuto per la futura integrazione di Supabase (autenticazione utenti, profili, gestione progetti). Quando quella fase sarà attiva, `dev:all` diventerà il comando di boot per l'intero stack compreso il layer dati.

**Verifica che tutti e 3 i server siano attivi** prima di procedere con qualsiasi operazione engine:
- UI: `http://localhost:5173`
- API: `http://localhost:8000/docs`
- LLM: `http://localhost:8080/v1/models`

---

## 2. 🎞️ Pipeline di Analisi Video (Il Flusso Completo)

### Prerequisiti

Posizionare i file di input nella cartella `engine/input/`:
- `[nome_sequenza].edl` → il file EDL di Ingest esportato da Premiere/FCPX
- `[proxy_video].[mp4|mov|mxf|avi]` → il file video proxy concatenato

L'engine rileva automaticamente il primo `.edl` e il primo video trovati nella cartella.

### Avvio Pipeline

```bash
cd engine
source venv/bin/activate
python main.py
```

La pipeline è **completamente automatica** e non richiede interazioni durante l'esecuzione.

---

## 3. 🔄 Le 5 Fasi della Pipeline

```
Input: engine/input/[sequenza].edl + [proxy].mp4
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE A — Analisi EDL & Pancake Cut (YOLO + OpenCV)         │
│  Output: _stringout.json (JSON tecnico annidato)            │
│          _preview_stringout.mp4 (anteprima montaggio)       │
│          _preview_TRASH.mp4 (anteprima scarti)              │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE B — Analisi Semantica Vision (MLX Server :8080)       │
│  Modello: mlx-community/gemma-4-e4b-it-4bit                 │
│  Output: _stringout.json arricchito con i 4 macro-oggetti:  │
│          cinematography, continuity, commercial, story       │
│  ⚠️ Skip automatico se il server MLX è offline              │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE C — Generazione BGM & Beat Extraction                 │
│  Output: _bgm.wav (click track mock o MusicGen reale)       │
│          _audio_beats.json (array di timestamp beat)        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE D — AI Director (Risoluzione Vincoli HITL)            │
│  Input aggiuntivo: _hitl_data.json (vincoli UI utente)      │
│  Output: _final_edit.json (timeline Director's Cut)         │
│          _gemma_recipe.json (reasoning del Director)        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  FASE E — Export EDL & XML (Premiere Ready)                 │
│  Output: _Stringout_Cut.edl (Stringout grezzo)              │
│          _FinalCut.xml (Director's Cut per Premiere/FCPX)   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
Output: engine/output/[sequenza]/LLM_Export_Package/
```

---

## 4. 📂 Struttura Output per Sequenza

Dopo l'esecuzione, tutti i file vengono organizzati in:

```
engine/output/[SEQUENCE_NAME]/
├── [SEQUENCE_NAME].edl               ← EDL originale (spostato da input/)
├── [SEQUENCE_NAME].mp4               ← Video proxy (spostato da input/)
├── [SEQUENCE_NAME]_preview_stringout.mp4
├── [SEQUENCE_NAME]_preview_TRASH.mp4
├── storyboards/
│   └── [CLIP_NAME]_[TC].jpg          ← Storyboard a 3 frame (IN / BEST / OUT)
└── LLM_Export_Package/
    ├── [SEQUENCE_NAME]_stringout.json      ← JSON completo (Phase 1 + 2)
    ├── [SEQUENCE_NAME]_hitl_data.json      ← Vincoli HITL dalla UI (scritto dal frontend)
    ├── [SEQUENCE_NAME]_final_edit.json     ← Director's Cut timeline
    ├── [SEQUENCE_NAME]_gemma_recipe.json   ← Reasoning AI del Director
    ├── [SEQUENCE_NAME]_bgm.wav             ← Musica generata
    ├── [SEQUENCE_NAME]_audio_beats.json    ← Beat timestamps
    ├── [SEQUENCE_NAME]_Stringout_Cut.edl   ← Export EDL Stringout
    └── [SEQUENCE_NAME]_FinalCut.xml        ← Export XML per NLE
```

---

## 5. 🖱️ Bottone "Generate Director's Cut" nella UI

Il bottone nella Pancake Dashboard **non rilancia la pipeline completa**. Invoca **esclusivamente la Fase D** (AI Director) in isolamento tramite una chiamata all'API FastAPI.

**Quando usarlo:** dopo aver impostato i vincoli HITL nella UI (marker IN/OUT/BM, override KEEP/TRASH/BROLL, target duration, style prompt) per rigenerare il `_final_edit.json` senza rielaborare il video.

**Non usarlo se:** devi rielaborare il video da zero (es. hai cambiato i file sorgente). In quel caso serve `python main.py`.

---

## 6. 🐺 Cheat Sheet Comandi Rapidi

```bash
# Avvia tutto l'ambiente di sviluppo
npm run wolf:dev

# Esegui la pipeline completa (da terminale separato, col venv attivo)
cd engine && source venv/bin/activate && python main.py

# Valida TypeScript + ESLint (prima di ogni commit)
npm run wolf:audit

# Commit + Push (WOLF-FLOW completo)
# → Usa il comando /wolf_flow
```

---

## 7. 📐 Schema JSON Clip (Riferimento Rapido)

Il `_stringout.json` prodotto dalla pipeline ha questa struttura per ogni clip:

```json
{
  "start": 0.0,
  "end": 3.4,
  "tag": "MAIN_A",
  "best_moment": 1.2,
  "storyboard_path": "...",
  "is_usable": true,

  "technical_quality": {
    "blur_score": 42.7,
    "is_soft_focus": false,
    "motion_intensity": 1.4,
    "camera_direction": "PAN_LEFT",
    "cinematic_palette": ["#1a2b3c", "#e4d5c1"]
  },
  "spatial_configuration": {
    "safe_zone_tag": "MAIN_A",
    "focus_area": null
  },
  "yolo_omniscient_data": {
    "total_objects": 2,
    "detections": []
  },

  "cinematography": {
    "scene_description": "Two people sitting on a swing...",
    "lighting_type": "NATURAL",
    "visual_quality_score": 8,
    "technical_flaws": ""
  },
  "continuity": {
    "action_description": "Subject sits down on the swing",
    "emotion_arc": "Calm, relaxed",
    "match_cut_potential": true
  },
  "commercial": {
    "product_visibility": "LOW",
    "brand_safe": true,
    "reaction_type": "JOY"
  },
  "story": {
    "narrative_role": "ESTABLISHING",
    "recommended_position": "OPENING",
    "director_note": "Good opening shot, wide framing"
  }
}
```
