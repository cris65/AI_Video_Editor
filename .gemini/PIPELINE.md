# 🐺 PIPELINE & ORCHESTRATOR

**Version:** v0.1.67 - 2026-05-24
**Scope:** Operational guide for booting the development environment and executing the full video analysis pipeline.

---

## 1. 🚀 Booting the Development Environment (The Trinity Stack)

The project requires **3 servers running simultaneously**. The master command is:

```bash
npm run wolf:dev
```

This command launches three parallel processes (via `concurrently`):

| Label | Underlying Command | Service | Port |
|---|---|---|---|
| `UI` | `npm run dev:ui` | Vite (React Frontend) | `:5173` |
| `API` | `npm run dev:api` | FastAPI (The Surveyor) | `:8000` |
| `LLM` | `npm run dev:llm` | MLX Server (Gemma 4 4-bit) | `:8080` |

> **📌 NOTE on `dev:all`:** This command boots Vite + Supabase Functions and is currently a dormant command inherited from the Wolf-Stack boilerplate. **It is not needed in the current pipeline**, but is intentionally maintained for future Supabase integration (user auth, profiles, project management). When that phase is active, `dev:all` will become the boot command for the entire stack, including the data layer.

**Verify that all 3 servers are active** before proceeding with any engine operations:
- UI: `http://localhost:5173`
- API: `http://localhost:8000/docs`
- LLM: `http://localhost:8080/v1/models`

---

## 2. 🎞️ Video Analysis Pipeline (The Full Flow)

### Prerequisites

Place input files in the `engine/input/` folder:
- `[sequence_name].edl` → the Ingest EDL file exported from Premiere/FCPX
- `[proxy_video].[mp4|mov|mxf|avi]` → the concatenated proxy video file

The engine automatically detects the first `.edl` and the first video found in the folder.

### Starting the Pipeline

```bash
cd engine
source venv/bin/activate
python main.py
```

The pipeline is **fully automatic** and does not require interactions during execution.

---

## 3. 🔄 The 5 Phases of the Pipeline

```
Input: engine/input/[sequence].edl + [proxy].mp4
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE A — EDL Analysis & Pancake Cut (YOLO + OpenCV)       │
│  Output: _stringout.json (Nested technical JSON)             │
│          _preview_stringout.mp4 (Assembly preview)          │
│          _preview_TRASH.mp4 (Discarded footage preview)     │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE B — Vision LLM Semantic Analysis (MLX Server :8080)  │
│  Model: mlx-community/gemma-4-e4b-it-4bit                   │
│  Output: _stringout.json enriched with the 5 macro-objects: │
│          cinematography, continuity, commercial, story       │
│  ⚠️ Auto-skipped if MLX server is offline                   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE C — BGM Generation & Beat Extraction                 │
│  Output: _bgm.wav (Mock click track or real MusicGen)       │
│          _audio_beats.json (Beat timestamps array)          │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE D — AI Director (HITL Constraint Resolution)         │
│  Additional Input: _hitl_data.json (UI user constraints)    │
│  Output: _final_edit.json (Internal timeline)               │
│          _gemma_recipe.json (Director's reasoning)          │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PHASE E — EDL & XML Export (Premiere Ready)                 │
│  Output: _Stringout_Cut.edl (Raw Stringout EDL)             │
│          _FinalCut.xml (Director's Cut for Premiere/FCPX)   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
Output: engine/output/[sequence]/LLM_Export_Package/
```

---

## 4. 📂 Output Structure Per Sequence

After execution, all files are organized into:

```
engine/output/[SEQUENCE_NAME]/
├── [SEQUENCE_NAME].edl               ← Original EDL (moved from input/)
├── [SEQUENCE_NAME].mp4               ← Proxy video (moved from input/)
├── [SEQUENCE_NAME]_preview_stringout.mp4
├── [SEQUENCE_NAME]_preview_TRASH.mp4
├── storyboards/
│   └── [CLIP_NAME]_[TC].jpg          ← 3-frame storyboard (IN / BEST / OUT)
└── LLM_Export_Package/
    ├── [SEQUENCE_NAME]_stringout.json      ← Full JSON (Phase 1 + 2)
    ├── [SEQUENCE_NAME]_hitl_data.json      ← HITL constraints from UI (written by frontend)
    ├── [SEQUENCE_NAME]_final_edit.json     ← Director's Cut timeline
    ├── [SEQUENCE_NAME]_gemma_recipe.json   ← Director's AI reasoning
    ├── [SEQUENCE_NAME]_bgm.wav             ← Generated music
    ├── [SEQUENCE_NAME]_audio_beats.json    ← Beat timestamps
    ├── [SEQUENCE_NAME]_Stringout_Cut.edl   ← Exported Stringout EDL
    └── [SEQUENCE_NAME]_FinalCut.xml        ← Exported XML for NLE
```

---

## 5. 🖱️ "Generate Director's Cut" Button in the UI

The button in the Pancake Dashboard **does not restart the full pipeline**. It **only invokes Phase D** (AI Director) in isolation via a FastAPI API call.

**When to use it:** after setting HITL constraints in the UI (IN/OUT/BM markers, KEEP/TRASH/BROLL overrides, target duration, style prompt) to regenerate the `_final_edit.json` without reprocessing the video.

**Do not use it if:** you need to reprocess the video from scratch (e.g., source files have changed). In that case, use `python main.py`.

---

## 6. 🐺 Quick Commands Cheat Sheet

```bash
# Start the entire development environment
npm run wolf:dev

# Run the complete pipeline (from a separate terminal with venv active)
cd engine && source venv/bin/activate && python main.py

# Validate TypeScript + ESLint (before every commit)
npm run wolf:audit

# Commit + Push (Full WOLF-FLOW)
# → Use the /wolf_flow command
```

---

## 7. 📐 Clip JSON Schema (Quick Reference)

The `_stringout.json` produced by the pipeline has this structure for each clip:

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
    "technical_flaws": "",
    "shot_size": "MS"
  },
  "continuity": {
    "action_description": "Subject sits down on the swing",
    "emotion_arc": "Calm, relaxed",
    "match_cut_potential": true,
    "match_cut_vector": "NONE"
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
