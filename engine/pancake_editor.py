import os
import cv2
import json
import numpy as np
from moviepy import VideoFileClip, concatenate_videoclips
from ultralytics import YOLO

# ==============================================================================
# SOGLIE E PARAMETRI (Calibrabili Iterativamente)
# ==============================================================================
# V5: Dynamic Backtrack. Tolleranze allargate, ma potatura sicura in uscita.
BLUR_THRESHOLD = 60.0        # Mantenuto a 60.0 per la profondità di campo
MOTION_THRESHOLD = 15.0      # Ripristinato da 10 a 15 (ingresso tollerato, tagliato via dopo)
MIN_CLIP_DURATION = 0.5      # Durata minima di una subclip (in secondi)
BACKTRACK_SECONDS = 0.5      # Secondi da sottrarre alla coda del segmento interrotto

# Soglie per la deduzione del Pacing Profile (Media Movimento)
PACING_CINEMATIC_MAX = 5.0   # Se media < 5 -> "cinematic"
PACING_STANDARD_MAX = 15.0   # Se media fra 5 e 15 -> "standard", oltre -> "social_fast"

# ==============================================================================
# CONFIGURAZIONE PATH E MODELLO
# ==============================================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_VIDEO_PATH = os.path.join(BASE_DIR, 'input.mp4')
OUTPUT_DIR = os.path.join(BASE_DIR, 'output')

# Output Path ora generati dinamicamente dentro process_pancake_video

def ensure_output_dir():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

# Inizializzazione YOLO
yolo_model = YOLO('yolov8n.pt')

# ==============================================================================
# FUNZIONI DI ANALISI E CONTROLLO
# ==============================================================================
def variance_of_laplacian(image):
    """Calcola la varianza del Laplaciano per misurare la nitidezza (focus)."""
    return cv2.Laplacian(image, cv2.CV_64F).var()

def analyze_video(video_path):
    """
    Analizza il video per estrarre due tracce separate:
    - Main Track (Solista)
    - B-Roll Track (Dettagli)
    """
    print(f"🔍 Avvio analisi V5 (Dynamic Backtrack) di: {video_path}")
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        raise ValueError(f"Impossibile aprire il file video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Invece di 'is_valid', memorizziamo lo stato per Main e B-Roll
    frame_data_main = []
    frame_data_broll = []
    global_motion_diffs = []
    
    ret, prev_frame = cap.read()
    if not ret:
        cap.release()
        return [], [], 0.0
        
    prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
    
    frame_idx = 1
    
    # Analizza il primo frame
    lap_var = variance_of_laplacian(prev_gray)
    is_blur = lap_var < BLUR_THRESHOLD
    
    is_main = False
    is_broll = False
    
    if not is_blur:
        # V5: Confidence tornata al default (niente paranoia mode)
        results = yolo_model(prev_frame, verbose=False)
        boxes = results[0].boxes
        person_count = sum(1 for box in boxes if int(box.cls[0]) == 0)
        
        if person_count == 1:
            is_main = True
        elif person_count == 0:
            is_broll = True
            
    frame_data_main.append((0.0, is_main))
    frame_data_broll.append((0.0, is_broll))
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        timestamp_sec = frame_idx / fps
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # 1. Calcolo Nitidezza e Movimento
        lap_var = variance_of_laplacian(gray)
        diff = cv2.absdiff(gray, prev_gray)
        motion_diff = np.mean(diff)
        global_motion_diffs.append(motion_diff)
        
        # 2. Controllo Tecnico
        is_blur = lap_var < BLUR_THRESHOLD
        is_shaky = motion_diff > MOTION_THRESHOLD
        
        is_main = False
        is_broll = False
        
        if not is_blur and not is_shaky:
            # Esecuzione YOLO a confidence standard
            results = yolo_model(frame, verbose=False)
            boxes = results[0].boxes
            person_count = sum(1 for box in boxes if int(box.cls[0]) == 0)
            
            # Doppio Binario
            if person_count == 1:
                is_main = True
            elif person_count == 0:
                is_broll = True
            # Se person_count > 1, entrambi restano False (Scarto/Interruzione)
        
        frame_data_main.append((timestamp_sec, is_main))
        frame_data_broll.append((timestamp_sec, is_broll))
        
        prev_gray = gray
        frame_idx += 1
        
        # Log progresso
        if frame_idx % 100 == 0:
            print(f"  Analizzati {frame_idx}/{total_frames} frames...")

    cap.release()
    print("✅ Analisi OpenCV e YOLO completata.")
    
    mean_motion = np.mean(global_motion_diffs) if global_motion_diffs else 0.0
    return frame_data_main, frame_data_broll, mean_motion

def extract_valid_segments(frame_data, min_duration, apply_backtrack=False):
    """
    Raggruppa i frame validi in segmenti continui e scarta quelli troppo corti.
    Se apply_backtrack è True, quando un segmento viene interrotto da un'anomalia,
    ne pota la coda sottraendo BACKTRACK_SECONDS al timecode finale.
    """
    segments = []
    in_segment = False
    start_time = 0.0
    
    for timestamp, is_valid in frame_data:
        if is_valid and not in_segment:
            in_segment = True
            start_time = timestamp
        elif not is_valid and in_segment:
            in_segment = False
            end_time = timestamp
            
            # V5: Dynamic Backtrack (sottrae margine in uscita)
            if apply_backtrack:
                end_time = max(start_time, end_time - BACKTRACK_SECONDS)
                
            duration = end_time - start_time
            if duration >= min_duration:
                segments.append({"start_sec": float(round(start_time, 3)), "end_sec": float(round(end_time, 3))})
                
    # Gestione chiusura ultimo segmento (fine video, niente anomalia intrusa solitamente, ma potiamo per uniformità)
    if in_segment:
        end_time = frame_data[-1][0]
        if apply_backtrack:
            end_time = max(start_time, end_time - BACKTRACK_SECONDS)
            
        duration = end_time - start_time
        if duration >= min_duration:
            segments.append({"start_sec": float(round(start_time, 3)), "end_sec": float(round(end_time, 3))})
            
    return segments

def deduce_pacing_profile(mean_motion):
    if mean_motion < PACING_CINEMATIC_MAX:
        return "cinematic"
    elif mean_motion < PACING_STANDARD_MAX:
        return "standard"
    else:
        return "social_fast"

def generate_moviepy_preview(input_video, cuts, output_video):
    """Genera un'anteprima concatenando le clip valide."""
    if not cuts:
        print(f"⚠️ Nessun taglio valido per generare {os.path.basename(output_video)}")
        return
        
    print(f"🎬 Generazione bozza {os.path.basename(output_video)} con {len(cuts)} clip...")
    try:
        with VideoFileClip(input_video) as video:
            subclips = []
            for cut in cuts:
                clip = video.subclipped(cut['start_sec'], cut['end_sec'])
                subclips.append(clip)
            
            final_clip = concatenate_videoclips(subclips)
            final_clip.write_videofile(
                output_video,
                codec="libx264",
                audio_codec="aac",
                logger=None
            )
            
            for c in subclips:
                c.close()
            final_clip.close()
        print(f"✅ Anteprima creata con successo: {output_video}")
    except Exception as e:
        print(f"❌ Errore durante la generazione dell'anteprima {output_video}: {e}")

# ==============================================================================
# MAIN PIPELINE
# ==============================================================================
def process_pancake_video(video_path, sequence_name="Pancake_Sequence"):
    ensure_output_dir()
    
    if not os.path.exists(video_path):
        print(f"❌ Errore: File {video_path} non trovato.")
        return None, None, 0
        
    # Creazione Path Dinamici
    json_main = os.path.join(OUTPUT_DIR, f"{sequence_name}_main_cuts.json")
    json_broll = os.path.join(OUTPUT_DIR, f"{sequence_name}_broll_cuts.json")
    preview_main = os.path.join(OUTPUT_DIR, f"{sequence_name}_preview_main.mp4")
    preview_broll = os.path.join(OUTPUT_DIR, f"{sequence_name}_preview_broll.mp4")

    # 1. Analisi Doppio Binario con Soglie Rilassate
    frame_data_main, frame_data_broll, mean_motion = analyze_video(video_path)
    
    # 2. Estrazione (Applica Backtrack solo alla MAIN per eliminare l'intruso in coda)
    print(f"✂️ Estrazione Main Track (Backtrack = {BACKTRACK_SECONDS}s)...")
    main_cuts = extract_valid_segments(frame_data_main, MIN_CLIP_DURATION, apply_backtrack=True)
    
    print(f"✂️ Estrazione B-Roll Track (No Backtrack)...")
    broll_cuts = extract_valid_segments(frame_data_broll, MIN_CLIP_DURATION, apply_backtrack=False)
    
    pacing_profile = deduce_pacing_profile(mean_motion)
    print(f"📊 Metriche Globali: Movimento Medio = {mean_motion:.2f} -> Profilo Dedotto: '{pacing_profile}'")
    
    # 3. Salvataggio JSON (Main)
    main_data = {
        "pacing_profile": pacing_profile,
        "global_mean_motion": float(round(mean_motion, 3)),
        "track_type": "main",
        "total_cuts": len(main_cuts),
        "cuts": main_cuts
    }
    with open(json_main, 'w') as f:
        json.dump(main_data, f, indent=2)
        
    # 4. Salvataggio JSON (B-Roll)
    broll_data = {
        "pacing_profile": pacing_profile,
        "global_mean_motion": float(round(mean_motion, 3)),
        "track_type": "b-roll",
        "total_cuts": len(broll_cuts),
        "cuts": broll_cuts
    }
    with open(json_broll, 'w') as f:
        json.dump(broll_data, f, indent=2)
        
    print(f"💾 Esportati: {json_main} e {json_broll}")
    
    # 5. Generazione Anteprime
    generate_moviepy_preview(video_path, main_cuts, preview_main)
    generate_moviepy_preview(video_path, broll_cuts, preview_broll)
    
    return json_main, preview_main, len(main_cuts)

if __name__ == "__main__":
    process_pancake_video(INPUT_VIDEO_PATH)
