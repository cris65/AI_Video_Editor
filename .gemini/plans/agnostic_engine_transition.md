# Agnostic Engine Architecture Transition (Scouting Report)

## 1. Goal
Transition the `engine/director.py` AI Director prompt from a hardcoded Italian template into a 100% agnostic, dynamically injected English system prompt. The stylistic and rhythmic logic will be entirely driven by the HITL frontend via `director_config`.

## 2. Phase 1: UI Upgrade (React Frontend)

**Target Files:** 
- `src/hooks/usePancakeData.ts`
- `src/components/dashboard/AdvancedDirectorModal.tsx`

**TypeScript Updates (`usePancakeData.ts`):**
Extend the `DirectorConfig` interface with strict typing for the new parameters:
```typescript
export interface DirectorConfig {
  // ... existing fields
  rhythmic_strictness?: number; // 0-100
  energy_threshold?: number; // 0.0 - 1.0
  audio_marker_priority?: 'HARD_CUT' | 'BROLL_BRIDGE' | 'DYNAMIC_PRIORITY';
}
```

**React UI Restructure (`AdvancedDirectorModal.tsx`):**
- Introduce a local state for `activeTab`: `'visual'` vs `'audio'`.
- **Tab 1 (Visual & Narrative):** Contains the existing Vision Targets (Target Product, Expected Subjects, Secondary Elements), NLP Directives (Director's Vision, Ignore List), and Spatial Tracking.
- **Tab 2 (Audio & Rhythm):** Contains the 3 new controls:
  - `rhythmic_strictness`: Slider (0-100) with a numeric display.
  - `energy_threshold`: Slider (0.0 to 1.0, step 0.1) with a numeric display.
  - `audio_marker_priority`: Select Dropdown (`HARD_CUT`, `BROLL_BRIDGE`, `DYNAMIC_PRIORITY`).

## 3. Phase 2: Data Bridge (JSON Schema & Extraction)

**Target File:** `engine/director.py` (`generate_final_cut`)

Extract the new parameters from `director_config` with intelligent fallbacks (Backward Compatibility constraint):
```python
# Safe extraction with defaults for older projects
rhythmic_strictness = director_config.get("rhythmic_strictness", 50)
energy_threshold = director_config.get("energy_threshold", 0.4)
audio_marker_priority = director_config.get("audio_marker_priority", "DYNAMIC_PRIORITY")
ignore_list = director_config.get("ignore_list", "None")
```
Update the `call_director_llm` function signature to accept these 4 new parameters.

## 4. Phase 3: Dynamic System Prompt (Python Template)

**Target File:** `engine/director.py` (`call_director_llm`)

Rewrite the `system_prompt` completely in **English** (fulfilling the Agnostic Engine and English Only code rules) as an f-string:

```python
    system_prompt = (
        locked_constraint_text
        + "You are a Master Video Editor and an AI Video Director. Your task is to create an 'Editing Recipe' for a video montage.\n"
        + audio_directive
        + "STRICT RULES:\n"
        f"1. Target duration is approximately {target_duration} seconds (around {total_beats} musical beats).\n"
        f"2. [USER STYLE DIRECTIVE]: {style_prompt}\n"
        f"3. [NEGATIVE CONSTRAINTS]: {ignore_list}\n"
        f"4. [RHYTHMIC STRICTNESS]: {rhythmic_strictness}% (At 100%, cut surgically only on musical beats. At 0%, prioritize visual and narrative continuity over the audio grid).\n"
        f"5. [MINIMUM ENERGY THRESHOLD]: {energy_threshold} (Discard or deprioritize any beats in the audio context that fall below this energy threshold).\n"
        f"6. [AUDIO MARKER PRIORITIZATION]: {audio_marker_priority}\n"
        "7. You MUST include all clips marked as 'MUST INCLUDE (PILLAR)' and 'MUST INCLUDE (AUDIO SYNC)'. Place them at key moments.\n"
        "8. Use the 'Narrative Energy' and 'Emotional Tone' metadata to build the sequence pacing and logical choices.\n"
        "9. ACTION CONTINUITY: Do not just keep the chronological order of IDs. SHUFFLE the order to make narrative sense and create a compelling arc.\n"
        "10. SCREEN DIRECTION: Pay close attention to direction. Ensure 'Gaze' and subject movements create visual fluidity.\n"
        "11. SCORE AS TIEBREAKER: Use the 'Score' field ONLY as a tiebreaker between similar clips.\n"
        f"12. For each selected clip, decide how many 'beats' it should last (e.g. 2, 4, 8). The total sum of beats must approach {total_beats}.\n"
        "13. RESPOND EXCLUSIVELY WITH A JSON OBJECT. No explanations, no text before or after. "
        "Exact required format:\n"
        '{\n'
        '  "director_vision": "2-line explanation of the narrative logic used for this sequence",\n'
        '  "recipe": [\n'
        '    {"clip_id": "0.0", "beats": 4, "reasoning": "Reasoning based on Narrative Energy or Gaze..."},\n'
        '    {"clip_id": "15.3", "beats": 2, "reasoning": "Reasoning for the transition..."}\n'
        '  ]\n'
        '}\n'
    )
```
