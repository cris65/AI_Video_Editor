import os
import json
import requests
import re

try:
    from mlx_lm import load, generate
    MLX_LM_AVAILABLE = True
except ImportError:
    MLX_LM_AVAILABLE = False

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
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass
    json_pattern = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_text, re.DOTALL)
    if json_pattern:
        try:
            return json.loads(json_pattern.group(1))
        except json.JSONDecodeError:
            pass
    root_pattern = re.search(r'(\{.*?\})', raw_text, re.DOTALL)
    if root_pattern:
        try:
            return json.loads(root_pattern.group(1))
        except json.JSONDecodeError:
            pass
    return None

def call_director_llm(usable_clips, target_duration, total_beats, style_prompt, seed: int = -1, locked_clips=None, llm_model_id="meta-llama/Meta-Llama-3-70B-Instruct", audio_bpm=None, audio_beats=None):
    if not check_director_llm_available():
        print("⚠️  [Director] Libreria mlx_lm non disponibile. Fallback euristico.")
        return None

    print(f"⏳ Downloading / Loading {llm_model_id} (Director's Brain)...")
    try:
        model, processor = load(llm_model_id)
        print("✅ Director Model loaded successfully!")
    except Exception as e:
        print(f"❌ Impossibile caricare il modello LLM: {e}")
        return None

    clip_list_str = []
    for c in usable_clips:
        role = "MUST INCLUDE (PILLAR)" if c.get('_has_bm') else "OPTIONAL (FILLER)"
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

        clip_list_str.append(
            f"- ID: {c['start']} | Role: {role} | Score: {score}/10 | Scene: {scene} | Action: {action} "
            f"| Subject Action: {subject_action} | Gaze: {gaze_direction} | Emotion: {emotional_tone} | Energy: {narrative_energy}/10"
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
        audio_context = f"\n\n[RHYTHM CONTEXT]\nBPM: {audio_bpm}\nBeats Grid (seconds): {audio_beats}\n"

    system_prompt = (
        locked_constraint_text
        + "Sei un Master Video Editor e un AI Video Director. Il tuo compito è creare una 'Editing Recipe' per un montaggio video.\n"
        + audio_directive
        + "REGOLE RIGIDE:\n"
        f"1. La durata target è di circa {target_duration} secondi (circa {total_beats} beat musicali).\n"
        f"2. Stile richiesto dal regista: '{style_prompt}'\n"
        "3. DEVI includere tutti i clip marcati come 'MUST INCLUDE (PILLAR)'. Posizionali nei momenti chiave della narrazione.\n"
        "4. Usa i metadati 'Narrative Energy' ed 'Emotional Tone' per costruire il ritmo della sequenza e le scelte logiche.\n"
        "5. CONTINUITÀ D'AZIONE (ACTION CONTINUITY): Non limitarti a mantenere l'ordine cronologico degli ID. RIMESCOLA l'ordine delle clip per dare senso all'azione. Crea un arco narrativo sensato.\n"
        "6. SCREEN DIRECTION: Fai estrema attenzione alla direzione. Assicurati che 'Gaze' e i movimenti dei soggetti creino fluidità visiva.\n"
        "7. SCORE COME SPAREGGIO: Usa il campo 'Score' SOLO come criterio di spareggio.\n"
        "8. Per ogni clip scelto, decidi quanti 'beats' deve durare (es. 2, 4, 8). La somma totale dei beats dovrebbe avvicinarsi a {total_beats}.\n"
        "9. RISPONDI ESCLUSIVAMENTE CON UN OGGETTO JSON. Nessuna spiegazione, nessun testo prima o dopo. "
        "Formato esatto richiesto:\n"
        '{\n'
        '  "director_vision": "Spiegazione in 2 righe della logica narrativa usata per questa sequenza",\n'
        '  "recipe": [\n'
        '    {"clip_id": "0.0", "beats": 4, "reasoning": "Motivazione basata su Narrative Energy o Gaze..."},\n'
        '    {"clip_id": "15.3", "beats": 2, "reasoning": "Motivazione della transizione..."}\n'
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
        output = generate(
            model,
            processor,
            prompt=prompt,
            max_tokens=4096,
            temperature=0.3,
            verbose=False
        )
        
        recipe_dict = clean_json_response(output)
        if recipe_dict and isinstance(recipe_dict, dict) and "recipe" in recipe_dict:
            print(f"✅ LLM ha risposto con successo (Visione: {recipe_dict.get('director_vision', 'ND')})")
            return recipe_dict
        else:
            print("⚠️ Il parsing del JSON dal LLM è fallito o formato non valido.")
    except Exception as e:
        print(f"⚠️ Fallimento inferenza nativa LLM: {e}")
        
    return None

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
            
        src_in = clip.get('absolute_in', clip['start'])
        src_out = clip.get('absolute_out', clip['end'])
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


def generate_final_cut(stringout_path, hitl_path, beats_path, output_dir, sequence_name, seed: int = -1):
    print(f"🎬 AI Director: Inizio Risoluzione Vincoli per {sequence_name}")
    
    stringout = load_json(stringout_path)
    hitl = load_json(hitl_path)
    audio = load_json(beats_path)
    
    timeline = stringout.get("stringout_timeline", [])
    overrides = hitl.get("clip_overrides", {})
    constraints = hitl.get("hitl_constraints", {})
    director_config = hitl.get("director_config", {})
    beats = audio.get("beats", [])
    
    if not beats:
        print("⚠️ Nessun beat trovato. Fallback a timecode continui a 120BPM.")
        beats = [i * 0.5 for i in range(120)]
        
    target_duration = director_config.get("target_duration", 60)
    style_prompt = director_config.get("style_prompt", "Montaggio dinamico, fluido e in sync con la musica.")
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

        c_list = constraints.get(clip_key, [])
        for c in c_list:
            if c['type'] == 'BM':
                clip['_has_bm'] = True
                clip['_bm_time'] = c['time']
            elif c['type'] == 'IN':
                clip['_has_in'] = True
                clip['_in_time'] = c['time']
            elif c['type'] == 'OUT':
                clip['_has_out'] = True
                clip['_out_time'] = c['time']

        # --- HITL Lock detection ---
        is_locked = False
        locked_pos = None
        clip['_is_global_in'] = False
        clip['_is_global_out'] = False
        
        if isinstance(override, dict):
            if override.get('locked', False):
                is_locked = True
                locked_pos = override.get('timeline_position')
                clip['absolute_in'] = override.get('absolute_in', clip['start'])
                clip['absolute_out'] = override.get('absolute_out', clip['end'])

            if override.get('is_global_start'):
                is_locked = True
                locked_pos = 0.0  # GLOBAL START
                clip['_is_global_in'] = True
                if not clip.get('absolute_in'):
                    clip['absolute_in'] = clip.get('_in_time', clip['start'])
                if not clip.get('absolute_out'):
                    clip['absolute_out'] = clip.get('_out_time', clip['end'])

            if override.get('is_global_end'):
                is_locked = True
                locked_pos = target_duration  # GLOBAL END
                clip['_is_global_out'] = True
                if not clip.get('absolute_in'):
                    clip['absolute_in'] = clip.get('_in_time', clip['start'])
                if not clip.get('absolute_out'):
                    clip['absolute_out'] = clip.get('_out_time', clip['end'])

        clip['_locked'] = is_locked
        clip['_locked_timeline_pos'] = locked_pos

        usable_clips.append(clip)

    # --- Separate locked walls from free clips ---
    locked_clips = [c for c in usable_clips if c.get('_locked')]
    free_clips   = [c for c in usable_clips if not c.get('_locked')]

    if locked_clips:
        print(f"🔒 [Director] {len(locked_clips)} clip locked. Costruzione attorno ai muri.")

    # --- Estrazione Modello LLM dalla configurazione ---
    llm_model_id = stringout.get("metadata", {}).get("llm_model_id", "meta-llama/Meta-Llama-3-70B-Instruct")

    # We pass ALL usable_clips to LLM so it sees the Global IN/OUT narrative anchors
    recipe_dict = call_director_llm(
        usable_clips, target_duration, target_beats_count, style_prompt, seed, 
        locked_clips=locked_clips, llm_model_id=llm_model_id,
        audio_bpm=audio.get("bpm"), audio_beats=audio.get("beats")
    )
    
    if recipe_dict:
        os.makedirs(output_dir, exist_ok=True)
        recipe_path = os.path.join(output_dir, f"{sequence_name}_gemma_recipe.json")
        with open(recipe_path, 'w') as f:
            json.dump(recipe_dict, f, indent=2)
            
    final_timeline = []

    # --- Step 1: Place locked walls on the beat grid ---
    locked_entries = []
    occupied_by_locks = [False] * len(beats)
    if locked_clips:
        occupied_by_locks, locked_entries = build_locked_grid(locked_clips, beats)
        print(f"🔒 [Director] {len(locked_entries)} muri locked piazzati sulla griglia.")

    recipe = recipe_dict.get("recipe", []) if recipe_dict else None

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
            clip_id_raw = item.get("clip_id")
            if clip_id_raw is None:
                continue
                
            try:
                requested_id = float(clip_id_raw)
            except ValueError:
                continue
                
            # 1. Fuzzy Matching — only from free_clips (locked clips are already placed)
            best_clip = None
            min_diff = float('inf')
            for c in free_clips:
                if c['start'] in used_clip_starts:
                    continue
                diff = abs(c['start'] - requested_id)
                if diff < min_diff and diff <= 0.5:
                    min_diff = diff
                    best_clip = c
                    
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
            
            if clip.get('_has_bm'):
                source_in = clip['_bm_time'] - (target_dur / 2)
                source_out = clip['_bm_time'] + (target_dur / 2)
            else:
                source_in = clip['start']
                source_out = clip['start'] + target_dur
                
            if source_in < clip['start']:
                diff = clip['start'] - source_in
                source_in += diff
                source_out += diff
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
    output_path = os.path.join(output_dir, f"{sequence_name}_final_edit.json")
    
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
        
    with open(output_path, 'w') as f:
        json.dump({"final_edit_timeline": export_data}, f, indent=2)
        
    print(f"✅ AI Director: Generato final cut con {len(export_data)} clip in sequenza.")
    print(f"✅ Salvato in {output_path}")
    
    return output_path

if __name__ == "__main__":
    pass
