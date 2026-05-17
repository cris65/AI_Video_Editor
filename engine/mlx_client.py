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
    "Sei un Senior Video Editor e Direttore della Fotografia. "
    "Stai analizzando una singola inquadratura video continua, mostrata attraverso 3 fotogrammi temporali in un'unica immagine: Sinistra (START), Centro (BEST MOMENT), Destra (END). "
    "REGOLA FONDAMENTALE SULLA CONTINUITÀ: Questa immagine rappresenta lo scorrere del tempo in una SINGOLA scena. I soggetti presenti a sinistra sono gli stessi che continuano la loro azione al centro e a destra. "
    "Il tuo compito è analizzare come la scena e i soggetti si muovono ed evolvono cronologicamente. "
    "Rispondi ESCLUSIVAMENTE con un blocco di codice JSON valido contenente le chiavi: 'scene_and_lighting', 'action_continuity', 'visual_quality_score', 'technical_flaws', 'is_usable'."
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

def analyze_frame(image_path):
    """Interroga il server MLX passando l'immagine base64 (Retry Sync)."""
    base64_image = encode_image_to_base64(image_path)
    if not base64_image:
        return None
        
    payload = {
        "model": "mlx-community/gemma-4-e4b-it-4bit", # Identificativo completo HuggingFace per MLX
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": PROMPT_TEXT},
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
        semantic_data = analyze_frame(storyboard_path)
        
        if semantic_data:
            print(" ✅ OK")
            # Iniezione chiavi forzata
            clip["scene_and_lighting"] = semantic_data.get("scene_and_lighting", "")
            clip["action_continuity"] = semantic_data.get("action_continuity", "")
            clip["visual_quality_score"] = semantic_data.get("visual_quality_score", 0)
            clip["technical_flaws"] = semantic_data.get("technical_flaws", "")
            clip["is_usable"] = semantic_data.get("is_usable", True)
            success_count += 1
        else:
            print(" ❌ Fallita")
            clip["scene_and_lighting"] = "ANALYSIS_FAILED"
            clip["action_continuity"] = "ANALYSIS_FAILED"
            clip["visual_quality_score"] = 0
            clip["technical_flaws"] = "ANALYSIS_FAILED"
            clip["is_usable"] = False
            
        # Sovrascrittura atomica progressiva del JSON (salvataggio immediato post-clip)
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        
    print(f"✅ MLX Client Completato. Elaborate {success_count}/{len(timeline)} clip con successo.")
