import os
import json
import numpy as np
from scipy.io import wavfile

MOCK_MODE = True

def generate_bgm(stringout_json_path, output_dir, sequence_name):
    print(f"🎵 BGM Generator: Avvio analisi per {sequence_name}")
    
    # Estrazione keywords
    keywords = set()
    try:
        if os.path.exists(stringout_json_path):
            with open(stringout_json_path, 'r') as f:
                data = json.load(f)
                for clip in data.get("stringout_timeline", []):
                    if clip.get("is_usable") is not False:
                        if clip.get("scene_and_lighting"):
                            words = [w.strip() for w in clip["scene_and_lighting"].split(",") if len(w.strip()) > 3]
                            keywords.update(words[:2])
                        if clip.get("action_continuity"):
                            words = [w.strip() for w in clip["action_continuity"].split(",") if len(w.strip()) > 3]
                            keywords.update(words[:2])
    except Exception as e:
        print(f"⚠️ Errore lettura stringout per keywords: {e}")

    # Costruzione Prompt
    base_prompt = ", ".join(list(keywords)[:5]) if keywords else "dynamic scene"
    full_prompt = f"{base_prompt}, cinematic, rhythmic, clear percussion, upbeat, 120 bpm"
    print(f"🎵 Prompt generato: {full_prompt}")

    os.makedirs(output_dir, exist_ok=True)
    bgm_path = os.path.join(output_dir, f"{sequence_name}_bgm.wav")

    if MOCK_MODE:
        print("🎵 MOCK_MODE=True: Generazione synthetic click track (120 BPM, 60s)")
        sample_rate = 44100
        duration = 60
        t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
        # 120 BPM = 2 beats per second = 1 beat every 0.5s
        audio = np.zeros_like(t)
        for i in range(0, duration * 2):
            click_start = int(i * 0.5 * sample_rate)
            click_end = click_start + int(0.01 * sample_rate) # 10ms click
            if click_end < len(audio):
                # Synth click: 1kHz tone with decay
                tone = np.sin(2 * np.pi * 1000 * t[click_start:click_end])
                decay = np.linspace(1, 0, len(tone))
                audio[click_start:click_end] = tone * decay

        # Normalizza a 16-bit PCM
        audio_int16 = np.int16(audio * 32767)
        wavfile.write(bgm_path, sample_rate, audio_int16)
        print(f"✅ BGM Mock salvato in {bgm_path}")
        return bgm_path

    # Inference reale con MusicGen
    print("🎵 MOCK_MODE=False: Caricamento modello facebook/musicgen-small...")
    try:
        from transformers import AutoProcessor, MusicgenForConditionalGeneration
        import torch

        processor = AutoProcessor.from_pretrained("facebook/musicgen-small")
        model = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-small")
        
        inputs = processor(
            text=[full_prompt],
            padding=True,
            return_tensors="pt",
        )
        
        # Generazione (1500 tokens ~ 30 secondi)
        audio_values = model.generate(**inputs, max_new_tokens=1500)
        
        sampling_rate = model.config.audio_encoder.sampling_rate
        audio_np = audio_values[0, 0].cpu().numpy()
        
        wavfile.write(bgm_path, sampling_rate, audio_np)
        print(f"✅ BGM generato salvato in {bgm_path}")
        
    except ImportError:
        print("❌ ERRORE: Librerie mancanti per MusicGen. Esegui 'pip install transformers'")
    except Exception as e:
        print(f"❌ ERRORE durante la generazione BGM: {e}")

    return bgm_path
