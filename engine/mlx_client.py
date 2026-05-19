import os
import sys
import json
import base64
import requests
import re
import time

MLX_ENDPOINT = "http://127.0.0.1:8080/v1/chat/completions"
MLX_MODELS_ENDPOINT = "http://127.0.0.1:8080/v1/models"
MAX_RETRIES = 3
TIMEOUT_SECONDS = 60

PROMPT_TEXT = (
    "You are a Senior Video Editor, Director of Photography, and Commercial Creative Director. "
    "You are analyzing a single continuous video shot, displayed across 3 temporal frames in one image: Left (START), Center (BEST MOMENT), Right (END). "
    "FUNDAMENTAL CONTINUITY RULE: This image represents the passage of time within a SINGLE scene. Subjects on the left are the same ones continuing their action at the center and right. "
    "Your task is to analyze how the scene and subjects move and evolve chronologically, providing a comprehensive assessment for editorial and commercial use. "
    "TECHNICAL CONTEXT: The computer vision system has already detected {people_count} person(s) in this scene. Use this data to inform your analysis. "
    "Respond EXCLUSIVELY with a valid JSON code block containing the following 4 nested objects and no other keys:\n"
    "  'cinematography': {{ 'scene_description': str, 'lighting_type': str (e.g. NATURAL, STUDIO, MIXED, BACKLIT), 'visual_quality_score': int (1-10), 'technical_flaws': str (empty if none) }}\n"
    "  'continuity': {{ 'action_description': str, 'emotion_arc': str, 'match_cut_potential': bool }}\n"
    "  'commercial': {{ 'product_visibility': str (HIGH/MEDIUM/LOW/NONE), 'brand_safe': bool, 'reaction_type': str (e.g. JOY, SURPRISE, NEUTRAL, FOCUSED) }}\n"
    "  'story': {{ 'narrative_role': str (e.g. ESTABLISHING, ACTION, REACTION, TRANSITION, FINALE), 'recommended_position': str (OPENING/MIDDLE/CLOSING), 'director_note': str }}\n"
    "  'is_usable': bool"
)

def check_mlx_server_health():
    """Verifica rapida se l'API MLX è attiva e in ascolto locale."""
    try:
        response = requests.get(MLX_MODELS_ENDPOINT, timeout=2.0)
        return response.status_code == 200
    except requests.exceptions.RequestException:
        return False

def encode_image_to_base64(image_path):
    """Converte un frame JPEG in payload Base64."""
    if not os.path.exists(image_path):
        return None
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def clean_json_response(raw_text):
    """Estrae l'oggetto JSON eliminando i markdown e commenti."""
    try:
        # Tenta il parse diretto
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass
        
    # Pattern regex per estrarre roba contenuta fra backticks o l'oggetto nativo
    json_pattern = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_text, re.DOTALL)
    if json_pattern:
        try:
            return json.loads(json_pattern.group(1))
        except json.JSONDecodeError:
            pass
            
    # Prova a pescare l'oggetto root nudo e crudo
    root_pattern = re.search(r'(\{.*?\})', raw_text, re.DOTALL)
    if root_pattern:
        try:
            return json.loads(root_pattern.group(1))
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

def analyze_frame(image_path, people_count=0):
    """Interroga il server MLX passando l'immagine base64 (Retry Sync)."""
    base64_image = encode_image_to_base64(image_path)
    if not base64_image:
        return None
    dynamic_prompt = PROMPT_TEXT.format(people_count=people_count)
        
    payload = {
        "model": "mlx-community/gemma-4-e4b-it-4bit", # Identificativo completo HuggingFace per MLX
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": dynamic_prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        }
                    }
                ]
            }
        ],
        "max_tokens": 512,
        "temperature": 0.2
    }
    
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.post(MLX_ENDPOINT, json=payload, timeout=TIMEOUT_SECONDS)
            response.raise_for_status()
            
            data = response.json()
            message_content = data['choices'][0]['message']['content']
            parsed_json = clean_json_response(message_content)
            
            if parsed_json:
                return parsed_json
            else:
                print(f"      [MLX Client] Errore Parsing JSON: Impossibile mappare la risposta.")
                
        except requests.exceptions.RequestException as e:
            print(f"      [MLX Client] Fallimento Rete (Tentativo {attempt}/{MAX_RETRIES}): {e}")
            
        # Retry Delay backoff
        if attempt < MAX_RETRIES:
            time.sleep(2)
            
    return None

def process_stringout_batch(json_path):
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
        
    print(f"🔄 Avvio processo batch MLX su {len(timeline)} segmenti. (Modalità: Sincrono-Sequenziale)")
    success_count = 0
    
    for idx, clip in enumerate(timeline):
        storyboard_path = clip.get("storyboard_path")
        
        if not storyboard_path or not os.path.exists(storyboard_path):
            continue
            
        print(f"   ► Analisi [{idx+1}/{len(timeline)}]: {os.path.basename(storyboard_path)} ...", end="", flush=True)
        
        # CHIAMATA SINCRONA MLX API
        people_count = clip.get("yolo_omniscient_data", {}).get("total_objects", 0)
        semantic_data = analyze_frame(storyboard_path, people_count)
        
        if semantic_data:
            print(" ✅ OK")
            # Inject 4 nested macro-objects from Gemma response
            cine = semantic_data.get("cinematography") or {}
            cont = semantic_data.get("continuity") or {}
            comm = semantic_data.get("commercial") or {}
            stor = semantic_data.get("story") or {}

            clip["cinematography"] = {
                "scene_description":   cine.get("scene_description", "ANALYSIS_FAILED"),
                "lighting_type":       cine.get("lighting_type", "ANALYSIS_FAILED"),
                "visual_quality_score": parse_quality_score(cine.get("visual_quality_score", 0)),
                "technical_flaws":     cine.get("technical_flaws", "")
            }
            clip["continuity"] = {
                "action_description":  cont.get("action_description", "ANALYSIS_FAILED"),
                "emotion_arc":         cont.get("emotion_arc", "ANALYSIS_FAILED"),
                "match_cut_potential": cont.get("match_cut_potential", False)
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
                "technical_flaws":      "ANALYSIS_FAILED"
            }
            clip["continuity"] = {
                "action_description":  "ANALYSIS_FAILED",
                "emotion_arc":         "ANALYSIS_FAILED",
                "match_cut_potential": False
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
        
    print(f"✅ MLX Client Completato. Elaborate {success_count}/{len(timeline)} clip con successo.")
