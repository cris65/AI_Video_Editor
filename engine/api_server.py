"""
FastAPI Server Initialization (The Surveyor)
Provides hardware profiling and API gateway functions.
"""
import platform
import psutil
import subprocess
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Literal, Union
import uvicorn
import os
import director as director_module
import logging

class ProgressEndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return record.getMessage().find("/api/phase-a/progress") == -1

logging.getLogger("uvicorn.access").addFilter(ProgressEndpointFilter())

app = FastAPI(title="AI Video Editor Engine API", version="0.1.0")

# Allow requests from the local Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/system/profiler")
async def get_system_profiler():
    """
    Rigorously detects the hardware of the host machine and returns
    a proportional JSON contract containing theoretical inference speeds.
    """
    system_os = platform.system()
    machine = platform.machine()
    cores = psutil.cpu_count(logical=False) or psutil.cpu_count(logical=True)
    physical_cores = cores if cores is not None else 4
    
    # Calculate exact total RAM in GB
    total_ram_gb = round(psutil.virtual_memory().total / (1024**3))
    
    # Defaults for a generic machine
    hardware_detected = f"Generic {system_os} ({physical_cores} Cores) - {total_ram_gb}GB RAM"
    base_inference_4b = 0.25
    base_inference_31b = 2.5
    
    # Apple Silicon detection heuristics
    if system_os == "Darwin" and machine == "arm64":
        # Attempt to get exact Apple Silicon model (e.g. "Apple M4 Max")
        try:
            exact_cpu = subprocess.check_output(['sysctl', '-n', 'machdep.cpu.brand_string']).decode('utf-8').strip()
        except Exception:
            exact_cpu = "Apple Silicon"
            
        hardware_detected = f"{exact_cpu} ({physical_cores} Cores) - {total_ram_gb}GB Unified RAM"
        
        if physical_cores >= 14:
            # Extremely fast inference on high-end M-series
            base_inference_4b = 0.10
            base_inference_31b = 1.2
        elif physical_cores >= 8:
            # Standard fast inference on M1/M2/M3/M4 base
            base_inference_4b = 0.15
            base_inference_31b = 1.8
        else:
            base_inference_4b = 0.20
            base_inference_31b = 2.0
    elif system_os == "Darwin" and machine == "x86_64":
        hardware_detected = f"Intel Mac ({physical_cores} Cores)"
        # Slower legacy inference
        base_inference_4b = 0.50
        base_inference_31b = 5.0
    elif system_os == "Windows" or system_os == "Linux":
        if physical_cores >= 16:
            hardware_detected = f"High-End Workstation ({physical_cores} Cores)"
            base_inference_4b = 0.15
            base_inference_31b = 1.8
        elif physical_cores >= 8:
            hardware_detected = f"Mid-Range PC ({physical_cores} Cores)"
            base_inference_4b = 0.30
            base_inference_31b = 3.0
            
    # Rigorous JSON contract format required by the frontend React application
    return {
        "hardware_detected": hardware_detected,
        "inference_time_4b": base_inference_4b,
        "inference_time_31b": base_inference_31b
    }

class UserConstraint(BaseModel):
    type: Literal['IN', 'OUT', 'BM']
    time: float

class DirectorConfigPayload(BaseModel):
    ai_model: Optional[Literal['gemma-4-4b', 'gemma-4-31b']] = 'gemma-4-4b'
    target_duration: float = 60.0
    style_prompt: str = ""
    export_resolution: Optional[str] = "1920x1080"
    analysis_fps: Optional[float] = 0.5
    target_product: Optional[str] = None
    expected_subjects: Optional[int] = None
    secondary_elements: Optional[str] = None
    ignore_list: Optional[str] = None
    safe_zone_margin: Optional[float] = None
    seed: int = Field(default=-1, description="-1 = random, any positive integer = deterministic")

class LockedClipOverride(BaseModel):
    """Structured lock object sent by the HITL frontend for manually anchored clips."""
    action: Literal['KEEP', 'TRASH', 'BROLL', 'LOCKED'] = 'LOCKED'
    locked: bool = False
    absolute_in: Optional[float] = None    # source_in at lock time (seconds, source space)
    absolute_out: Optional[float] = None   # source_out at lock time (seconds, source space)
    timeline_position: Optional[float] = None  # timeline_in absolute (seconds)

class OrchestratePayload(BaseModel):
    sequence_name: str
    hitl_constraints: dict[str, list[UserConstraint]] = {}
    # Accepts both legacy string overrides ('KEEP'/'TRASH'/'BROLL') and structured lock objects
    clip_overrides: dict[str, Union[LockedClipOverride, Literal['KEEP', 'TRASH', 'BROLL']]] = {}
    director_config: DirectorConfigPayload = DirectorConfigPayload()

@app.post("/api/orchestrate")
async def orchestrate_director_cut(payload: OrchestratePayload):
    """
    Triggers Phase D (AI Director) exclusively.
    The heavy compute (Phases A/B) is already done. This only rearranges JSON.
    Expected latency: < 1 second.
    """
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DIR_OUTPUT = os.path.join(BASE_DIR, 'output')
    seq_llm_dir = os.path.join(DIR_OUTPUT, payload.sequence_name, "LLM_Export_Package")

    stringout_path = os.path.join(seq_llm_dir, f"{payload.sequence_name}_stringout.json")
    hitl_path      = os.path.join(seq_llm_dir, f"{payload.sequence_name}_hitl_data.json")
    beats_path     = os.path.join(seq_llm_dir, f"{payload.sequence_name}_audio_beats.json")

    if not os.path.exists(stringout_path):
        return {"ok": False, "error": f"Stringout not found: {stringout_path}"}

    # Inject seed into director config for downstream LLM call
    director_cfg_dict = payload.director_config.model_dump()
    seed = director_cfg_dict.get("seed", -1)

    # Normalize clip_overrides: convert LockedClipOverride objects to dict for director.py
    normalized_overrides: dict = {}
    for key, val in payload.clip_overrides.items():
        if isinstance(val, str):
            normalized_overrides[key] = val
        elif isinstance(val, LockedClipOverride):
            normalized_overrides[key] = val.model_dump()

    # Write HITL data to disk so director.py can consume it
    import json as _json
    hitl_payload = {
        "hitl_constraints": {k: [c.model_dump() for c in v] for k, v in payload.hitl_constraints.items()},
        "clip_overrides": normalized_overrides,
        "director_config": director_cfg_dict,
    }
    try:
        with open(hitl_path, 'w') as f:
            _json.dump(hitl_payload, f, indent=2)
    except Exception as write_err:
        return {"ok": False, "error": f"Failed to write HITL data: {write_err}"}

    try:
        output_path = director_module.generate_final_cut(
            stringout_path=stringout_path,
            hitl_path=hitl_path,
            beats_path=beats_path,
            output_dir=seq_llm_dir,
            sequence_name=payload.sequence_name,
            seed=seed,
        )
        return {"ok": True, "output_path": output_path}
    except Exception as e:
        return {"ok": False, "error": str(e)}

if __name__ == "__main__":
    # Start the server on the strictly confirmed port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)

class PhaseAPayload(BaseModel):
    video_proxy_path: str
    sequence_file_path: str
    sampling_density_percent: float = 0.15
    vlm_model_id: str = "google/gemma-4-E4B-it"
    llm_model_id: str = "google/gemma-4-9b-it"

@app.get("/api/video-info")
async def get_video_info(path: str):
    import cv2
    import os
    if not os.path.exists(path):
        return {"error": "File not found"}
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        return {"error": "Could not open video"}
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    cap.release()
    duration = total_frames / fps if fps > 0 else 0
    return {
        "fps": fps,
        "duration": duration,
        "total_frames": total_frames
    }

from fastapi import BackgroundTasks
import edl_parser
import pancake_editor

TASK_PROGRESS = {
    "status": "idle",
    "phase": "",
    "percent": 0,
    "message": "",
    "sequence_name": "",
    "start_time": None,
    "end_time": None,
    "elapsed_seconds": 0
}

@app.get("/api/phase-a/progress")
async def get_phase_a_progress():
    global TASK_PROGRESS
    import time
    from datetime import datetime
    if TASK_PROGRESS["status"] == "running" and TASK_PROGRESS["start_time"]:
        try:
            start_dt = datetime.fromisoformat(TASK_PROGRESS["start_time"])
            elapsed = (datetime.now() - start_dt).total_seconds()
            TASK_PROGRESS["elapsed_seconds"] = int(elapsed)
        except Exception:
            pass
    return TASK_PROGRESS

def run_phase_a_background(video_path: str, edl_path: str, density: float, vlm_model_id: str, llm_model_id: str):
    global TASK_PROGRESS
    import time
    from datetime import datetime
    import performance_tracker
    
    session_start_dt = datetime.now()
    start_t = time.time()
    try:
        import os
        sequence_name, clip_map = edl_parser.parse_ingest_edl(edl_path)
        
        TASK_PROGRESS["status"] = "running"
        TASK_PROGRESS["sequence_name"] = sequence_name
        TASK_PROGRESS["percent"] = 0
        TASK_PROGRESS["message"] = "Inizializzazione in corso..."
        TASK_PROGRESS["start_time"] = datetime.now().isoformat()
        TASK_PROGRESS["end_time"] = None
        TASK_PROGRESS["elapsed_seconds"] = 0
        
        def update_progress(phase, percent, message):
            TASK_PROGRESS["phase"] = phase
            TASK_PROGRESS["percent"] = percent
            TASK_PROGRESS["message"] = message
            TASK_PROGRESS["elapsed_seconds"] = int(time.time() - start_t)

        # Get total frames of video for tracking
        import cv2
        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) if cap.isOpened() else 0
        cap.release()
        
        extracted_frames = max(1, int(total_frames * density))

        # Track Phase A OpenCV duration
        cv_start = time.time()
        editor = pancake_editor.PancakeEditor(sequence_name, clip_map, sampling_density_percent=density, vlm_model_id=vlm_model_id, llm_model_id=llm_model_id)
        timeline, trash_timeline = editor.process_video(video_path, progress_callback=update_progress)
        json_path = editor.generate_json(timeline, trash_timeline)
        editor.generate_preview(video_path, timeline)
        editor.generate_trash_preview(video_path, trash_timeline)
        package_dir = editor._export_director_package()
        cv_duration = time.time() - cv_start
        print(f"✅ Phase A background task completed for {sequence_name} in {cv_duration:.2f}s")

        # Track Phase B MLX duration
        mlx_start = time.time()
        import mlx_client
        exported_json_path = os.path.join(package_dir, os.path.basename(json_path))
        print(f"🚀 Avvio MLX Client su: {exported_json_path}")
        mlx_client.process_stringout_batch(exported_json_path, progress_callback=update_progress)
        mlx_duration = time.time() - mlx_start
        print(f"✅ Phase B MLX task completed for {sequence_name} in {mlx_duration:.2f}s")
        
        session_end_dt = datetime.now()
        # Save performance metrics to local JSON history for self-correction
        performance_tracker.record_run(
            vlm_model_id=vlm_model_id,
            session_start_time=session_start_dt.isoformat(),
            session_end_time=session_end_dt.isoformat(),
            total_frames=total_frames,
            extracted_frames=extracted_frames,
            cv_duration_sec=cv_duration,
            mlx_duration_sec=mlx_duration
        )
        
        # Archiving source files to target output folder
        import shutil
        try:
            if os.path.exists(video_path):
                dest_video = os.path.join(editor.output_dir, os.path.basename(video_path))
                print(f"📦 Moving original video source from {video_path} to {dest_video}")
                shutil.move(video_path, dest_video)
            if os.path.exists(edl_path):
                dest_edl = os.path.join(editor.output_dir, os.path.basename(edl_path))
                print(f"📦 Moving original EDL source from {edl_path} to {dest_edl}")
                shutil.move(edl_path, dest_edl)
        except Exception as archive_err:
            print(f"⚠️ Failed to archive source files to {editor.output_dir}: {archive_err}")
        
        end_t = time.time()
        TASK_PROGRESS["status"] = "completed"
        TASK_PROGRESS["percent"] = 100
        TASK_PROGRESS["message"] = "Pipeline completata con successo"
        TASK_PROGRESS["end_time"] = datetime.now().isoformat()
        TASK_PROGRESS["elapsed_seconds"] = int(end_t - start_t)
        print(f"✅ Phase A/B complete pipeline finished for {sequence_name} in {end_t - start_t:.2f}s")
    except Exception as e:
        TASK_PROGRESS["status"] = "error"
        TASK_PROGRESS["message"] = f"Errore critico: {e}"
        TASK_PROGRESS["end_time"] = datetime.now().isoformat()
        TASK_PROGRESS["elapsed_seconds"] = int(time.time() - start_t)
        print(f"❌ Phase A background task failed: {e}")

@app.post("/api/phase-a/run")
async def run_phase_a(payload: PhaseAPayload, background_tasks: BackgroundTasks):
    import os
    if not os.path.exists(payload.video_proxy_path) or not os.path.exists(payload.sequence_file_path):
        return {"ok": False, "error": "Paths do not exist"}
    background_tasks.add_task(
        run_phase_a_background, 
        payload.video_proxy_path, 
        payload.sequence_file_path, 
        payload.sampling_density_percent,
        payload.vlm_model_id,
        payload.llm_model_id
    )
    return {"ok": True, "status": "Engine Started"}

@app.get("/api/phase-a/estimate")
async def get_duration_estimate(total_frames: int, density: float, vlm_model_id: str):
    import performance_tracker
    extracted_frames = max(1, int(total_frames * density))
    est = performance_tracker.estimate_duration(vlm_model_id, total_frames, extracted_frames)
    return {"estimated_seconds": est}

@app.get("/api/performance/history")
async def get_performance_history():
    import performance_tracker
    import os, json
    if os.path.exists(performance_tracker.HISTORY_FILE):
        try:
            with open(performance_tracker.HISTORY_FILE, 'r') as f:
                history = json.load(f)
                return history
        except Exception as e:
            return {"error": f"Failed to read history: {e}"}
    return []



@app.get("/api/videos/list")
async def list_videos():
    import os, glob
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DIR_INPUT = os.path.join(BASE_DIR, 'input')
    DIR_OUTPUT = os.path.join(BASE_DIR, 'output')
    video_exts = ('*.mp4', '*.mov', '*.mxf', '*.avi', '*.mkv')
    
    vid_files = []
    for ext in video_exts:
        vid_files.extend(glob.glob(os.path.join(DIR_INPUT, ext)))
        vid_files.extend(glob.glob(os.path.join(DIR_INPUT, ext.upper())))
        
    edl_files = glob.glob(os.path.join(DIR_INPUT, '*.edl'))
    edl_path = edl_files[0] if edl_files else ""
    
    # Try to parse sequence name from input EDL
    seq_name_from_edl = ""
    if edl_path:
        try:
            import edl_parser
            seq_name_from_edl, _ = edl_parser.parse_ingest_edl(edl_path)
        except Exception:
            pass
            
    results = []
    
    # 1. Add unprocessed files from input directory
    for vf in vid_files:
        import cv2
        cap = cv2.VideoCapture(vf)
        fps = cap.get(cv2.CAP_PROP_FPS) if cap.isOpened() else 0
        total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) if cap.isOpened() else 0
        duration = total_frames / fps if fps > 0 else 0
        cap.release()
        results.append({
            "name": os.path.basename(vf),
            "video_path": vf,
            "edl_path": edl_path,
            "fps": fps,
            "duration": duration,
            "total_frames": total_frames,
            "processed": False,
            "sequence_name": seq_name_from_edl if seq_name_from_edl else os.path.splitext(os.path.basename(vf))[0]
        })
        
    # 2. Add already processed sequences from output directory
    if os.path.exists(DIR_OUTPUT):
        for item in os.listdir(DIR_OUTPUT):
            item_path = os.path.join(DIR_OUTPUT, item)
            if os.path.isdir(item_path):
                # A valid processed sequence must contain its stringout JSON file
                stringout_json = os.path.join(item_path, "LLM_Export_Package", f"{item}_stringout.json")
                if os.path.exists(stringout_json):
                    # Search for the moved video and EDL in the output sequence folder
                    vid_search = []
                    for ext in video_exts:
                        vid_search.extend(glob.glob(os.path.join(item_path, ext)))
                        vid_search.extend(glob.glob(os.path.join(item_path, ext.upper())))
                    
                    vid_p = vid_search[0] if vid_search else ""
                    edl_search = glob.glob(os.path.join(item_path, '*.edl'))
                    edl_p = edl_search[0] if edl_search else ""
                    
                    fps = 25.0
                    total_frames = 0
                    duration = 0
                    if vid_p:
                        import cv2
                        cap = cv2.VideoCapture(vid_p)
                        fps = cap.get(cv2.CAP_PROP_FPS) if cap.isOpened() else 25.0
                        total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) if cap.isOpened() else 0
                        duration = total_frames / fps if fps > 0 else 0
                        cap.release()
                        
                    results.append({
                        "name": f"{item} (PROCESSED)",
                        "video_path": vid_p,
                        "edl_path": edl_p,
                        "fps": fps,
                        "duration": duration,
                        "total_frames": total_frames,
                        "processed": True,
                        "sequence_name": item
                    })
                    
    return {"clips": results}
