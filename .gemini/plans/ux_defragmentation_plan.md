# UX Defragmentation & Agnostic Time Architecture (Implementation Plan)

## 1. Goal
Execute a N.A.I.L.E. architectural refactoring by centralizing all technical controls into the `AdvancedDirectorModal`, converting the lateral `DirectorSettingsPanel` into a visual read-only recap, and introducing an agnostic time architecture via a new `duration_mode` flag (STRICT vs ORGANIC) coupled with Semantic Audio Anchors.

## 2. Phase 1: UX Defragmentation (React Frontend)

**Target 1: `src/components/dashboard/AdvancedDirectorModal.tsx`**
- Upgrade the local tab state to support 3 views: `visual`, `audio`, and `system`.
- **Tab 3 (Engine & System):** Relocate all technical configuration fields from the side panel to this new tab. This includes:
  - AI Brain Selection (`ai_model`)
  - Director Seed (`seed`)
  - Target Resolution (`export_resolution`)
  - Target Duration (`target_duration`)
  - Analysis Rate (`analysis_fps`)

**Target 2: `src/components/dashboard/DirectorSettingsPanel.tsx`**
- Eradicate all input fields and dropdowns to strictly enforce the DRY Axiom (Law 11) and prevent state fragmentation.
- Transform the component into a **Visual Recap** of the active `DirectorConfig` (e.g., displaying the active model, current target duration, and duration mode as read-only badges).
- Retain only actionable components: The hardware benchmark pop-up (if applicable), the "Open Creative Settings" modal trigger, and the "Regenerate Cut" button.

## 3. Phase 2: Agnostic Time & Semantic Data (TypeScript)

**Target: `src/hooks/usePancakeData.ts`**
- Extend the `DirectorConfig` interface with strict typing:
  ```typescript
  export interface DirectorConfig {
    // ... existing fields
    duration_mode?: 'STRICT' | 'ORGANIC';
  }
  ```

**Target: `src/components/dashboard/AdvancedDirectorModal.tsx`**
- Alongside the relocated "Target Duration" field in the Engine & System tab, implement a new `duration_mode` control (Toggle/Dropdown).
- Link it to `localConfig.duration_mode` so it seamlessly persists into `_hitl_data.json`.

## 4. Phase 3: The Director Prompt (Python Logic)

**Target: `engine/director.py`**
- In `generate_final_cut`, extract the new parameter with a backward-compatible fallback:
  ```python
  duration_mode = director_config.get("duration_mode", "ORGANIC")
  ```
- Map this state into the `call_director_llm` function signature.
- **Dynamic Prompt Injection:** Construct the conditional Duration Directive and update the Audio Marker semantics in the f-string:
  ```python
  duration_directive = ""
  if duration_mode == "STRICT":
      duration_directive = f"DURATION DIRECTIVE: You MUST hit the target duration exactly. Calculate the math of the audio beats precisely to stop the edit at {target_duration} seconds. No exceptions."
  else:
      duration_directive = f"DURATION DIRECTIVE: Target duration is {target_duration} seconds (+/- 10%). Use this as a guideline, but allow the edit to 'breathe' and stretch or compress slightly to end on a natural musical climax or drop."
  ```
- **Semantic Anchors Update:** Modify the Audio Sync rule in the prompt:
  ```python
  f"7. SEMANTIC ANCHORS: You MUST include clips marked as 'MUST INCLUDE (AUDIO SYNC)'. The audio markers (♪) provided in the timeline are NOT just physical cut points; they are 'Emotional Anchors'. You must make the narrative action or visual impact culminate exactly on these anchors.\n"
  ```
