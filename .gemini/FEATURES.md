# 🐺 Functional Specifications (FEATURES.md)

**Version:** v0.1.36 - 2026-05-20

> [!NOTE]
> This document describes the **Features** — i.e., the functional value exposed to the end user, both as engine capabilities and UI interfaces. It does not describe how the data is structured (→ `STRUCTURE.md`) nor the temporal execution flow (→ `PIPELINE.md`).

## Core Capabilities (Stringout AI Engine)

### 1. Single Track Cut (Stringout Workflow)
The system extrapolates a single optimized timeline to maximize offline post-production speed:
- **Stringout Track:** Gathers all usable fragments of the footage, classifying them semantically (MAIN_A, B-ROLL, EDGE_DANGER).
- **Trash Reel:** A parallel timeline invisible to the final EDL but rendered in `.mp4` (preview_TRASH) for visual Quality Control of what the algorithm discarded.

### 2. Physical Filters and Saliency (Action Peak)
- **Center-Weighted Focus:** The Laplacian filter calculates blur exclusively on the central 50% of the frame, tolerating fast lenses and strong bokeh effects at the sides.
- **Dual Threshold Soft Focus:** Strictly selects frames: `TRASH_BLUR` below `10.0`, while the "gray zone" (10-25) is allowed in the timeline but tagged with the `_SOFT` suffix (e.g., `MAIN_A_SOFT`).
- **MOTION_THRESHOLD:** Discards extreme camera movements or shaking (threshold `40.0`).
- **Action Peak (Best Moment):** Real-time tracking of sharpness peaks. The engine stores the temporary key `_max_lap` and certifies the `best_moment` (the exact millisecond of the perfect frame) in the clip metadata for subsequent LLMs.
- **Boundary Crossing Split:** Proxy cuts that cross the boundary of the original clip are dynamically split during EDL export to prevent "Media Offline" errors or zebra patterns in Adobe Premiere.
- **Chromatic DNA (Cinematic Palette):** Using K-Means Clustering via OpenCV, the algorithm extracts the 5 dominant HEX colors of each clip on the fly. Sampling merges 3 matrices (IN, OUT, and BEST) for perfect color continuity without weighing on CPU and RAM performance (Zero-Seeking).
- **Optical Flow (Motion Scoring):** Ultra-lightweight `Farneback` vector calculation at 160x90 for each block. Returns `motion_intensity` (float) and `camera_direction` (PAN_LEFT, PAN_RIGHT, TILT_UP, TILT_DOWN, STATIC) in the nested `technical_quality` macro-object of `stringout.json`.
- **Semantic Storyboard & Smart Naming:** On-the-fly extraction of three frames (IN, BEST, OUT) at 480x270, merged horizontally. The extracted frames are no longer anonymous but intercept the REAL native name (`C4369`) from the EDL map and the safe timecode calculated by the engine, generating `{clip_name}_{tc_safe}.jpg`.

### 3. PHASE B - Vision LLM Inference (MLX Server)
The Engine is no longer "blind". Integrating the local MLX ecosystem via an OpenAI-compatible standard (`http://127.0.0.1:8080/v1/chat/completions`), the system analyzes the Stringout timeline:
- Converting the Semantic Storyboard to `base64` on the fly and sending the technical YOLO context (number of subjects detected in the scene).
- Injecting a specific Context Prompt on Chronological Continuity and commercial analysis.
- Receiving a structured JSON payload from Gemma 4 nested in **5 macro-objects** that enriches each clip:
  - `cinematography` → `scene_description`, `lighting_type`, `visual_quality_score`, `technical_flaws`, `shot_size`
  - `semantic_analysis` → `subject_action`, `gaze_direction`, `emotional_tone`, `narrative_energy_score`, `subject_screen_position`, `subject_count`, `setting_location`, `key_props`
  - `continuity` → `action_description`, `emotion_arc`, `match_cut_potential`, `match_cut_vector`
  - `commercial` → `product_visibility`, `brand_safe`, `reaction_type`
  - `story` → `narrative_role`, `recommended_position`, `director_note`
- Saving the validated result in the JSON dict through tolerant and autonomous logic (retry x3, regex cleaning, explicit structured fallback for each sub-key, progressive atomic JSON saving post-clip).
- Morphological bypass (Soft Skip) for automatic ingest if the MLX server is not started.
- **Native Apple Silicon Integration**: The Python environment (`engine/requirements.txt`) is natively equipped with the `mlx` and `mlx-lm` frameworks for direct LLM inference on Unified Memory, without depending on external servers.

### 4. Flexible Drop-Zone Automation
- **Agnostic Ingest:** Extended support for `.mp4`, `.mov`, `.mxf`, `.avi`, `.mkv`.
- **Auto-Cleanup:** Once the EDL file is issued (`_Stringout_Cut.edl`), original files in the drop zone are cleaned up and moved directly to the output folder of their respective sequence to avoid residue.
- **Direct Export:** Removed manual gate [Y/N]; the engine processes proxies, calculates discards, and generates CMX3600 in total autonomy at 50fps.

### 5. PHASE D - AI Director (HITL Constraint Resolution)
The Director is the module that closes the loop between AI analysis and human decisions:
- **LLM Editing Recipe:** Gemma 4 receives the list of usable clips (with Scores, Scene, Action Strategy) and produces a JSON `editing_recipe` defining the narrative order and musical beats assigned to each clip.
- **Beat-Sync Math:** The LLM recipe is applied to a mathematical grid of beat timestamps (`_audio_beats.json`). Each clip is truncated/extended to synchronize perfectly with the musical rhythm.
- **Pillar & Filler System:** Clips with user-defined BM (Best Moment) markers become PILLARS anchored to the nearest beat. Clips without constraints become FILLERS, ordered by `visual_quality_score` as a tie-breaker.
- **Safety Net Auto-Fill:** If the LLM recipe is too short compared to the target duration, the Director autonomously triggers a 4-beat heuristic fallback to fill the remaining gaps.
- **Dual-Track Export:** Produces `_final_edit.json` (internal timeline) + `_FinalCut.xml` (FCP7 XML ready for Premiere/FCPX) + `_gemma_recipe.json` (Director's AI reasoning for debugging and transparency).

## Frontend (React HITL Dashboard)

### 1. NLE-Style Split-View
- **Interactive Timeline**: Timebar synchronized to the millisecond, chromatically rendering valid (Green MAIN, Blue B-ROLL) and discarded (Red) segments. Supports dynamic filters (ALL/VALID/BROLL/TRASH) that leave physical empty spaces ("black holes") to respect timing.
- **Auto-Scrolling Vertical Playlist**: The side inspector autonomously scrolls and keeps the active clip in focus on the video player, ensuring an immersive UX.
- **Multi-Anchor System (BM/IN/OUT)**: Human editors can apply multiple temporal constraints (markers) on the same clip by pressing `M`, `I`, `O`. Surgically removable and frame-accurate via `X`, or displayed as an interactive list directly in the ClipCard.
- **Non-Destructive Forced Overrides**: `K` (Keep), `T` (Trash), and `B` (B-Roll) keys allow the human to override the AI, forcing the clip state. Changes are instantly visualized with glows and badges (e.g., `FORCED B-ROLL`) and saved in parallel on a sidecar JSON.
- **Professional Keyboard Shortcuts**: Standard integration for editing. Space for Play/Pause, horizontal arrows for scrubbing (10 frames base, +Shift for 1 frame, +Alt for 30 frames), vertical arrows to instantly "jump" to next/previous cuts calculated by the Engine. Info popup "on-click" for all timelines.
- **Anti-Lag Engine (60fps)**: Time data-binding completely detached from React State and offloaded to a direct `requestAnimationFrame` on the DOM. React re-renders are blocked via `React.memo` except when the video passes a real cut of the virtual EDL.
- **Director Settings Panel & Advanced Modal**: The user can access an advanced panel `🎨 AI Director Creative Settings` (via createPortal to bypass z-index limits) to set *Target Product*, *Expected Subjects*, *Focus Area*, and NLP parameters, saved inside the `DirectorConfig`.
- **Dynamic Hardware Profiler & Trinity Startup**: The entire ecosystem (React + Python) boots in parallel with a single command (`npm run wolf:dev`). The integrated hardware widget no longer uses mocked data but reads the profile from the backend (`/api/system/profiler`), which extracts the exact chip model and Unified RAM by querying the macOS kernel (`sysctl`) natively. ETA and inference batches (Chunks) are calculated mathematically in real-time.
- **Pannello di Telemetria delle Performance**: Visualizza sopra il Video Player i dati dell'ultima elaborazione eseguita dalla pipeline Python (inclusi modello VLM compatto, frame analizzati e durata formattata in minuti/secondi) leggendo dinamicamente il file `performance_history.json`.
