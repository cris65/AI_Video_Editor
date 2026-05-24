# 🐺 Project Evolution & Roadmap

**Version:** v0.1.67 - 2026-05-24

> [!NOTE]
> This document tracks the product direction and the current phase of development for the AI Video Editor. It keeps the development progress strictly aligned with the Offline-First architecture (Python/MLX/YOLO) and the HITL interface (React).

## 🎯 Global Goal

Create a Local-First and automated video editing ecosystem that reduces pre-selection time via AI inference (YOLO + MLX Vision) while maintaining complete agnosticism (EDL CMX3600) toward Adobe Premiere Pro.

---

## 🟢 PHASE 1: Core AI Engine & Ingest Pipeline (COMPLETED)

The "heavy" pipeline (Speed 1) that runs only once to map the video.

**PHASE A: Spatial & Technical Analysis (Pancake Cut / OpenCV + YOLO)**
- [x] Stringout generation and Proxy Asset (timecoded frame extraction).
- [x] Deterministic slicing based on original FPS and target `analysis_fps`.
- [x] Dynamic Safe Zone detection via YOLO.
- [x] Sharpness extraction (Laplacian) and Motion Flow.
- [x] Nested payload generation: `technical_quality`, `spatial_configuration`, `yolo_omniscient_data`.

**PHASE A2: Audio Analysis (BGM & Transients)**
- [x] Implementation of Python script (`bgm_generator.py`) to generate tracks.
- [x] Injection of beat timecodes and waveform in the base JSON to allow future "Cut on Beat".
- [x] Audio Rhythm Engine APIs (`audio_analyzer.py` + FastAPI) for manual BPM/transient extraction.

**PHASE B: Semantic Analysis (MLX Vision + Gemma 4)**
- [x] Development of `mlx_client.py` with structured prompt (Rule of Six).
- [x] Synchronous-sequential calls for VRAM protection.
- [x] Incremental injection of macro-objects in the JSON: `cinematography`, `continuity`, `commercial`, `story`.
- [x] Atomic JSON saving (`_stringout.json`).

---

## 🟡 PHASE 2: Frontend HITL & Orchestration (COMPLETED)

**PHASE C: The Human Interface (React UI)**
- [x] HITL Split-View Dashboard with Synchronized Video Player and Interactive Timeline.
- [x] Anti-Lag 60fps synchronization with temporal state decoupling.
- [x] Manual overrides (KEEP/TRASH/BROLL, IN/OUT/BM) persisted in `_hitl_data.json`.
- [x] Advanced Settings Panel: Safe Zone margins, Target Duration, Expected Subjects.
- [x] Drag & Drop (dnd-kit) on the horizontal Director's Cut timeline.

**PHASE D: The Wiring and The "Director" (API Gateway)**
- [x] FastAPI endpoint `POST /api/orchestrate`.
- [x] Hybrid payload validated through `Pydantic` strict typing.
- [x] Propagation of the `Seed` for stochastic determinism.
- [x] Isolated execution (Speed 2) that regenerates only the text and JSONs without recalculating the video, returning `_final_edit.json`.

---

## 🔴 PHASE 3: Export & Native Integration (Endgame) - NEXT

- [ ] Support for "Pinned Anchors": Gemma 4 respects manual reordering (Forced Order) and Global START/END coming from the HITL.
- [ ] Detection of advanced video anomalies (micro-motion, drop frames).
- [ ] Multi-track XML export for NLE (Premiere Pro / DaVinci / FCPX) (Phase E).
- [ ] Refactoring the React Frontend into an Adobe CEP Extension (Manifest XML, ExtendScript) for automatic active timeline synchronization.
- [ ] "One-Click" Installer (macOS .pkg or PyInstaller) to make the MLX server invisible and frictionless.
- [ ] Offline local Audio-Generative Engine (MusicGen / Stable Audio).

---

## 🟣 PHASE 4: Conversational Workflow (The Rationale Bridge)

- [ ] **The LLM Rationale & Conversational Editing:** Transition from one-way JSON generation to a conversational interface. The VLM will generate a 'Chain of Thought' rationale before the JSON output, explaining its editing school choices and match-cut logic. The UI will expose this rationale and allow the HITL to prompt verbal adjustments (e.g., "make the cuts more aggressive") for dynamic fine-tuning.

---

## 🌌 EPIC: Versioning, Cloud Persistence & Semantic Memory

**Current Problem:** The system overwrites the `_final_edit.json` file on each regeneration. Although the Seed guarantees reproducibility for the same prompt, editing the prompt (e.g., adding a new directive) alters the LLM context, making it impossible to return to a previous edit unless the exact UI state is remembered.
**Goal:** Transform the workflow into a non-destructive process, with cloud saving and AI semantic memory.

### Milestone 1: Local Versioning (File System)
- **Backend Logic:** Auto-increment logic that generates `_final_edit_v1.json`, `_final_edit_v2.json`, associating each file with a log of the Seed and DirectorConfig.
- **Frontend Logic:** "History" dropdown to instantly rehydrate the UI state (Seed, Constraints, Prompt).

### Milestone 2: The Supabase Awakening (Cloud Persistence)
- **Data Modeling:** Creation of Postgres tables: `users`, `projects`, `media_assets`, and `edit_versions`.
- **JSONB Storage:** Complex payloads and "Recipes" saved in JSONB columns.
- **Sync:** The frontend saves the hybrid state to Supabase, and FastAPI reads the constraints from the DB.

### Milestone 3: Vectorized RAG (The Omniscient Director)
- **pgvector Integration:** Enable `pgvector` extension on Supabase.
- **Embedding Pipeline:** Text prompts, bypassed flaws, and "Recipe" rationales converted to vectors.
- **Semantic Search:** Conversational search bar for historical retrieval.

### Milestone 4: Production Readiness (i18n & Refactoring)
- **Localization:** Integration of `react-i18next` to make the UI multi-language without introducing regressions.
- **UI Cleanup:** High componentization and decoupling of logic from the presentation layer.

---

## 🦅 THE N.A.I.L.E. VISION (Next-Gen Architectural Roadmap)

> [!IMPORTANT]
> The platform is officially named **N.A.I.L.E.** (Neural AI Linear Editing), playing on the classic NLE acronym while emphasizing the Human-in-the-Loop AI core.

- **Universal Timeline Component:** The `<InteractiveTimeline />` must become a purely data-driven, universal component used seamlessly across both the Stringout and Director's Cut phases.
- **YOLO & Mobile Safe Areas:** Transition from static center-crops to dynamic OpenCV/YOLO tracking. The AI will output dynamic Pan & Scan / Safe Area coordinates that follow the subject's center of mass.
- **After Effects (AE) LLM Scripting:** Instead of complex UI integrations, we will leverage LLMs to write raw `.jsx` (ExtendScript) or After Effects Expressions to generate dynamic motion graphics from timeline data.
- **Adobe UXP Transition:** Future Adobe panel integrations must target the modern UXP (React-based) stack, strictly avoiding legacy CEP architecture.
- **Multi-Track & Compositing:** Evolve the LLM prompt to handle V1, V2, V3 logic (Picture-in-Picture, split screens, B-Roll overlays).
- **DevOps & QA Agents:** Dedicate a specific AI Agent to generate and maintain Playwright E2E tests to prevent regressions as the UI scales.