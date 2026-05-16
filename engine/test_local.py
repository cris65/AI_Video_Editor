import os
from moviepy import VideoFileClip
import cv2

def test_engine():
    input_path = "input.mp4"
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)
    
    output_video = os.path.join(output_dir, "cut_video.mp4")
    output_thumb = os.path.join(output_dir, "thumb.jpg")
    
    print("🎬 Avvio test motore di editing locale...")
    
    # 1. Taglio Video (0 -> 5 secondi)
    print("✂️ Taglio del video (primi 5 secondi)...")
    with VideoFileClip(input_path) as video:
        cut = video.subclip(0, 5)
        cut.write_videofile(output_video, codec="libx264", audio_codec="aac")
        
    # 2. Estrazione Thumbnail (primo frame del video tagliato)
    print("📸 Estrazione miniatura...")
    cap = cv2.VideoCapture(output_video)
    success, frame = cap.read()
    if success:
        cv2.imwrite(output_thumb, frame)
    cap.release()
    
    print(f"✅ Test completato con successo! Controlla la cartella: {output_dir}")

if __name__ == "__main__":
    if os.path.exists("input.mp4"):
        test_engine()
    else:
        print("❌ Errore: Metti il video scaricato nella cartella 'engine' e chiamalo 'input.mp4' prima di lanciare lo script!")