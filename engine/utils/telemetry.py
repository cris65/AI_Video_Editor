import os
import json
import time
import math

LOG_FILE = os.path.join(os.path.dirname(__file__), '..', 'logs', 'telemetry.json')
EMA_N = 5
EMA_ALPHA = 2 / (EMA_N + 1)

def _ensure_log_exists():
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, 'w') as f:
            json.dump({}, f)

def log_execution(task_type: str, weight: float, duration_sec: float):
    """
    Registra l'esecuzione di un task per affinare l'algoritmo EMA.
    task_type: 'audio_analysis', 'video_extraction', 'llm_inference'
    weight: MB per l'audio/video, numero di clip per LLM
    """
    if weight <= 0:
        return
        
    _ensure_log_exists()
    try:
        with open(LOG_FILE, 'r') as f:
            data = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        data = {}
        
    if task_type not in data:
        data[task_type] = []
        
    ratio = duration_sec / weight
    record = {
        "timestamp": time.time(),
        "weight": round(weight, 2),
        "duration_sec": round(duration_sec, 2),
        "ratio": round(ratio, 4)
    }
    
    data[task_type].append(record)
    
    # Manteniamo solo gli ultimi 50 record per task
    if len(data[task_type]) > 50:
        data[task_type] = data[task_type][-50:]
        
    with open(LOG_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def get_estimated_eta(task_type: str, weight: float) -> int:
    """
    Ritorna la stima dei secondi richiesti basandosi sullo storico EMA.
    """
    _ensure_log_exists()
    
    # Fallback conservativi (sec per unita' di weight)
    fallbacks = {
        "audio_analysis": 1.0,   # sec / MB
        "video_extraction": 0.5, # sec / MB
        "llm_inference": 2.0     # sec / clip
    }
    fallback_ratio = fallbacks.get(task_type, 1.0)
    
    try:
        with open(LOG_FILE, 'r') as f:
            data = json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return max(1, math.ceil(weight * fallback_ratio))
        
    records = data.get(task_type, [])
    if not records:
        return max(1, math.ceil(weight * fallback_ratio))
        
    # Calcolo EMA: y_t = (x_t * alpha) + (y_{t-1} * (1 - alpha))
    ema = records[0]["ratio"]
    for record in records[1:]:
        ema = (record["ratio"] * EMA_ALPHA) + (ema * (1 - EMA_ALPHA))
        
    return max(1, math.ceil(weight * ema))
