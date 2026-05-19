import os
import json
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HISTORY_FILE = os.path.join(BASE_DIR, 'output', 'performance_history.json')

def record_run(vlm_model_id: str, total_frames: int, extracted_frames: int, cv_duration: float, mlx_duration: float):
    """
    Saves performance stats of a completed run to history for self-correction.
    """
    os.makedirs(os.path.dirname(HISTORY_FILE), exist_ok=True)
    
    new_record = {
        "vlm_model_id": vlm_model_id,
        "total_frames": total_frames,
        "extracted_frames": extracted_frames,
        "cv_duration": cv_duration,
        "mlx_duration": mlx_duration,
        "total_duration": cv_duration + mlx_duration,
        "timestamp": datetime.now().isoformat()
    }
    
    history = []
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r') as f:
                history = json.load(f)
                if not isinstance(history, list):
                    history = []
        except Exception:
            history = []
            
    history.append(new_record)
    
    try:
        with open(HISTORY_FILE, 'w') as f:
            json.dump(history, f, indent=2)
    except Exception as e:
        print(f"⚠️ Failed to write performance history: {e}")

def estimate_duration(vlm_model_id: str, total_frames: int, extracted_frames: int) -> float:
    """
    Estimates duration using past performance data for the specific model.
    Falls back to smart defaults if no history is found.
    """
    # Default parameters:
    # CV: 0.025s per extracted frame
    # MLX: 3.0s per clip (where clip count is total_frames / 100)
    default_cv_speed = 0.025
    default_mlx_speed = 3.0
    
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r') as f:
                history = json.load(f)
        except Exception:
            history = []
            
        # Filter records for the same vlm_model_id
        matching_records = [r for r in history if r.get("vlm_model_id") == vlm_model_id]
        
        if len(matching_records) > 0:
            total_cv_duration = sum(r["cv_duration"] for r in matching_records)
            total_extracted = sum(r["extracted_frames"] for r in matching_records)
            total_mlx_duration = sum(r["mlx_duration"] for r in matching_records)
            total_src_frames = sum(r["total_frames"] for r in matching_records)
            
            cv_speed = total_cv_duration / max(1, total_extracted)
            mlx_speed = total_mlx_duration / max(1, (total_src_frames / 100.0))
            
            # Bound values to prevent anomalies
            cv_speed = max(0.001, min(0.5, cv_speed))
            mlx_speed = max(0.1, min(30.0, mlx_speed))
            
            estimated_cv = extracted_frames * cv_speed
            estimated_mlx = (total_frames / 100.0) * mlx_speed
            return estimated_cv + estimated_mlx
            
    # Fallback to default estimation formula
    estimated_cv = extracted_frames * default_cv_speed
    estimated_mlx = (total_frames / 100.0) * default_mlx_speed
    return estimated_cv + estimated_mlx
