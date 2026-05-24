import os
import json
import json_repair
import re
import time
import datetime

try:
    from mlx_lm import load, generate
    try:
        from mlx_lm.sample_utils import make_sampler
        _make_sampler = make_sampler
    except ImportError:
        import mlx.core as _mx
        def _make_sampler(temp: float = 0.3, **_kw):
            if temp == 0.0:
                return lambda logits: _mx.argmax(logits, axis=-1)
            return lambda logits: _mx.random.categorical(logits * (1.0 / temp))
    MLX_LM_AVAILABLE = True
except ImportError:
    MLX_LM_AVAILABLE = False
    def _make_sampler(temp: float = 0.3, **_kw):
        raise RuntimeError("mlx_lm not available — sampler cannot be constructed")

def check_director_llm_available():
    """
    Verifica che la libreria nativa mlx_lm sia installata.
    """
    return MLX_LM_AVAILABLE

def load_json(path):
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return {}

def find_beat_index(time_sec, beats):
    if not beats:
        return 0
    return min(range(len(beats)), key=lambda i: abs(beats[i] - time_sec))

def clean_json_response(raw_text):
    try:
        return json_repair.loads(raw_text)
    except Exception:
        pass
    json_pattern = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_text, re.DOTALL)
    if json_pattern:
        try:
            return json_repair.loads(json_pattern.group(1))
        except Exception:
            pass
    root_pattern = re.search(r'(\{.*?\})', raw_text, re.DOTALL)
    if root_pattern:
        try:
            return json_repair.loads(root_pattern.group(1))
        except Exception:
            pass
    return None

def call_director_llm(usable_clips, target_duration, total_beats, style_prompt, rhythmic_strictness=50, energy_threshold=0.4, audio_marker_priority="DYNAMIC_PRIORITY", duration_mode="ORGANIC", ignore_list="None", seed: int = -1, locked_clips=None, llm_model_id="meta-llama/Meta-Llama-3-70B-Instruct", audio_bpm=None, audio_beats=None):
    if not check_director_llm_available():
        print("⚠️  [Director] Libreria mlx_lm non disponibile. Fallback euristico.")
        return None

    print(f"⏳ Downloading / Loading {llm_model_id} (Director's Brain)...")
    try:
        loaded = load(llm_model_id)
        model = loaded[0]
        processor = loaded[1]
        print("✅ Director Model loaded successfully!")
    except Exception as e:
        print(f"❌ Impossibile caricare il modello LLM: {e}")
        return None

    clip_list_str = []
    for c in usable_clips:
        if c.get('_has_audio_marker'):
            role = "MUST INCLUDE (AUDIO SYNC)"
        elif c.get('_has_bm'):
            role = "MUST INCLUDE (PILLAR)"
        else:
            role = "OPTIONAL (FILLER)"
            
        if c.get('_is_global_in'):
            role += " - ABSOLUTE FIRST CLIP OF SEQUENCE"
        if c.get('_is_global_out'):
            role += " - ABSOLUTE LAST CLIP OF SEQUENCE"
            
        action = c.get('continuity', {}).get('action_description', 'Azione')
        scene = c.get('cinematography', {}).get('scene_description', 'Scena')
        score = c.get('cinematography', {}).get('visual_quality_score', 5)
        
        # Estrazione Semantic e Commercial Data come richiesto (Iniezione Semantica)
        semantic = c.get('semantic_analysis', {})
        subject_action = semantic.get('subject_action', 'Sconosciuto')
        gaze_direction = semantic.get('gaze_direction', 'Sconosciuto')
        emotional_tone = semantic.get('emotional_tone', 'Neutro')
        narrative_energy = semantic.get('narrative_energy_score', 5)
        
        yoloe_tags = c.get('yoloe_semantics')
        yoloe_str = f" | YOLOE Tags: {yoloe_tags}" if yoloe_tags else ""

        clip_list_str.append(
            f"- ID: {c['start']} | Role: {role} | Score: {score}/10 | Scene: {scene} | Action: {action} "
            f"| Subject Action: {subject_action} | Gaze: {gaze_direction} | Emotion: {emotional_tone} | Energy: {narrative_energy}/10{yoloe_str}"
        )
        
    clips_text = "\n".join(clip_list_str)
    
    locked_constraint_text = ""
    if locked_clips:
        locked_ids = ", ".join([f'"{c["start"]}"' for c in locked_clips])
        locked_constraint_text = (
            "CRITICAL CONSTRAINT — IMMOVABLE CLIPS (Human Director Override):\n"
            f"The following clip IDs are LOCKED by the human director: [{locked_ids}].\n"
            "You CANNOT move them, change their IN/OUT points, or alter their timeline position.\n"
            "They are IMMOVABLE WALLS. Build the sequence by filling the GAPS around them.\n\n"
        )

    audio_directive = ""
    audio_context = ""
    if audio_beats and audio_bpm:
        audio_directive = (
            "SOUNDTRACK DETECTED: You must strictly align clip boundaries and durations to the provided audio beat timestamps. "
            "Use the rhythm grid to determine when to cut.\n"
        )
        
        formatted_beats = []
        for b in audio_beats:
            if isinstance(b, dict):
                if b.get("energy", 0.5) >= energy_threshold:
                    formatted_beats.append({"time": b.get("time", 0.0), "energy": b.get("energy", 0.5)})
            else:
                formatted_beats.append({"time": float(b), "energy": 0.5})
                
        beats_grid_str = json.dumps(formatted_beats)
        
        audio_context = f"\n\n[RHYTHM CONTEXT]\nBPM: {audio_bpm}\nBeats Grid: {beats_grid_str}\n"

    duration_directive = ""
    if duration_mode == "STRICT":
        duration_directive = f"DURATION DIRECTIVE: You MUST hit the target duration exactly. Calculate the math of the audio beats precisely to stop the edit at {target_duration} seconds. No exceptions."
    else:
        duration_directive = f"DURATION DIRECTIVE: Target duration is {target_duration} seconds (+/- 10%). Use this as a guideline, but allow the edit to 'breathe' and stretch or compress slightly to end on a natural musical climax or drop."

    system_prompt = (
        locked_constraint_text
        + "You are a Master Video Editor and an AI Video Director. Your task is to create an 'Editing Recipe' for a video montage.\n"
        + audio_directive
        + "STRICT RULES:\n"
        f"1. {duration_directive}\n"
        f"2. [USER STYLE DIRECTIVE]: {style_prompt}\n"
        f"3. [NEGATIVE CONSTRAINTS]: {ignore_list}\n"
        f"4. [RHYTHMIC STRICTNESS]: {rhythmic_strictness}% (At 100%, cut surgically only on musical beats. At 0%, prioritize visual and narrative continuity over the audio grid).\n"
        f"5. [MINIMUM ENERGY THRESHOLD]: {energy_threshold} (Discard or deprioritize any beats in the audio context that fall below this energy threshold).\n"
        f"6. [AUDIO MARKER PRIORITIZATION]: {audio_marker_priority}\n"
        "7. SEMANTIC ANCHORS: You MUST include clips marked as 'MUST INCLUDE (AUDIO SYNC)'. The audio markers (♪) provided in the timeline are NOT just physical cut points; they are 'Emotional Anchors'. You must make the narrative action or visual impact culminate exactly on these anchors.\n"
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
    
    chat_input = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "Ecco i clip disponibili:\n" + clips_text + audio_context + "\n\nGenera la JSON Editing Recipe."}
    ]
    
    try:
        if hasattr(processor, "apply_chat_template"):
            prompt = processor.apply_chat_template(chat_input, tokenize=False, add_generation_prompt=True)
        else:
            prompt = system_prompt + "\n\n" + chat_input[1]["content"]

        print("🧠 Invocazione LLM (Inferenza in corso)...")
        _t_start = time.perf_counter()
        output = generate(
            model,
            processor,
            prompt=prompt,
            max_tokens=4096,
            sampler=_make_sampler(temp=0.3),
            verbose=False
        )
        _inference_time = round(time.perf_counter() - _t_start, 2)

        recipe_dict = clean_json_response(output)
        if recipe_dict and isinstance(recipe_dict, dict) and "recipe" in recipe_dict:
            recipe_dict['_inference_time_seconds'] = _inference_time
            print(f"✅ LLM ha risposto con successo (Visione: {recipe_dict.get('director_vision', 'ND')}) [{_inference_time}s]")
            return recipe_dict
        else:
            print("⚠️ Il parsing del JSON dal LLM è fallito o formato non valido.")
    except Exception as e:
        print(f"⚠️ Fallimento inferenza nativa LLM: {e}")

    return None

def _save_history_archive(
    output_dir: str,
    sequence_name: str,
    export_data: list,
    recipe_dict,
    llm_model_id: str,
    director_config: dict,
    duration_mode: str,
) -> None:
    """
    Saves an immutable timestamped archive entry to
    engine/output/{sequence_name}/history/.
    Includes full _metadata block for benchmarking and session comparison.
    """
    now = datetime.datetime.now()
    ts = now.strftime("%Y%m%d_%H%M%S")

    # Build a clean model label from the HuggingFace repo ID
    raw_label = llm_model_id.split("/")[-1]
    MODEL_LABEL_MAP = {
        'gemma-4-31b-it-4bit': 'Gemma4_31B',
        'gemma-4-e4b-it-4bit': 'Gemma4_E4B',
        'Llama-3.3-70B-Instruct-4bit': 'Llama3_70B',
    }
    model_label = MODEL_LABEL_MAP.get(raw_label, raw_label.replace('-', '_'))
    dm = duration_mode.upper()

    filename = f"{ts}_{model_label}_{dm}_recipe.json"

    history_dir = os.path.join(output_dir, "history")
    os.makedirs(history_dir, exist_ok=True)

    archive_payload = {
        "_metadata": {
            "timestamp": now.isoformat(),
            "sequence_name": sequence_name,
            "brain_model": llm_model_id,
            "inference_time_seconds": recipe_dict.get("_inference_time_seconds") if recipe_dict else None,
            "user_directives": {
                "target_duration": director_config.get("target_duration"),
                "rhythmic_strictness": director_config.get("rhythmic_strictness"),
                "energy_threshold": director_config.get("energy_threshold"),
                "audio_marker_priority": director_config.get("audio_marker_priority"),
                "duration_mode": duration_mode,
                "style_prompt": director_config.get("style_prompt"),
            },
            "director_vision": recipe_dict.get("director_vision") if recipe_dict else "HEURISTIC_FALLBACK",
            "clip_count": len(export_data),
        },
        "final_edit_timeline": export_data,
        "llm_recipe": recipe_dict.get("recipe") if recipe_dict else None,
    }

    archive_path = os.path.join(history_dir, filename)
    with open(archive_path, "w") as f:
        json.dump(archive_payload, f, indent=2)
    print(f"📦 History Archive salvato: {filename}")


def _get_next_version(output_dir: str, sequence_name: str) -> int:
    """
    Scans output_dir for versioned final_edit files and returns the next version number.
    Backward compat: if _final_edit.json exists but no versioned files, returns 1.
    """
    import glob as _glob
    pattern = os.path.join(output_dir, f"{sequence_name}_final_edit_v*.json")
    existing = _glob.glob(pattern)
    if not existing:
        return 1
    versions = []
    for path in existing:
        match = re.search(r'_v(\d+)\.json$', os.path.basename(path))
        if match:
            versions.append(int(match.group(1)))
    return max(versions) + 1 if versions else 1


def _update_version_log(
    output_dir: str,
    sequence_name: str,
    version: int,
    metadata: dict,
) -> None:
    """
    Reads _version_log.json (creates it if missing), appends the new version entry,
    and writes it back atomically.
    """
    log_path = os.path.join(output_dir, f"{sequence_name}_version_log.json")
    if os.path.exists(log_path):
        with open(log_path, 'r') as f:
            log_data: dict = json.load(f)
    else:
        log_data = {"versions": []}

    entry = {
        "version": version,
        "file": f"{sequence_name}_final_edit_v{version}.json",
        "recipe_file": f"{sequence_name}_gemma_recipe_v{version}.json",
        "timestamp": metadata.get("timestamp"),
        "brain_model": metadata.get("brain_model"),
        "inference_time_seconds": metadata.get("inference_time_seconds"),
        "duration_seconds": metadata.get("duration_seconds"),
        "director_vision": metadata.get("director_vision", "HEURISTIC_FALLBACK"),
        "clip_count": metadata.get("clip_count"),
        "director_config": metadata.get("director_config"),
    }
    log_data["versions"].append(entry)

    with open(log_path, 'w') as f:
        json.dump(log_data, f, indent=2)
    print(f"📝 Version Log aggiornato: v{version} registrata.")


def build_locked_grid(locked_clips, beats):
    """
    Places locked clips at their absolute timeline positions.
    Returns: (occupied_beats: list[bool], locked_entries: list[dict])
    Sorted by timeline_position ASC so IN_GLOBAL (pos=0) is always processed first.
    """
    occupied = [False] * len(beats)
    entries = []
    for clip in sorted(locked_clips, key=lambda c: c.get('_locked_timeline_pos') or 0.0):
        pos_sec = clip.get('_locked_timeline_pos')
        if pos_sec is None:
            pos_sec = 0.0
            
        src_in = clip.get('absolute_in')
        if src_in is None:
            src_in = clip.get('start', 0.0)
            
        src_out = clip.get('absolute_out')
        if src_out is None:
            src_out = clip.get('end', 0.0)
            
        try:
            src_in = float(src_in)
            src_out = float(src_out)
        except (TypeError, ValueError):
            src_in, src_out = 0.0, 0.0
            
        clip_dur = src_out - src_in
        
        is_global_out = clip.get('_is_global_out', False)
        
        if is_global_out:
            end_idx = len(beats) - 1
            anchor_idx = end_idx
            while anchor_idx > 0 and (beats[end_idx] - beats[anchor_idx]) < clip_dur:
                anchor_idx -= 1
        else:
            anchor_idx = find_beat_index(pos_sec, beats)
            anchor_idx = max(0, min(anchor_idx, len(beats) - 1))  # Clamp
            end_idx = anchor_idx
            while end_idx < len(beats) - 1 and (beats[end_idx] - beats[anchor_idx]) < clip_dur:
                end_idx += 1
                
        for b in range(anchor_idx, end_idx):
            occupied[b] = True
            
        entries.append({
            "clip_ref": clip,
            "source_in": src_in,
            "source_out": src_out,
            "timeline_in": beats[anchor_idx],
            "timeline_out": beats[anchor_idx] + clip_dur,
            "role": "PILLAR" if clip.get('_has_bm') else "FILLER",
            "tag": clip.get('_final_tag', 'MAIN'),
            "_bm_time": clip.get('_bm_time'),
            "_is_locked": True,
        })
    return occupied, entries


def extract_gaps(occupied, beats, limit):
    """Returns list of (start_idx, end_idx) gaps between locked walls."""
    gaps, in_gap, gap_start = [], False, 0
    cap = min(limit, len(beats) - 1)
    for i in range(cap):
        if not occupied[i] and not in_gap:
            gap_start, in_gap = i, True
        elif occupied[i] and in_gap:
            gaps.append((gap_start, i))
            in_gap = False
    if in_gap:
        gaps.append((gap_start, cap))
    return gaps


def generate_final_cut(stringout_path, hitl_path, beats_path, output_dir, sequence_name, seed: int = -1, bypass_llm: bool = False, semantic_tags_map: dict | None = None):
    print(f"🎬 AI Director: Inizio Risoluzione Vincoli per {sequence_name}")
    
    stringout = load_json(stringout_path)
    hitl = load_json(hitl_path)
    audio = load_json(beats_path)
    
    timeline = stringout.get("stringout_timeline", [])
    overrides = hitl.get("clip_overrides", {})
    constraints = hitl.get("hitl_constraints", {})
    director_config = hitl.get("director_config", {})
    
    target_duration = director_config.get("target_duration", 60)
    style_prompt = director_config.get("style_prompt", "Montaggio dinamico, fluido e in sync con la musica.")
    rhythmic_strictness = director_config.get("rhythmic_strictness", 50)
    energy_threshold = director_config.get("energy_threshold", 0.4)
    audio_marker_priority = director_config.get("audio_marker_priority", "DYNAMIC_PRIORITY")
    duration_mode = director_config.get("duration_mode", "ORGANIC")
    ignore_list = director_config.get("ignore_list", "None")
    
    raw_beats = audio.get("beats", [])
    beats = []
    for b in raw_beats:
        if isinstance(b, dict):
            if b.get("energy", 0.5) >= energy_threshold:
                beats.append(b.get("time", 0.0))
        else:
            beats.append(float(b))
    
    if not beats:
        print("⚠️ Nessun beat trovato. Fallback a timecode continui a 120BPM.")
        beats = [i * 0.5 for i in range(120)]
    total_audio_duration = beats[-1] if beats else 0.0
    
    target_beats_count = find_beat_index(target_duration, beats)
    if target_beats_count <= 0:
        target_beats_count = len(beats)
    
    usable_clips = []
    for clip in timeline:
        clip_key = str(clip['start'])
        override = overrides.get(clip_key)
        
        is_usable = clip.get('is_usable', True)
        is_broll = 'B-ROLL' in clip.get('tag', '')
        
        # Allow force_status from an object override
        force_status = override
        if isinstance(override, dict):
            force_status = override.get('force_status')

        if force_status == 'KEEP':
            is_usable = True
            is_broll = False
        elif force_status == 'TRASH':
            is_usable = False
        elif force_status == 'BROLL':
            is_usable = True
            is_broll = True
            
        if not is_usable:
            continue
            
        clip['_final_tag'] = 'B-ROLL' if is_broll else 'MAIN'
        clip['_has_bm'] = False
        clip['_bm_time'] = None
        clip['_has_in'] = False
        clip['_in_time'] = None
        clip['_has_out'] = False
        clip['_out_time'] = None
        clip['_has_audio_marker'] = False

        c_list = sorted(constraints.get(clip_key, []), key=lambda x: x['time'])
        
        constraint_groups = []
        if c_list:
            current_group = [c_list[0]]
            for c in c_list[1:]:
                if c['time'] - current_group[-1]['time'] > 2.0:
                    constraint_groups.append(current_group)
                    current_group = [c]
                else:
                    current_group.append(c)
            constraint_groups.append(current_group)

        if len(constraint_groups) > 1:
            for i, group in enumerate(constraint_groups):
                virtual_clip = clip.copy()
                virtual_clip['_virtual_id'] = f"{clip_key}_v{i+1}"
                virtual_clip['_has_bm'] = False
                virtual_clip['_bm_time'] = None
                virtual_clip['_has_in'] = False
                virtual_clip['_in_time'] = None
                virtual_clip['_has_out'] = False
                virtual_clip['_out_time'] = None
                virtual_clip['_has_audio_marker'] = False
                virtual_clip['_marker_role'] = None
                virtual_clip['_marker_target_time'] = None
                
                for c in group:
                    if c['type'] == 'BM':
                        virtual_clip['_has_bm'] = True
                        virtual_clip['_bm_time'] = c['time']
                        if not virtual_clip['_marker_role']:
                            virtual_clip['_marker_role'] = 'BM'
                            virtual_clip['_marker_target_time'] = c['time']
                    elif c['type'] == 'IN':
                        virtual_clip['_has_in'] = True
                        virtual_clip['_in_time'] = c['time']
                        if not virtual_clip['_marker_role']:
                            virtual_clip['_marker_role'] = 'IN'
                            virtual_clip['_marker_target_time'] = c['time']
                    elif c['type'] == 'OUT':
                        virtual_clip['_has_out'] = True
                        virtual_clip['_out_time'] = c['time']
                        if not virtual_clip['_marker_role']:
                            virtual_clip['_marker_role'] = 'OUT'
                            virtual_clip['_marker_target_time'] = c['time']
                    elif c['type'] == 'AUDIO':
                        virtual_clip['_has_audio_marker'] = True
                        if not virtual_clip['_marker_role']:
                            virtual_clip['_marker_role'] = 'AUDIO'
                            virtual_clip['_marker_target_time'] = c['time']

                is_locked = False
                locked_pos = None
                virtual_clip['_is_global_in'] = False
                virtual_clip['_is_global_out'] = False
                if isinstance(override, dict):
                    if override.get('locked', False):
                        is_locked = True
                        locked_pos = override.get('timeline_position')
                        virtual_clip['absolute_in'] = override.get('absolute_in') if override.get('absolute_in') is not None else clip['start']
                        virtual_clip['absolute_out'] = override.get('absolute_out') if override.get('absolute_out') is not None else clip['end']
                    if override.get('is_global_start'):
                        is_locked = True
                        locked_pos = 0.0
                        virtual_clip['_is_global_in'] = True
                        if virtual_clip.get('absolute_in') is None: virtual_clip['absolute_in'] = virtual_clip.get('_in_time') if virtual_clip.get('_in_time') is not None else clip['start']
                        if virtual_clip.get('absolute_out') is None: virtual_clip['absolute_out'] = virtual_clip.get('_out_time') if virtual_clip.get('_out_time') is not None else clip['end']
                    if override.get('is_global_end'):
                        is_locked = True
                        locked_pos = target_duration
                        virtual_clip['_is_global_out'] = True
                        if virtual_clip.get('absolute_in') is None: virtual_clip['absolute_in'] = virtual_clip.get('_in_time') if virtual_clip.get('_in_time') is not None else clip['start']
                        if virtual_clip.get('absolute_out') is None: virtual_clip['absolute_out'] = virtual_clip.get('_out_time') if virtual_clip.get('_out_time') is not None else clip['end']
                virtual_clip['_locked'] = is_locked
                virtual_clip['_locked_timeline_pos'] = locked_pos
                if semantic_tags_map and str(clip['start']) in semantic_tags_map:
                    virtual_clip['yoloe_semantics'] = semantic_tags_map[str(clip['start'])]
                usable_clips.append(virtual_clip)
        else:
            clip['_virtual_id'] = clip_key
            clip['_marker_role'] = None
            clip['_marker_target_time'] = None
            for c in c_list:
                if c['type'] == 'BM':
                    clip['_has_bm'] = True
                    clip['_bm_time'] = c['time']
                    if not clip['_marker_role']: clip['_marker_role'] = 'BM'; clip['_marker_target_time'] = c['time']
                elif c['type'] == 'IN':
                    clip['_has_in'] = True
                    clip['_in_time'] = c['time']
                    if not clip['_marker_role']: clip['_marker_role'] = 'IN'; clip['_marker_target_time'] = c['time']
                elif c['type'] == 'OUT':
                    clip['_has_out'] = True
                    clip['_out_time'] = c['time']
                    if not clip['_marker_role']: clip['_marker_role'] = 'OUT'; clip['_marker_target_time'] = c['time']
                elif c['type'] == 'AUDIO':
                    clip['_has_audio_marker'] = True
                    if not clip['_marker_role']: clip['_marker_role'] = 'AUDIO'; clip['_marker_target_time'] = c['time']

            is_locked = False
            locked_pos = None
            clip['_is_global_in'] = False
            clip['_is_global_out'] = False
            if isinstance(override, dict):
                if override.get('locked', False):
                    is_locked = True
                    locked_pos = override.get('timeline_position')
                    clip['absolute_in'] = override.get('absolute_in') if override.get('absolute_in') is not None else clip['start']
                    clip['absolute_out'] = override.get('absolute_out') if override.get('absolute_out') is not None else clip['end']
                if override.get('is_global_start'):
                    is_locked = True
                    locked_pos = 0.0
                    clip['_is_global_in'] = True
                    if clip.get('absolute_in') is None: clip['absolute_in'] = clip.get('_in_time') if clip.get('_in_time') is not None else clip['start']
                    if clip.get('absolute_out') is None: clip['absolute_out'] = clip.get('_out_time') if clip.get('_out_time') is not None else clip['end']
                if override.get('is_global_end'):
                    is_locked = True
                    locked_pos = target_duration
                    clip['_is_global_out'] = True
                    if clip.get('absolute_in') is None: clip['absolute_in'] = clip.get('_in_time') if clip.get('_in_time') is not None else clip['start']
                    if clip.get('absolute_out') is None: clip['absolute_out'] = clip.get('_out_time') if clip.get('_out_time') is not None else clip['end']
            clip['_locked'] = is_locked
            clip['_locked_timeline_pos'] = locked_pos
            if semantic_tags_map and str(clip['start']) in semantic_tags_map:
                clip['yoloe_semantics'] = semantic_tags_map[str(clip['start'])]
            usable_clips.append(clip)

    # --- Separate locked walls from free clips ---
    locked_clips = [c for c in usable_clips if c.get('_locked')]
    free_clips   = [c for c in usable_clips if not c.get('_locked')]

    if locked_clips:
        print(f"🔒 [Director] {len(locked_clips)} clip locked. Costruzione attorno ai muri.")

    # --- Estrazione Modello LLM dalla configurazione (UI selection takes priority) ---
    AI_MODEL_MAP = {
        'gemma-4-4b':    'mlx-community/gemma-4-e4b-it-4bit',
        'gemma-4-31b':   'mlx-community/gemma-4-31b-it-4bit',
        'llama-3.3-70b': 'mlx-community/Llama-3.3-70B-Instruct-4bit',
    }
    ui_model_key = director_config.get('ai_model', None)
    if ui_model_key and ui_model_key in AI_MODEL_MAP:
        llm_model_id = AI_MODEL_MAP[ui_model_key]
    else:
        llm_model_id = stringout.get("metadata", {}).get("llm_model_id", 'mlx-community/gemma-4-e4b-it-4bit')

    _t_start_llm = time.time()
    
    # Compute the next version number ONCE — shared by recipe and final_edit saves
    os.makedirs(output_dir, exist_ok=True)
    next_v = _get_next_version(output_dir, sequence_name)

    # --- Chiamata Motore LLM o Bypass Deterministico ---
    if bypass_llm:
        print("⚡ [Director] Deterministic Bypass attivo: Generazione sequenza da selezioni manuali (No LLM).")
        # Read the human-ordered clip list from HITL data (D&D result from the Stringout UI).
        stringout_order: list = hitl.get("stringout_order", [])
        fake_recipe = []

        if stringout_order:
            # BYPASS MODE A: Use exact D&D order provided by the frontend.
            # Each entry is a clip start-time (float, seconds). TRASH clips are already
            # excluded by the frontend (per approved architectural decision).
            free_clip_map = {str(c['start']): c for c in free_clips}
            for start_time in stringout_order:
                clip_key = str(start_time)
                if clip_key in free_clip_map:
                    fc = free_clip_map[clip_key]
                    fake_recipe.append({
                        "clip_id": fc.get('_virtual_id', clip_key),
                        "beats": 4,
                        "reasoning": "Deterministic D&D Order"
                    })
        else:
            # BYPASS MODE B (Fallback): No explicit order — auto-select based on markers/KEEP.
            for fc in free_clips:
                override_val = overrides.get(str(fc['start']))
                is_keep = (
                    fc.get('_marker_role') is not None
                    or override_val == 'KEEP'
                    or (isinstance(override_val, dict) and override_val.get('force_status') == 'KEEP')
                    or fc.get('_has_bm')
                )
                if is_keep:
                    fake_recipe.append({
                        "clip_id": fc.get('_virtual_id', str(fc['start'])),
                        "beats": 4,
                        "reasoning": "Deterministic Selection"
                    })

        recipe_dict = {
            "director_vision": "Deterministic Cut (Bypass LLM)",
            "recipe": fake_recipe,
            "_inference_time_seconds": 0.0
        }
    else:
        # Modifica clip_list_str per LLM usando il _virtual_id (if we need to)
        for c in usable_clips:
            c['_llm_display_id'] = c.get('_virtual_id', str(c['start']))
            
        recipe_dict = call_director_llm(
            usable_clips, target_duration, target_beats_count, style_prompt, 
            rhythmic_strictness, energy_threshold, audio_marker_priority, duration_mode, ignore_list,
            seed=seed, locked_clips=locked_clips, llm_model_id=llm_model_id,
            audio_bpm=audio.get('bpm'), audio_beats=audio.get('beats')
        )
        if recipe_dict:
            recipe_dict['_inference_time_seconds'] = round(time.time() - _t_start_llm, 2)
        recipe_path = os.path.join(output_dir, f"{sequence_name}_gemma_recipe.json")
        with open(recipe_path, 'w') as f:
            json.dump(recipe_dict, f, indent=2)
        # Versioned recipe (immutable paired with final_edit_vN)
        versioned_recipe_path = os.path.join(output_dir, f"{sequence_name}_gemma_recipe_v{next_v}.json")
        with open(versioned_recipe_path, 'w') as f:
            json.dump(recipe_dict, f, indent=2)

    final_timeline = []

    # --- Step 1: Place locked walls on the beat grid ---
    locked_entries = []
    occupied_by_locks = [False] * len(beats)
    if locked_clips:
        occupied_by_locks, locked_entries = build_locked_grid(locked_clips, beats)
        print(f"🔒 [Director] {len(locked_entries)} muri locked piazzati sulla griglia.")

    recipe = recipe_dict.get("recipe", []) if isinstance(recipe_dict, dict) else []
    if not isinstance(recipe, list):
        print(f"⚠️ [Director] Recipe LLM ignorata perché non è una lista valida: {type(recipe)}")
        recipe = []

    # Cursor starts at first non-occupied beat
    def _next_free_idx(start):
        idx = start
        while idx < len(beats) and occupied_by_locks[idx]:
            idx += 1
        return idx
    
    if recipe:
        print("⚙️ Applicazione Recipe LLM sulla Griglia Matematica...")
        cursor_idx = _next_free_idx(0)
        used_clip_starts = set()
        
        for item in recipe:
            if not isinstance(item, dict):
                continue
            clip_id_raw = str(item.get("clip_id", ""))
            if not clip_id_raw:
                continue
                
            # 1. Fuzzy Matching — check virtual_id exactly first
            best_clip = None
            for c in free_clips:
                if c.get('_virtual_id') == clip_id_raw:
                    if c['start'] not in used_clip_starts:
                        best_clip = c
                        break
            
            # If no exact match on virtual_id, try proximity via float cast
            if not best_clip:
                try:
                    requested_id = float(clip_id_raw)
                    min_diff = float('inf')
                    for c in free_clips:
                        if c['start'] in used_clip_starts:
                            continue
                        diff = abs(c['start'] - requested_id)
                        if diff < min_diff and diff <= 0.5:
                            min_diff = diff
                            best_clip = c
                except ValueError:
                    pass
                    
            if not best_clip:
                continue
                
            clip = best_clip
            used_clip_starts.add(clip['start'])
            clip_beats = int(item.get("beats", 4))
            
            start_idx = cursor_idx
            # Skip any beats already occupied by locked walls
            start_idx = _next_free_idx(start_idx)
            
            # 2. Troncamento Adattivo
            max_clip_dur = clip['end'] - clip['start']
            max_end_idx = start_idx
            while max_end_idx < len(beats) - 1 and (beats[max_end_idx + 1] - beats[start_idx]) <= max_clip_dur:
                max_end_idx += 1
                
            max_beats_available = max_end_idx - start_idx
            if max_beats_available < 1:
                max_beats_available = 1
                
            clip_beats = min(clip_beats, max_beats_available)
            end_idx = cursor_idx + clip_beats
            
            if start_idx >= len(beats):
                break
            if end_idx >= len(beats):
                end_idx = len(beats) - 1
                
            actual_beats = end_idx - start_idx
            if actual_beats <= 0:
                break
                
            clip_dur = clip['end'] - clip['start']
            target_dur = beats[end_idx] - beats[start_idx]
            
            # Geometra Math for Rhythmic Trim Alignment
            if clip.get('_marker_target_time') is not None:
                m_time = clip['_marker_target_time']
                role = clip.get('_marker_role', 'BM')
                if role == 'IN':
                    trim_in = m_time - clip['start']
                elif role == 'OUT':
                    trim_in = (m_time - clip['start']) - target_dur
                else: # BM or AUDIO
                    trim_in = (m_time - clip['start']) - (target_dur / 2)
                    
                # Clamping for safety
                trim_in = max(0, min(trim_in, clip_dur - target_dur))
                
                source_in = clip['start'] + trim_in
                source_out = source_in + target_dur
            else:
                source_in = clip['start']
                source_out = clip['start'] + target_dur
                if source_out > clip['end']:
                    source_out = clip['end']
                
            final_timeline.append({
                "clip_ref": clip,
                "source_in": source_in,
                "source_out": source_out,
                "timeline_in": beats[start_idx],
                "timeline_out": beats[end_idx],
                "role": "PILLAR" if clip.get('_has_bm') else "FILLER",
                "tag": clip['_final_tag'],
                "_bm_time": clip.get('_bm_time')
            })
            cursor_idx = end_idx
            # Advance past any locked beats
            cursor_idx = _next_free_idx(cursor_idx)
            
            if cursor_idx >= len(beats) or cursor_idx >= target_beats_count:
                break
                
        # 3. Auto-Fill di Salvaguardia (The Safety Net) — only free clips, only free beats
        if cursor_idx < target_beats_count:
            print(f"⚠️ Timeline LLM troppo corta ({cursor_idx}/{target_beats_count} beats). Attivazione Safety Net.")

            fillers = [c for c in free_clips if c['start'] not in used_clip_starts and not c.get('_has_bm')]
            fillers.sort(key=lambda c: c.get('cinematography', {}).get('visual_quality_score', 0) + (10 if c.get('score_mlx') else 0), reverse=True)
            
            filler_index = 0
            PACING_BEATS = 4
            
            while cursor_idx < target_beats_count and filler_index < len(fillers):
                filler = fillers[filler_index]
                filler_index += 1
                
                beats_available = target_beats_count - cursor_idx
                chunk_size = min(PACING_BEATS, beats_available)
                if chunk_size < 1:
                    break
                    
                start_idx = cursor_idx
                max_clip_dur = filler['end'] - filler['start']
                max_end_idx = start_idx
                while max_end_idx < len(beats) - 1 and (beats[max_end_idx + 1] - beats[start_idx]) <= max_clip_dur:
                    max_end_idx += 1
                
                max_beats_available = max_end_idx - start_idx
                if max_beats_available < 1:
                    max_beats_available = 1
                
                chunk_size = min(chunk_size, max_beats_available)
                end_idx = start_idx + chunk_size
                
                if end_idx >= len(beats):
                    end_idx = len(beats) - 1
                    
                actual_beats = end_idx - start_idx
                if actual_beats <= 0:
                    break
                    
                target_dur = beats[end_idx] - beats[start_idx]
                source_in = filler['start']
                source_out = filler['start'] + target_dur
                
                if source_out > filler['end']:
                    source_out = filler['end']
                    
                final_timeline.append({
                    "clip_ref": filler,
                    "source_in": source_in,
                    "source_out": source_out,
                    "timeline_in": beats[start_idx],
                    "timeline_out": beats[end_idx],
                    "role": "FILLER",
                    "tag": filler['_final_tag']
                })
                
                used_clip_starts.add(filler['start'])
                cursor_idx = end_idx

        # --- Merge locked walls into the recipe final timeline ---
        if locked_entries:
            final_timeline.extend(locked_entries)
        final_timeline.sort(key=lambda x: x['timeline_in'])

    else:
        print("⚠️ FALLBACK EURISTICO ATTIVO: Utilizzo logica a 4-beat per il pacing.")
        pillars = [c for c in free_clips if c.get('_has_bm')]
        fillers = [c for c in free_clips if not c.get('_has_bm')]
        fillers.sort(key=lambda c: c.get('cinematography', {}).get('visual_quality_score', 0) + (10 if c.get('score_mlx') else 0), reverse=True)
        
        pillars.sort(key=lambda c: c['start'])
        occupied_beats = [False] * len(beats)
        
        if pillars:
            first_clip_start = usable_clips[0]['start'] if usable_clips else 0
            last_clip_end = usable_clips[-1]['end'] if usable_clips else 100
            total_source_duration = last_clip_end - first_clip_start
            if total_source_duration <= 0:
                total_source_duration = 1
                
            for pillar in pillars:
                ratio = (pillar['_bm_time'] - first_clip_start) / total_source_duration
                target_audio_time = ratio * total_audio_duration
                anchor_idx = find_beat_index(target_audio_time, beats)
                left_expansion = 2
                right_expansion = 2
                start_idx = max(0, anchor_idx - left_expansion)
                end_idx = min(len(beats) - 1, anchor_idx + right_expansion)
                
                while start_idx <= end_idx and occupied_beats[start_idx]:
                    start_idx += 1
                if start_idx >= end_idx:
                    continue
                    
                audio_dur_left = beats[anchor_idx] - beats[start_idx]
                available_left = pillar['_bm_time'] - pillar['start']
                while audio_dur_left > available_left and start_idx < anchor_idx:
                    start_idx += 1
                    audio_dur_left = beats[anchor_idx] - beats[start_idx]
                    
                audio_dur_right = beats[end_idx] - beats[anchor_idx]
                available_right = pillar['end'] - pillar['_bm_time']
                while audio_dur_right > available_right and end_idx > anchor_idx:
                    end_idx -= 1
                    audio_dur_right = beats[end_idx] - beats[anchor_idx]
                    
                if start_idx >= end_idx:
                    continue
                    
                actual_audio_dur_left = beats[anchor_idx] - beats[start_idx]
                actual_audio_dur_right = beats[end_idx] - beats[anchor_idx]
                source_in = pillar['_bm_time'] - actual_audio_dur_left
                source_out = pillar['_bm_time'] + actual_audio_dur_right
                
                for b in range(start_idx, end_idx):
                    occupied_beats[b] = True
                    
                final_timeline.append({
                    "clip_ref": pillar,
                    "source_in": source_in,
                    "source_out": source_out,
                    "timeline_in": beats[start_idx],
                    "timeline_out": beats[end_idx],
                    "role": "PILLAR",
                    "tag": pillar['_final_tag'],
                    "_bm_time": pillar.get('_bm_time')
                })
                
        gaps = []
        current_gap_start = None
        for i in range(len(beats) - 1):
            if not occupied_beats[i]:
                if current_gap_start is None:
                    current_gap_start = i
            else:
                if current_gap_start is not None:
                    gaps.append((current_gap_start, i))
                    current_gap_start = None
        if current_gap_start is not None:
            gaps.append((current_gap_start, len(beats)-1))
            
        filler_index = 0
        PACING_BEATS = 4
        
        for gap_start, gap_end in gaps:
            cursor_idx = gap_start
            while cursor_idx < gap_end:
                beats_available = gap_end - cursor_idx
                chunk_size = min(PACING_BEATS, beats_available)
                
                if chunk_size < 2:
                    break 
                if filler_index >= len(fillers):
                    break
                    
                filler = fillers[filler_index]
                filler_index += 1
                
                clip_dur = filler['end'] - filler['start']
                target_dur = beats[cursor_idx + chunk_size] - beats[cursor_idx]
                if target_dur > clip_dur:
                    target_dur = clip_dur
                    while (beats[cursor_idx + chunk_size] - beats[cursor_idx]) > clip_dur and chunk_size > 1:
                        chunk_size -= 1
                    target_dur = beats[cursor_idx + chunk_size] - beats[cursor_idx]
                    
                source_in = filler['start']
                source_out = filler['start'] + target_dur
                
                for b in range(cursor_idx, cursor_idx + chunk_size):
                    occupied_beats[b] = True
                    
                final_timeline.append({
                    "clip_ref": filler,
                    "source_in": source_in,
                    "source_out": source_out,
                    "timeline_in": beats[cursor_idx],
                    "timeline_out": beats[cursor_idx + chunk_size],
                    "role": "FILLER",
                    "tag": filler['_final_tag']
                })
                cursor_idx += chunk_size
                
        # --- Merge locked walls into the final timeline ---
        if locked_entries:
            final_timeline.extend(locked_entries)

        final_timeline.sort(key=lambda x: x['timeline_in'])
        
        # Trimma alla Target Duration per il Fallback se necessario (opzionale)
        trimmed_timeline = []
        for item in final_timeline:
            if item['timeline_in'] >= beats[target_beats_count-1]:
                break
            trimmed_timeline.append(item)
        final_timeline = trimmed_timeline
        
    os.makedirs(output_dir, exist_ok=True)

    # --- Build export_data from the final timeline ---
    export_data = []
    for item in final_timeline:
        export_item = {
            "source_clip_start": round(item['clip_ref']['start'], 3),
            "source_clip_end": round(item['clip_ref']['end'], 3),
            "source_in": round(item['source_in'], 3),
            "source_out": round(item['source_out'], 3),
            "timeline_in": round(item['timeline_in'], 3),
            "timeline_out": round(item['timeline_out'], 3),
            "role": item['role'],
            "tag": item['tag']
        }
        if '_bm_time' in item and item['_bm_time'] is not None:
            export_item['_bm_time'] = round(item['_bm_time'], 3)
        export_data.append(export_item)

    # --- Versioned file (immutable historical record) ---
    versioned_filename = f"{sequence_name}_final_edit_v{next_v}.json"
    versioned_path = os.path.join(output_dir, versioned_filename)
    with open(versioned_path, 'w') as f:
        json.dump({"version": next_v, "final_edit_timeline": export_data}, f, indent=2)

    # --- Working file (backward-compat pointer, always the latest) ---
    output_path = os.path.join(output_dir, f"{sequence_name}_final_edit.json")
    with open(output_path, 'w') as f:
        json.dump({"version": next_v, "final_edit_timeline": export_data}, f, indent=2)

    sequence_duration = max([item["timeline_out"] for item in export_data]) if export_data else 0.0

    # --- Update version log sidecar ---
    _update_version_log(
        output_dir=output_dir,
        sequence_name=sequence_name,
        version=next_v,
        metadata={
            "timestamp": datetime.datetime.now().isoformat(),
            "brain_model": llm_model_id,
            "inference_time_seconds": recipe_dict.get("_inference_time_seconds") if recipe_dict else None,
            "duration_seconds": sequence_duration,
            "director_vision": recipe_dict.get("director_vision") if recipe_dict else "HEURISTIC_FALLBACK",
            "clip_count": len(export_data),
            "director_config": director_config,
        },
    )

    # --- Immutable history archive (timestamped, unchanged from v0.1.52) ---
    _save_history_archive(
        output_dir=output_dir,
        sequence_name=sequence_name,
        export_data=export_data,
        recipe_dict=recipe_dict,
        llm_model_id=llm_model_id,
        director_config=director_config,
        duration_mode=duration_mode,
    )

    print(f"✅ AI Director: Generato final cut con {len(export_data)} clip in sequenza (v{next_v}).")
    print(f"✅ Salvato in {versioned_path}")

    return output_path

if __name__ == "__main__":
    pass
