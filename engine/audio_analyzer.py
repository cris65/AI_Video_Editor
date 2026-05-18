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
        
        with open(beats_json_path, 'w') as f:
            json.dump({
                "tempo": tempo_val,
                "beats": beats_list
            }, f, indent=2)
            
        print(f"✅ Beats salvati in {beats_json_path}")
        return beats_json_path
        
    except ImportError:
        print("❌ ERRORE: librosa non installato. (Fallback su beat simulati per MOCK_MODE)")
        beats_list = [float(i * 0.5) for i in range(120)] # 120 bpm = 0.5s inter-beat
        with open(beats_json_path, 'w') as f:
            json.dump({
                "tempo": 120.0,
                "beats": beats_list
            }, f, indent=2)
        return beats_json_path
    except Exception as e:
        print(f"❌ ERRORE durante l'estrazione dei beat: {e}")
        return None
