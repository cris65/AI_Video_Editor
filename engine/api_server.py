"""
FastAPI Server Initialization (The Surveyor)
Provides hardware profiling and API gateway functions.
"""
import platform
import psutil
import subprocess
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

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
    # psutil will return logical processors if physical is not found
    physical_cores = psutil.cpu_count(logical=False) or psutil.cpu_count(logical=True)
    
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

if __name__ == "__main__":
    # Start the server on the strictly confirmed port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
