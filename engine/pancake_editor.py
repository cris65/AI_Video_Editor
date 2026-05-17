import os
import cv2
import json
import numpy as np
from moviepy import VideoFileClip, concatenate_videoclips
from ultralytics import YOLO

class PancakeEditor:
    def __init__(self, sequence_name="Pancake_Sequence", clip_map=None):
        self.sequence_name = sequence_name
        self.clip_map = clip_map or []
        
        # 1. Parametri di Soglia
        self.BLUR_THRESHOLD = 10.0
        self.SOFT_FOCUS_THRESHOLD = 25.0
        self.MOTION_THRESHOLD = 40.0
        self.CONFIDENCE_MIN = 0.20
        self.SAFE_LEFT = 0.30
        self.SAFE_RIGHT = 0.70
        
        self.yolo_model = YOLO('yolov8n.pt')
        
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.output_dir = os.path.join(self.base_dir, 'output', sequence_name)
        os.makedirs(self.output_dir, exist_ok=True)
        
        self.json_out = os.path.join(self.output_dir, f"{sequence_name}_stringout.json")
        self.preview_out = os.path.join(self.output_dir, f"{sequence_name}_preview_stringout.mp4")
        self.trash_preview_out = os.path.join(self.output_dir, f"{sequence_name}_preview_TRASH.mp4")
        self.storyboard_dir = os.path.join(self.output_dir, 'storyboards')
        os.makedirs(self.storyboard_dir, exist_ok=True)

    def get_frame_tag(self, frame, prev_frame):
        """
        2. Nuova Funzione di Tagging
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
        
        # Filtro Cecità (Center-Weighted Focus)
        h, w = gray.shape
        center_gray = gray[int(h*0.25):int(h*0.75), int(w*0.25):int(w*0.75)]
        lap_var = cv2.Laplacian(center_gray, cv2.CV_64F).var()
        if lap_var < self.BLUR_THRESHOLD:
            return 'TRASH_BLUR', lap_var
            
        is_soft = (self.BLUR_THRESHOLD <= lap_var < self.SOFT_FOCUS_THRESHOLD)
            
        # Filtro Sballottamento
        diff = cv2.absdiff(gray, prev_gray)
        motion_diff = np.mean(diff)
        if motion_diff > self.MOTION_THRESHOLD:
            return 'TRASH_MOTION', lap_var
            
        # Analisi YOLO (classe 0 = person)
        results = self.yolo_model(frame, verbose=False, conf=self.CONFIDENCE_MIN)
        boxes = results[0].boxes
        person_boxes = [box for box in boxes if int(box.cls[0]) == 0]
        
        suffix = '_SOFT' if is_soft else ''
        
        if not person_boxes:
            return 'B-ROLL' + suffix, lap_var
            
        # Analisi Spaziale
        frame_width = frame.shape[1]
        for box in person_boxes:
            x1, y1, x2, y2 = box.xyxy[0]
            center_x = (x1 + x2) / 2.0
            norm_x = center_x / frame_width
            
            if self.SAFE_LEFT <= norm_x <= self.SAFE_RIGHT:
                return 'MAIN_A' + suffix, lap_var
                
        return 'EDGE_DANGER' + suffix, lap_var

    def extract_cinematic_palette(self, frames_list):
        """
        Estrae 5 colori dominanti da una lista di frame combinati.
        Ritorna una lista di stringhe HEX.
        """
        if not frames_list:
            return []
            
        pixels = []
        for f in frames_list:
            if f is not None:
                # Convertiamo da BGR a RGB per avere i colori corretti in HEX
                rgb_frame = cv2.cvtColor(f, cv2.COLOR_BGR2RGB)
                pixels.append(rgb_frame.reshape((-1, 3)))
                
        if not pixels:
            return []
            
        pixel_data = np.vstack(pixels)
        pixel_data = np.float32(pixel_data)
        
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
        K = 5
        
        if len(pixel_data) < K:
            return []
            
        _, _, centers = cv2.kmeans(pixel_data, K, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
        
        palette_hex = []
        for center in centers:
            r, g, b = [int(c) for c in center]
            hex_color = f"#{r:02x}{g:02x}{b:02x}"
            palette_hex.append(hex_color)
            
        return palette_hex

    def extract_motion_vectors(self, prev_gray, gray):
        """
        Calcola l'Optical Flow (Farneback) su 160x90 per estrarre intensità e direzione.
        Restituisce magnitudo media e direzione stringa.
        """
        flow = cv2.calcOpticalFlowFarneback(prev_gray, gray, None, 0.5, 3, 15, 3, 5, 1.2, 0)
        mag, ang = cv2.cartToPolar(flow[..., 0], flow[..., 1])
        
        avg_mag = np.mean(mag)
        avg_ang = np.mean(ang)
        
        angle_deg = avg_ang * 180 / np.pi
        
        if avg_mag < 0.5:
            direction = "STATIC"
        else:
            if (angle_deg <= 45 or angle_deg >= 315):
                direction = "PAN_LEFT"
            elif (135 <= angle_deg <= 225):
                direction = "PAN_RIGHT"
            elif (45 < angle_deg < 135):
                direction = "TILT_UP"
            else:
                direction = "TILT_DOWN"

        return avg_mag, direction

    def seconds_to_timecode_safe(self, seconds, fps=50):
        """Converte secondi in timecode stringa safe (es. 00-01-29-14)"""
        frames = int(round(seconds * fps))
        ff = frames % fps
        total_sec = frames // fps
        ss = total_sec % 60
        total_min = total_sec // 60
        mm = total_min % 60
        hh = total_min // 60
        return f"{hh:02d}-{mm:02d}-{ss:02d}-{ff:02d}"

    def get_clip_naming(self, timestamp_sec):
        """Ricava il root name {clip}_{tc_safe} analizzando la clip_map EDL."""
        clip_base = self.sequence_name
        tc_safe = self.seconds_to_timecode_safe(timestamp_sec)
        for clip in self.clip_map:
            if clip["timeline_start_sec"] <= timestamp_sec < clip["timeline_end_sec"]:
                clip_base = clip.get("clip_name_base", clip_base)
                break
        return f"{clip_base}_{tc_safe}"

    def process_video(self, video_path):
        """
        3. Logica di Costruzione Stringout
        """
        print(f"🔍 Avvio analisi PancakeEditor (Blacklist) di: {video_path}")
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Impossibile aprire il file video: {video_path}")
            
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        timeline = []
        trash_timeline = []
        current_block = None
        current_trash = None
        
        ret, prev_frame = cap.read()
        if not ret:
            cap.release()
            return []
            
        # Inizializziamo il primo blocco (frame a 0s)
        tag, lap_var = self.get_frame_tag(prev_frame, prev_frame)
        if not tag.startswith('TRASH'):
            small_frame = cv2.resize(prev_frame, (100, 100))
            sb_frame = cv2.resize(prev_frame, (480, 270))
            current_block = {
                "start": 0.0, 
                "end": 0.0, 
                "tag": tag, 
                "best_moment": 0.0, 
                "_max_lap": lap_var,
                "_frame_in": small_frame,
                "_frame_best": small_frame,
                "_sb_in": sb_frame,
                "_sb_best": sb_frame,
                "_motion_samples": [],
                "_prev_gray_flow": cv2.cvtColor(cv2.resize(prev_frame, (160, 90)), cv2.COLOR_BGR2GRAY)
            }
            
        step = 10  # Mantieni ottimizzazione: 1 frame ogni 10
        
        while True:
            current_pos = cap.get(cv2.CAP_PROP_POS_FRAMES)
            next_pos = current_pos + step - 1
            
            if next_pos >= total_frames:
                break
                
            cap.set(cv2.CAP_PROP_POS_FRAMES, next_pos)
            ret, frame = cap.read()
            if not ret:
                break
                
            timestamp_sec = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
            
            tag, lap_var = self.get_frame_tag(frame, prev_frame)
            
            if tag.startswith('TRASH'):
                if current_block is not None:
                    current_block["end"] = timestamp_sec
                    duration = current_block["end"] - current_block["start"]
                    if duration >= 1.0:
                        current_block["_frame_out"] = cv2.resize(frame, (100, 100))
                        current_block["_sb_out"] = cv2.resize(frame, (480, 270))
                        
                        frames_for_palette = [
                            current_block.get("_frame_in"),
                            current_block.get("_frame_best"),
                            current_block.get("_frame_out")
                        ]
                        current_block["cinematic_palette"] = self.extract_cinematic_palette(frames_for_palette)
                        
                        storyboard_img = np.hstack((
                            current_block.get("_sb_in"),
                            current_block.get("_sb_best"),
                            current_block.get("_sb_out")
                        ))
                        naming_base = self.get_clip_naming(current_block['start'])
                        sb_filename = f"{naming_base}.jpg"
                        sb_path = os.path.join(self.storyboard_dir, sb_filename)
                        cv2.imwrite(sb_path, storyboard_img)
                        current_block["storyboard_path"] = sb_path
                        
                        samples = current_block.get("_motion_samples", [])
                        if samples:
                            avg_intensity = float(np.mean([s[0] for s in samples]))
                            directions = [s[1] for s in samples]
                            dom_dir = max(set(directions), key=directions.count)
                        else:
                            avg_intensity = 0.0
                            dom_dir = "STATIC"
                        current_block["motion"] = {"intensity": round(avg_intensity, 2), "direction": dom_dir}
                        
                        current_block.pop("_max_lap", None)
                        current_block.pop("_frame_in", None)
                        current_block.pop("_frame_best", None)
                        current_block.pop("_frame_out", None)
                        current_block.pop("_sb_in", None)
                        current_block.pop("_sb_best", None)
                        current_block.pop("_sb_out", None)
                        current_block.pop("_motion_samples", None)
                        current_block.pop("_prev_gray_flow", None)
                        
                        timeline.append(current_block)
                    current_block = None
                    
                if current_trash is None:
                    current_trash = {"start": timestamp_sec, "end": timestamp_sec, "tag": tag}
                else:
                    current_trash["end"] = timestamp_sec
            else:
                if current_trash is not None:
                    current_trash["end"] = timestamp_sec
                    duration = current_trash["end"] - current_trash["start"]
                    if duration >= 0.5:
                        trash_timeline.append(current_trash)
                    current_trash = None
                    
                if current_block is None:
                    small_frame = cv2.resize(frame, (100, 100))
                    sb_frame = cv2.resize(frame, (480, 270))
                    current_block = {
                        "start": timestamp_sec, 
                        "end": timestamp_sec, 
                        "tag": tag, 
                        "best_moment": timestamp_sec, 
                        "_max_lap": lap_var,
                        "_frame_in": small_frame,
                        "_frame_best": small_frame,
                        "_sb_in": sb_frame,
                        "_sb_best": sb_frame,
                        "_motion_samples": [],
                        "_prev_gray_flow": cv2.cvtColor(cv2.resize(frame, (160, 90)), cv2.COLOR_BGR2GRAY)
                    }
                else:
                    current_block["end"] = timestamp_sec
                    if lap_var > current_block.get("_max_lap", 0):
                        current_block["_max_lap"] = lap_var
                        current_block["best_moment"] = timestamp_sec
                        current_block["_frame_best"] = cv2.resize(frame, (100, 100))
                        current_block["_sb_best"] = cv2.resize(frame, (480, 270))
                        
                    curr_gray_flow = cv2.cvtColor(cv2.resize(frame, (160, 90)), cv2.COLOR_BGR2GRAY)
                    if current_block.get("_prev_gray_flow") is not None:
                        mag, d_dir = self.extract_motion_vectors(current_block["_prev_gray_flow"], curr_gray_flow)
                        current_block["_motion_samples"].append((mag, d_dir))
                    current_block["_prev_gray_flow"] = curr_gray_flow
                        
                    # Transizioni interne: Upgrade a MAIN_A
                    if current_block["tag"] == 'B-ROLL' and tag == 'MAIN_A':
                        current_block["tag"] = 'MAIN_A'
                        
            prev_frame = frame
            
            if next_pos % 500 < step:
                print(f"  Analizzati {int(next_pos)}/{total_frames} frames...")
                
        if current_block is not None:
            duration = current_block["end"] - current_block["start"]
            if duration >= 1.0:
                current_block["_frame_out"] = cv2.resize(prev_frame, (100, 100))
                current_block["_sb_out"] = cv2.resize(prev_frame, (480, 270))
                
                frames_for_palette = [
                    current_block.get("_frame_in"),
                    current_block.get("_frame_best"),
                    current_block.get("_frame_out")
                ]
                current_block["cinematic_palette"] = self.extract_cinematic_palette(frames_for_palette)
                
                storyboard_img = np.hstack((
                    current_block.get("_sb_in"),
                    current_block.get("_sb_best"),
                    current_block.get("_sb_out")
                ))
                naming_base = self.get_clip_naming(current_block['start'])
                sb_filename = f"{naming_base}.jpg"
                sb_path = os.path.join(self.storyboard_dir, sb_filename)
                cv2.imwrite(sb_path, storyboard_img)
                current_block["storyboard_path"] = sb_path
                
                samples = current_block.get("_motion_samples", [])
                if samples:
                    avg_intensity = float(np.mean([s[0] for s in samples]))
                    directions = [s[1] for s in samples]
                    dom_dir = max(set(directions), key=directions.count)
                else:
                    avg_intensity = 0.0
                    dom_dir = "STATIC"
                current_block["motion"] = {"intensity": round(avg_intensity, 2), "direction": dom_dir}
                
                current_block.pop("_max_lap", None)
                current_block.pop("_frame_in", None)
                current_block.pop("_frame_best", None)
                current_block.pop("_frame_out", None)
                current_block.pop("_sb_in", None)
                current_block.pop("_sb_best", None)
                current_block.pop("_sb_out", None)
                current_block.pop("_motion_samples", None)
                current_block.pop("_prev_gray_flow", None)
                
                timeline.append(current_block)
                
        if current_trash is not None:
            duration = current_trash["end"] - current_trash["start"]
            if duration >= 0.5:
                trash_timeline.append(current_trash)
                
        cap.release()
        print(f"✅ Analisi Stringout completata. Trovati {len(timeline)} segmenti validi e {len(trash_timeline)} scarti.")
        return timeline, trash_timeline

    def generate_json(self, timeline):
        """
        4. Output JSON
        """
        data = {
            "stringout_timeline": timeline
        }
        with open(self.json_out, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"💾 Esportato JSON: {self.json_out}")
        return self.json_out
        
    def generate_preview(self, video_path, timeline):
        if not timeline:
            return self.preview_out
            
        print(f"🎬 Generazione anteprima {os.path.basename(self.preview_out)}...")
        try:
            with VideoFileClip(video_path) as video:
                subclips = []
                for cut in timeline:
                    # Rinominato 'start' e 'end' rispetto al vecchio codice per rispettare la nuova struttura
                    clip = video.subclipped(cut['start'], cut['end'])
                    subclips.append(clip)
                
                final_clip = concatenate_videoclips(subclips)
                final_clip.write_videofile(
                    self.preview_out,
                    codec="libx264",
                    audio_codec="aac",
                    logger=None
                )
                
                for c in subclips:
                    c.close()
                final_clip.close()
            print(f"✅ Anteprima creata con successo: {self.preview_out}")
        except Exception as e:
            print(f"❌ Errore durante la generazione dell'anteprima: {e}")
            
        return self.preview_out

    def generate_trash_preview(self, video_path, trash_timeline):
        if not trash_timeline:
            print("⚠️ Nessuno scarto rilevato. Trash Reel ignorato.")
            return None
            
        print(f"🎬 Generazione Trash Reel {os.path.basename(self.trash_preview_out)}...")
        try:
            with VideoFileClip(video_path) as video:
                subclips = []
                for cut in trash_timeline:
                    clip = video.subclipped(cut['start'], cut['end'])
                    subclips.append(clip)
                
                final_clip = concatenate_videoclips(subclips)
                final_clip.write_videofile(
                    self.trash_preview_out,
                    codec="libx264",
                    audio_codec="aac",
                    logger=None
                )
                
                for c in subclips:
                    c.close()
                final_clip.close()
            print(f"✅ Trash Reel creato con successo: {self.trash_preview_out}")
            return self.trash_preview_out
        except Exception as e:
            print(f"❌ Errore durante la generazione del Trash Reel: {e}")
            return None

    def _export_director_package(self):
        import shutil
        print(f"📦 Confezionamento Valigetta del Regista (Export Package)...")
        package_dir = os.path.join(self.output_dir, 'LLM_Export_Package')
        os.makedirs(package_dir, exist_ok=True)
        
        if os.path.exists(self.json_out):
            shutil.copy2(self.json_out, os.path.join(package_dir, os.path.basename(self.json_out)))
            
        dest_storyboard_dir = os.path.join(package_dir, 'storyboards')
        if os.path.exists(self.storyboard_dir):
            if os.path.exists(dest_storyboard_dir):
                shutil.rmtree(dest_storyboard_dir)
            shutil.copytree(self.storyboard_dir, dest_storyboard_dir)
            
        print(f"✅ Export Package salvato in: {package_dir}")
        return package_dir

# ==============================================================================
# ENTRY POINT PER L'ORCHESTRATORE
# ==============================================================================
def process_pancake_video(video_path, sequence_name="Pancake_Sequence", clip_map=None):
    editor = PancakeEditor(sequence_name, clip_map)
    timeline, trash_timeline = editor.process_video(video_path)
    json_path = editor.generate_json(timeline)
    preview_path = editor.generate_preview(video_path, timeline)
    trash_path = editor.generate_trash_preview(video_path, trash_timeline)
    editor._export_director_package()
    return json_path, preview_path, len(timeline), trash_path

if __name__ == "__main__":
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    INPUT_VIDEO_PATH = os.path.join(BASE_DIR, 'input', 'input.mp4')
    if os.path.exists(INPUT_VIDEO_PATH):
        process_pancake_video(INPUT_VIDEO_PATH)
