# Rhythm Energy & Audio Marker Payload Injection (Scouting Report)

## 1. Goal
Update the payload generation in `engine/director.py` to expose audio "Energy" values and 'AUDIO' HITL markers to the AI Director LLM. The update must be strictly backward compatible with older `_audio_beats.json` structures (lists of floats) and avoid any mutation of the `system_prompt`.

## 2. Surgical Modifications in `engine/director.py`

### Modification 1: `AUDIO` Marker Interception
**Location:** `generate_final_cut()`, inside the `hitl_constraints` loop (around line 283).
**Action:** Add an `elif` block to catch constraints of `type == 'AUDIO'` and flag the clip with `_has_audio_marker`.

### Modification 2: `MUST INCLUDE (AUDIO SYNC)` Role Mapping
**Location:** `call_director_llm()`, inside the `usable_clips` stringification loop (around line 62).
**Action:** Replace the binary `PILLAR` / `FILLER` check with a ternary check that prioritizes `AUDIO SYNC`.

### Modification 3: Rhythm Context Formatting (Backward Compatible)
**Location:** `call_director_llm()`, where `audio_context` is constructed (around line 103).
**Action:** Iterate through `audio_beats`. If the beat is a float (legacy), assign `energy = 0.5`. If it's a dict (new structure), safely extract `time` and `energy` (defaulting to `0.5` if missing).
