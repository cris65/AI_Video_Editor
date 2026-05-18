import os
import json
import numpy as np

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
                "audio_duration": float(audio_duration),
                "waveform": waveform,
                "beats": beats_list
            }, f, indent=2)
            
        print(f"✅ Beats salvati in {beats_json_path}")
        return beats_json_path
        
    except ImportError:
        print("❌ ERRORE: librosa non installato. (Fallback su beat simulati per MOCK_MODE)")
        beats_list = [float(i * 0.5) for i in range(120)] # 120 bpm = 0.5s inter-beat
        import math
        import random
        # Genera una finta waveform molto frastagliata (tipo Premiere) a 2000 punti
        mock_waveform = []
        for i in range(2000):
            base = abs(math.sin(i / 50.0)) * 0.5
            spike = random.random() * 0.5 if random.random() > 0.8 else random.random() * 0.1
            mock_waveform.append(float(min(1.0, base + spike + 0.05)))
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
