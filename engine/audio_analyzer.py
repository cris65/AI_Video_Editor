import os
import json
import numpy as np
from utils.telemetry import log_execution

def extract_beats(wav_path, output_dir, sequence_name):
    print(f"🥁 Audio Analyzer: Estrazione transienti da {os.path.basename(wav_path)}")
    
    beats_json_path = os.path.join(output_dir, f"{sequence_name}_audio_beats.json")
    
    if not os.path.exists(wav_path):
        print(f"❌ ERRORE: File audio non trovato: {wav_path}")
        return None
        
    try:
        import librosa
        
        # Carica l'audio
        y, sr = librosa.load(wav_path, sr=None)
        
        # Estrai i beat
        print("🥁 Audio Analyzer: Esecuzione librosa.beat.beat_track...")
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        
        # Converti frame in secondi
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        
        beats_list = [float(b) for b in beat_times]
        
        # Gestione tempo (può essere un float o un ndarray in base alla versione di librosa)
        if isinstance(tempo, np.ndarray):
            tempo_val = float(tempo[0])
        else:
            tempo_val = float(tempo)
            
        print(f"🥁 Trovati {len(beats_list)} beat (Tempo stimato: {tempo_val:.2f} BPM)")
        
        # Calcolo dell'energia (waveform RMS)
        print("🥁 Audio Analyzer: Estrazione Waveform...")
        audio_duration = librosa.get_duration(y=y, sr=sr)
        rms = librosa.feature.rms(y=y)[0]
        
        # Normalizzazione tra 0.0 e 1.0
        max_rms = np.max(rms)
        if max_rms > 0:
            rms_norm = rms / max_rms
        else:
            rms_norm = rms
            
        # Riduzione a max 2000 punti per il frontend (alta risoluzione tipo Premiere)
        target_points = 2000
        if len(rms_norm) > target_points:
            chunks = np.array_split(rms_norm, target_points)
            waveform = [float(np.max(chunk)) for chunk in chunks]
        else:
            waveform = [float(val) for val in rms_norm]
        
        with open(beats_json_path, 'w') as f:
            json.dump({
                "tempo": tempo_val,
                "audio_duration": audio_duration,
                "waveform": waveform,
                "beats": beats_list
            }, f, indent=2)
            
        print(f"✅ Beats salvati in {beats_json_path}")
        return beats_json_path
        
    except ImportError:
        print("❌ ERRORE: librosa non installato. (Fallback su beat simulati per MOCK_MODE)")
        beats_list = [(i * 0.5) for i in range(120)] # 120 bpm = 0.5s inter-beat
        import math
        import random
        # Genera una finta waveform molto frastagliata (tipo Premiere) a 2000 punti
        mock_waveform = []
        for i in range(2000):
            base = abs(math.sin(i / 50.0)) * 0.5
            spike = random.random() * 0.5 if random.random() > 0.8 else random.random() * 0.1
            mock_waveform.append(min(1.0, base + spike + 0.05))
        with open(beats_json_path, 'w') as f:
            json.dump({
                "tempo": 120.0,
                "audio_duration": 60.0,
                "waveform": mock_waveform,
                "beats": beats_list
            }, f, indent=2)
        return beats_json_path
    except Exception as e:
        print(f"❌ ERRORE durante l'estrazione dei beat: {e}")
        return None

def analyze_audio_for_api(filename: str, project_id: str):
    """
    Analyzes an audio file from engine/input/ and exports a JSON for the LLM Director.
    Required format:
    {
      "project_id": "string",
      "bpm": 124.5,
      "total_duration_sec": 180.2,
      "beats": [ {"time": 0.45, "energy": 0.8}, ... ]
    }
    """
    print(f"🥁 API Audio Analyzer: Avvio analisi per {filename} (Project: {project_id})")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_dir = os.path.join(base_dir, 'input')
    output_dir = os.path.join(base_dir, 'output', project_id, 'LLM_Export_Package')
    
    wav_path = os.path.join(input_dir, filename)
    beats_json_path = os.path.join(output_dir, f"{project_id}_audio_beats.json")
    
    if not os.path.exists(wav_path):
        raise FileNotFoundError(f"File audio non trovato: {wav_path}")
        
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        import librosa
        import time
        start_time = time.time()
        
        # Caricamento audio
        y, sr = librosa.load(wav_path, sr=None)
        audio_duration = librosa.get_duration(y=y, sr=sr)
        
        print("🥁 Estrazione BPM e transienti via librosa (Omni-Analysis)...")
        # Step A: HPSS (Harmonic-Percussive Source Separation)
        print("   ↳ Separazione Armonica/Percussiva in corso (potrebbe richiedere tempo)...")
        y_harmonic, y_percussive = librosa.effects.hpss(y)
        
        raw_markers = []
        
        # Step B1: Percussive Markers
        onset_env_p = librosa.onset.onset_strength(y=y_percussive, sr=sr)
        frames_p = librosa.onset.onset_detect(onset_envelope=onset_env_p, sr=sr, backtrack=True)
        times_p = librosa.frames_to_time(frames_p, sr=sr)
        max_e_p = np.max(onset_env_p) if len(onset_env_p) > 0 and np.max(onset_env_p) > 0 else 1.0
        for i, frame in enumerate(frames_p):
            safe_frame = min(frame, len(onset_env_p) - 1)
            raw_markers.append({
                "time": float(times_p[i]),
                "energy": float(onset_env_p[safe_frame] / max_e_p),
                "type": "percussive"
            })
            
        # Step B2: Harmonic Markers
        onset_env_h = librosa.onset.onset_strength(y=y_harmonic, sr=sr)
        frames_h = librosa.onset.onset_detect(onset_envelope=onset_env_h, sr=sr, backtrack=True)
        times_h = librosa.frames_to_time(frames_h, sr=sr)
        max_e_h = np.max(onset_env_h) if len(onset_env_h) > 0 and np.max(onset_env_h) > 0 else 1.0
        for i, frame in enumerate(frames_h):
            safe_frame = min(frame, len(onset_env_h) - 1)
            raw_markers.append({
                "time": float(times_h[i]),
                "energy": float(onset_env_h[safe_frame] / max_e_h),
                "type": "harmonic"
            })
            
        # Step B3: Beat Grid (Metronome)
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        if isinstance(tempo, np.ndarray):
            tempo_val = float(tempo[0])
        else:
            tempo_val = float(tempo)
            
        onset_env_b = librosa.onset.onset_strength(y=y, sr=sr)
        times_b = librosa.frames_to_time(beat_frames, sr=sr)
        max_e_b = np.max(onset_env_b) if len(onset_env_b) > 0 and np.max(onset_env_b) > 0 else 1.0
        for i, frame in enumerate(beat_frames):
            safe_frame = min(frame, len(onset_env_b) - 1)
            raw_markers.append({
                "time": float(times_b[i]),
                "energy": float(onset_env_b[safe_frame] / max_e_b),
                "type": "beat"
            })
            
        # Step C: Unified Timeline & Deduplication
        raw_markers.sort(key=lambda x: x["time"])
        
        beats_list = []
        MERGE_WINDOW = 0.05  # 50ms
        
        for marker in raw_markers:
            if not beats_list:
                beats_list.append(marker)
                continue
                
            last_marker = beats_list[-1]
            if marker["time"] - last_marker["time"] <= MERGE_WINDOW:
                # Merge markers
                prev_energy = last_marker["energy"]
                last_marker["energy"] = max(last_marker["energy"], marker["energy"])
                # Combine types without duplicating
                types_set = set(last_marker["type"].split("_"))
                types_set.add(marker["type"])
                last_marker["type"] = "_".join(sorted(list(types_set)))
                # Update time to the exact point of highest energy
                if marker["energy"] > prev_energy:
                    last_marker["time"] = marker["time"]
            else:
                beats_list.append(marker)
                
        # Round the final list for JSON
        for b in beats_list:
            b["time"] = float(round(b["time"], 3))
            b["energy"] = float(round(b["energy"], 3))
            
        print("🥁 Estrazione lightweight dual waveform per la UI...")
        points_per_sec = 80
        chunk_size = int(sr / points_per_sec)
        
        amplitude_waveform = []
        energy_waveform = []
        
        if len(y) > 0:
            for i in range(0, len(y), chunk_size):
                chunk = y[i:i+chunk_size]
                if len(chunk) > 0:
                    amplitude_waveform.append(float(round(np.max(np.abs(chunk)), 3)))
                    
            # Extract smoothed rhythmic energy waveform using onset_env_b
            if len(onset_env_b) > 0:
                # onset_env_b is already calculated using librosa.onset.onset_strength
                # It has a different length than y, so we need to resample/chunk it to 80 pts/sec
                # librosa's hop_length defaults to 512.
                hop_length = 512
                frames_per_sec = sr / hop_length
                env_chunk_size = max(1, int(frames_per_sec / points_per_sec))
                
                for i in range(0, len(onset_env_b), env_chunk_size):
                    env_chunk = onset_env_b[i:i+env_chunk_size]
                    if len(env_chunk) > 0:
                        energy_waveform.append(float(round(np.max(env_chunk), 3)))
                        
                # Normalize energy waveform 0-1
                max_energy = max(energy_waveform) if energy_waveform else 1.0
                if max_energy > 0:
                    energy_waveform = [float(round(e / max_energy, 3)) for e in energy_waveform]
                    
            # Ensure equal lengths by padding or truncating
            min_len = min(len(amplitude_waveform), len(energy_waveform))
            if min_len > 0:
                amplitude_waveform = amplitude_waveform[:min_len]
                energy_waveform = energy_waveform[:min_len]
        
        elapsed_sec = time.time() - start_time
        
        payload = {
            "project_id": project_id,
            "bpm": round(tempo_val, 2),
            "total_duration_sec": round(audio_duration, 2),
            "beats": beats_list,
            "waveforms": {
                "amplitude": amplitude_waveform,
                "energy": energy_waveform
            },
            "processing_time_sec": round(elapsed_sec, 2)
        }
        
        with open(beats_json_path, 'w') as f:
            json.dump(payload, f, indent=2)
            
        size_mb = os.path.getsize(wav_path) / (1024 * 1024)
        log_execution("audio_analysis", size_mb, elapsed_sec)
        
        print(f"✅ Beats salvati in {beats_json_path} (Elaborazione in {elapsed_sec:.2f}s)")
        return payload
        
    except ImportError:
        print("❌ ERRORE: librosa non installato.")
        raise Exception("librosa non installato nel backend.")
    except Exception as e:
        print(f"❌ ERRORE durante l'analisi API: {e}")
        raise e
