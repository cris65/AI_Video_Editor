import os
import sys
import json
import base64
import re
import time

try:
    from mlx_vlm import load, generate
    MLX_VLM_AVAILABLE = True
except ImportError:
    MLX_VLM_AVAILABLE = False

PROMPT_TEXT = (
    "<|think|>You are a literal, objective, and highly observant continuity supervisor. You MUST NOT invent or hallucinate settings, lighting, or emotions. Describe exactly what is in the frame. Your observations must be literal, factual, and prop-aware. "
    "You are analyzing a single continuous video shot, displayed across {num_frames} sequential temporal frames. "
    "FUNDAMENTAL CONTINUITY RULE: These frames represent the chronological passage of time within a SINGLE scene. Subjects in earlier frames are the same ones continuing their action in later frames. "
    "Your task is to analyze how the scene and subjects move and evolve chronologically, providing a comprehensive assessment for editorial and commercial use. "
    "TECHNICAL CONTEXT: The computer vision system has already detected {people_count} person(s) in this scene. Use this data to inform your analysis. "
    "Respond EXCLUSIVELY with a valid JSON code block containing the following 5 nested objects and no other keys:\n"
    "  'cinematography': {{ 'scene_description': str, 'lighting_type': str (e.g. NATURAL, STUDIO, MIXED, BACKLIT), 'visual_quality_score': int (1-10), 'technical_flaws': str (empty if none), 'shot_size': str (must be exactly one of: ECU, CU, MCU, MS, FS, WS, INSERT) }}\n"
    "  'semantic_analysis': {{ 'subject_action': str, 'gaze_direction': str (must be exactly one of: LEFT, RIGHT, CENTER, DOWN, UP, NONE), 'emotional_tone': str, 'narrative_energy_score': int (1-10), 'subject_screen_position': str (must be exactly one of: LEFT_THIRD, CENTER, RIGHT_THIRD, NONE), 'subject_count': int, 'setting_location': str (2-3 words concise physical space description, e.g. 'Outdoor Garden', 'City Street'), 'key_props': list[str] (1 to 3 interactive objects present in the scene, e.g. ['Wicker Swing']) }}\n"
    "  'continuity': {{ 'action_description': str, 'emotion_arc': str, 'match_cut_potential': bool, 'match_cut_vector': str (must be exactly one of: PAN_LEFT, PAN_RIGHT, TILT_UP, TILT_DOWN, PUSH_IN, PULL_OUT, STATIC, NONE) }}\n"
    "  'commercial': {{ 'product_visibility': str (HIGH/MEDIUM/LOW/NONE), 'brand_safe': bool, 'reaction_type': str (e.g. JOY, SURPRISE, NEUTRAL, FOCUSED) }}\n"
    "  'story': {{ 'narrative_role': str (e.g. ESTABLISHING, ACTION, REACTION, TRANSITION, FINALE), 'recommended_position': str (OPENING/MIDDLE/CLOSING), 'director_note': str }}\n"
    "  'is_usable': bool"
)

def check_mlx_server_health():
    """
    Ritorna True se la libreria mlx_vlm nativa è installata.
    """
    return MLX_VLM_AVAILABLE

def clean_json_response(raw_text):
    """Estrae l'oggetto JSON eliminando i markdown, commenti e reasoning tags."""
    # Prova a estrarre prima l'oggetto JSON più esterno tramite ricerca greedy
    match = re.search(r'(\{.*\})', raw_text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

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
            
    return None

def parse_quality_score(raw_score):
    """Estrae solo il primo numero intero da 1 a 10. Fallback a 5."""
    try:
        match = re.search(r'\b(10|[1-9])\b', str(raw_score))
        if match:
            return int(match.group(1))
    except Exception:
        pass
    return 5

def analyze_frame(model, processor, image_paths, people_count=0):
    """Interroga direttamente il modello MLX locale."""
    if not image_paths:
        return None
        
    num_frames = len(image_paths)
    dynamic_prompt = PROMPT_TEXT.format(people_count=people_count, num_frames=num_frames)
    
    # Per modelli vision, formattiamo con apply_chat_template se disponibile
    try:
        if hasattr(processor, "apply_chat_template") and processor.chat_template:
            # Per evitare crash se il tokenizer richiede input stringa o list di dict
            chat_input = [{"role": "user", "content": dynamic_prompt}]
            prompt = processor.apply_chat_template(chat_input, tokenize=False, add_generation_prompt=True)
        else:
            prompt = dynamic_prompt
            
        output = generate(
            model,
            processor,
            prompt=prompt,
            image=image_paths,
            max_tokens=512,
            temperature=1.0,
            top_p=0.95,
            top_k=64,
            verbose=False
        )
        
        message_content = output.text
        parsed_json = clean_json_response(message_content)
        
        if parsed_json:
            return parsed_json
        else:
            print(f"      [MLX Client] Errore Parsing JSON: Impossibile mappare la risposta.")
            
    except Exception as e:
        print(f"      [MLX Client] Fallimento Inferenza: {e}")
        
    return None

def process_stringout_batch(json_path, progress_callback=None):
    """Apre il JSON principale, analizza ogni clip, inietta il semantic payload e salva atomico."""
    if not os.path.exists(json_path):
        print("❌ MLX Client Errore: File Stringout JSON non trovato.")
        return
        
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    timeline = data.get("stringout_timeline", [])
    if not timeline:
        print("⚠️ Nessuna timeline valida trovata nel JSON.")
        return
        
    vlm_model_id = data.get("metadata", {}).get("vlm_model_id", "mlx-community/gemma-4-e4b-it-4bit")
    print(f"🔄 Avvio processo batch MLX su {len(timeline)} segmenti.")
    print(f"⏳ Downloading model weights (if not cached) and Loading {vlm_model_id}...")
    try:
        model, processor = load(vlm_model_id)
        print("✅ Model loaded successfully!")
    except Exception as e:
        print(f"❌ Impossibile caricare il modello MLX: {e}")
        return

    success_count = 0
    
    for idx, clip in enumerate(timeline):
        # --- SMART RESUME: Skip incrementale per-clip ---
        # Note: backwards compatibility: read storyboard_path if storyboard_paths is empty
        storyboard_paths = clip.get("storyboard_paths", [])
        legacy_path = clip.get("storyboard_path")
        if not storyboard_paths and legacy_path and os.path.exists(legacy_path):
            storyboard_paths = [legacy_path]

        if not storyboard_paths:
            continue

        # --- SMART RESUME: Skip incrementale per-clip ---
        # Una clip è considerata già analizzata se ha semantic_analysis con dati reali
        existing_semantic = clip.get("semantic_analysis", {})
        if (
            existing_semantic
            and existing_semantic.get("subject_action", "ANALYSIS_FAILED") != "ANALYSIS_FAILED"
            and "setting_location" in existing_semantic
        ):
            print(f"   ► [{idx+1}/{len(timeline)}]: {os.path.basename(storyboard_paths[0])} (+{len(storyboard_paths)-1} frames) — ⏭️  SKIP (già analizzata)")
            success_count += 1
            continue

        if progress_callback:
            progress_callback("B_MLX", int((idx / len(timeline)) * 100), f"Analisi semantica MLX: clip {idx+1}/{len(timeline)}")

        print(f"   ► Analisi [{idx+1}/{len(timeline)}]: {os.path.basename(storyboard_paths[0])} (+{len(storyboard_paths)-1} frames) ...", end="", flush=True)

        # SUB-SAMPLING (Hard-cap at 16 frames to prevent KV Cache explosion)
        MAX_VLM_FRAMES = 16
        if len(storyboard_paths) > MAX_VLM_FRAMES:
            step = len(storyboard_paths) / MAX_VLM_FRAMES
            sampled_paths = [storyboard_paths[int(i * step)] for i in range(MAX_VLM_FRAMES)]
        else:
            sampled_paths = storyboard_paths

        # CHIAMATA SINCRONA MLX NATIVA
        people_count = clip.get("yolo_omniscient_data", {}).get("total_objects", 0)
        semantic_data = analyze_frame(model, processor, sampled_paths, people_count)
        
        if semantic_data:
            print(" ✅ OK")
            # Inject nested macro-objects from Gemma response
            cine = semantic_data.get("cinematography") or {}
            sema = semantic_data.get("semantic_analysis") or {}
            cont = semantic_data.get("continuity") or {}
            comm = semantic_data.get("commercial") or {}
            stor = semantic_data.get("story") or {}

            # Helpers for parsing and validation
            def get_validated_enum(val, allowed, default):
                if not val:
                    return default
                s_val = str(val).strip().upper()
                return s_val if s_val in allowed else default

            shot_size = get_validated_enum(
                cine.get("shot_size"), 
                {"ECU", "CU", "MCU", "MS", "FS", "WS", "INSERT"}, 
                "MS"
            )
            gaze = get_validated_enum(
                sema.get("gaze_direction"), 
                {"LEFT", "RIGHT", "CENTER", "DOWN", "UP", "NONE"}, 
                "NONE"
            )
            screen_pos = get_validated_enum(
                sema.get("subject_screen_position"), 
                {"LEFT_THIRD", "CENTER", "RIGHT_THIRD", "NONE"}, 
                "NONE"
            )
            match_vector = get_validated_enum(
                cont.get("match_cut_vector"), 
                {"PAN_LEFT", "PAN_RIGHT", "TILT_UP", "TILT_DOWN", "PUSH_IN", "PULL_OUT", "STATIC", "NONE"}, 
                "NONE"
            )

            try:
                sub_count = int(sema.get("subject_count", 0))
            except (ValueError, TypeError):
                sub_count = 0

            # Extracted setting_location and key_props
            setting_loc = str(sema.get("setting_location") or "ANALYSIS_FAILED").strip()
            raw_props = sema.get("key_props")
            if isinstance(raw_props, list):
                props = [str(p).strip() for p in raw_props if p][:3]
            else:
                props = []

            clip["cinematography"] = {
                "scene_description":   cine.get("scene_description", "ANALYSIS_FAILED"),
                "lighting_type":       cine.get("lighting_type", "ANALYSIS_FAILED"),
                "visual_quality_score": parse_quality_score(cine.get("visual_quality_score", 0)),
                "technical_flaws":     cine.get("technical_flaws", ""),
                "shot_size":           shot_size
            }
            clip["semantic_analysis"] = {
                "subject_action":         sema.get("subject_action", "ANALYSIS_FAILED"),
                "gaze_direction":         gaze,
                "emotional_tone":         sema.get("emotional_tone", "ANALYSIS_FAILED"),
                "narrative_energy_score": parse_quality_score(sema.get("narrative_energy_score", 1)),
                "subject_screen_position": screen_pos,
                "subject_count":           sub_count,
                "setting_location":        setting_loc,
                "key_props":               props
            }
            clip["continuity"] = {
                "action_description":  cont.get("action_description", "ANALYSIS_FAILED"),
                "emotion_arc":         cont.get("emotion_arc", "ANALYSIS_FAILED"),
                "match_cut_potential": cont.get("match_cut_potential", False),
                "match_cut_vector":    match_vector
            }
            clip["commercial"] = {
                "product_visibility": comm.get("product_visibility", "ANALYSIS_FAILED"),
                "brand_safe":         comm.get("brand_safe", True),
                "reaction_type":      comm.get("reaction_type", "")
            }
            clip["story"] = {
                "narrative_role":       stor.get("narrative_role", "ANALYSIS_FAILED"),
                "recommended_position": stor.get("recommended_position", "MIDDLE"),
                "director_note":        stor.get("director_note", "")
            }
            clip["is_usable"] = semantic_data.get("is_usable", True)
            success_count += 1
        else:
            print(" ❌ Fallita")
            # Structured fallback — all sub-keys are explicitly set to avoid missing keys downstream
            clip["cinematography"] = {
                "scene_description":    "ANALYSIS_FAILED",
                "lighting_type":        "ANALYSIS_FAILED",
                "visual_quality_score": 0,
                "technical_flaws":      "ANALYSIS_FAILED",
                "shot_size":            "MS"
            }
            clip["semantic_analysis"] = {
                "subject_action":         "ANALYSIS_FAILED",
                "gaze_direction":         "NONE",
                "emotional_tone":         "ANALYSIS_FAILED",
                "narrative_energy_score": 1,
                "subject_screen_position": "NONE",
                "subject_count":           0,
                "setting_location":        "ANALYSIS_FAILED",
                "key_props":               []
            }
            clip["continuity"] = {
                "action_description":  "ANALYSIS_FAILED",
                "emotion_arc":         "ANALYSIS_FAILED",
                "match_cut_potential": False,
                "match_cut_vector":    "NONE"
            }
            clip["commercial"] = {
                "product_visibility": "ANALYSIS_FAILED",
                "brand_safe":         True,
                "reaction_type":      ""
            }
            clip["story"] = {
                "narrative_role":       "ANALYSIS_FAILED",
                "recommended_position": "MIDDLE",
                "director_note":        ""
            }
            clip["is_usable"] = False
            
        # Sovrascrittura atomica progressiva del JSON (salvataggio immediato post-clip)
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        
    if progress_callback:
        progress_callback("B_MLX", 100, f"MLX Completato ({success_count}/{len(timeline)})")
    print(f"✅ MLX Client Completato. Elaborate {success_count}/{len(timeline)} clip con successo.")
