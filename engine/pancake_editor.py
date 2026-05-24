import os
import cv2
import json
import numpy as np
from moviepy import VideoFileClip, concatenate_videoclips
from ultralytics import YOLO
from typing import cast

class PancakeEditor:
    def __init__(self, sequence_name="Pancake_Sequence", clip_map=None, sampling_density_percent=0.15, vlm_model_id="google/gemma-4-E4B-it", llm_model_id="google/gemma-4-9b-it"):
        self.sequence_name = sequence_name
        self.clip_map = clip_map or []
        self.sampling_density_percent = sampling_density_percent
        self.vlm_model_id = vlm_model_id
        self.llm_model_id = llm_model_id
        
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
            return 'TRASH_BLUR', lap_var, 0, []
            
        is_soft = (self.BLUR_THRESHOLD <= lap_var < self.SOFT_FOCUS_THRESHOLD)
            
        # Filtro Sballottamento
        diff = cv2.absdiff(gray, prev_gray)
        motion_diff = np.mean(diff)
        if motion_diff > self.MOTION_THRESHOLD:
            return 'TRASH_MOTION', lap_var, 0, []
            
        # Analisi YOLO: raccoglie tutte le classi COCO (non solo person)
        results = self.yolo_model(frame, verbose=False, conf=self.CONFIDENCE_MIN)
        boxes = results[0].boxes
        names = results[0].names  # COCO class name map

        # Build full detections list for all detected objects
        detections = []
        person_boxes = []
        for box in boxes:
            cls_id = int(box.cls[0])
            conf = float(box.conf[0])
            x1, y1, x2, y2 = [round(float(v), 1) for v in box.xyxy[0]]
            detections.append({
                "class": names.get(cls_id, str(cls_id)),
                "confidence": round(conf, 3),
                "bbox": [x1, y1, x2, y2]
            })
            if cls_id == 0:
                person_boxes.append(box)
        
        people_count = len(person_boxes)
        
        suffix = '_SOFT' if is_soft else ''
        
        if not person_boxes:
            return 'B-ROLL' + suffix, lap_var, people_count, detections
            
        # Analisi Spaziale
        frame_width = frame.shape[1]
        for box in person_boxes:
            x1, y1, x2, y2 = box.xyxy[0]
            center_x = (x1 + x2) / 2.0
            norm_x = center_x / frame_width
            
            if self.SAFE_LEFT <= norm_x <= self.SAFE_RIGHT:
                return 'MAIN_A' + suffix, lap_var, people_count, detections
                
        return 'EDGE_DANGER' + suffix, lap_var, people_count, detections

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
        pixel_data = pixel_data.astype(np.float32)
        
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
        K = 5
        
        if len(pixel_data) < K:
            return []
            
        bestLabels = np.zeros((pixel_data.shape[0], 1), dtype=np.int32)
        _, _, centers = cv2.kmeans(pixel_data, K, bestLabels, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
        
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
        flow = cv2.calcOpticalFlowFarneback(prev_gray, gray, None, 0.5, 3, 15, 3, 5, 1.2, 0)  # type: ignore
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

    def _finalize_block(self, block, last_frame):
        """
        Finalizes a clip/trash block: aggregates motion metrics, generates the
        storyboard, builds the new nested JSON structure, and removes all
        temporary private keys (_max_lap, _people_count, _frame_*, etc.).
        """
        # 1. Attach OUT frame thumbnails
        block["_frame_out"] = cv2.resize(last_frame, (100, 100))
        block["_sb_out"] = cv2.resize(last_frame, (896, 896))

        # 2. Cinematic Palette
        frames_for_palette = [
            block.get("_frame_in"),
            block.get("_frame_best"),
            block.get("_frame_out")
        ]
        cinematic_palette = self.extract_cinematic_palette(frames_for_palette)

        # 3. Dynamic Storyboard Extraction (NO TRIPTYCH)
        storyboard_paths = []
        duration = block.get("end", 0) - block.get("start", 0)
        
        # Avoid opening VideoCapture if duration is 0
        if duration > 0 and hasattr(self, 'video_path') and os.path.exists(self.video_path):
            total_frames_in_block = duration * self.fps
            extract_count = max(1, int(total_frames_in_block * self.sampling_density_percent))
            
            # We open the video to jump to exact equidistant frames
            temp_cap = cv2.VideoCapture(self.video_path)
            if temp_cap.isOpened():
                start_frame = int(block.get("start", 0) * self.fps)
                
                # Calculate equidistant frame indices
                if extract_count == 1:
                    frame_indices = [start_frame + int(total_frames_in_block / 2)]
                else:
                    step = max(1, int(total_frames_in_block / (extract_count - 1)))
                    frame_indices = [start_frame + i * step for i in range(extract_count)]
                    # Ensure the last frame index does not exceed the block end
                    frame_indices[-1] = min(frame_indices[-1], start_frame + int(total_frames_in_block) - 1)
                
                naming_base = self.get_clip_naming(block['start'])

                # Inject clip_name as a first-class field (source of truth from EDL clip_map)
                clip_name_base = self.sequence_name
                for edl_clip in self.clip_map:
                    if edl_clip["timeline_start_sec"] <= block["start"] < edl_clip["timeline_end_sec"]:
                        clip_name_base = edl_clip.get("clip_name_base", clip_name_base)
                        break
                block["clip_name"] = clip_name_base

                for i, f_idx in enumerate(frame_indices):
                    temp_cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
                    ret, fr = temp_cap.read()
                    if ret:
                        sb_frame = cv2.resize(fr, (896, 896))
                        sb_filename = f"{naming_base}_frame_{i+1:03d}.jpg"
                        sb_path = os.path.join(self.storyboard_dir, sb_filename)
                        cv2.imwrite(sb_path, sb_frame)
                        storyboard_paths.append(sb_path)
                
                temp_cap.release()
                
        block["storyboard_paths"] = storyboard_paths

        # 4. Motion aggregation
        samples = block.get("_motion_samples", [])
        if samples:
            avg_intensity = float(np.mean([s[0] for s in samples]))
            directions = [s[1] for s in samples]
            dom_dir = max(set(directions), key=directions.count)
        else:
            avg_intensity = 0.0
            dom_dir = "STATIC"

        # 5. Extract temp values before cleanup
        blur_score = float(block.get("_max_lap", 0.0))
        people_count = block.get("_people_count", 0)
        is_soft = "_SOFT" in block.get("tag", "")

        # 6. Inject new nested structure
        block["technical_quality"] = {
            "blur_score": round(blur_score, 4),
            "is_soft_focus": is_soft,
            "motion_intensity": round(avg_intensity, 2),
            "camera_direction": dom_dir,
            "cinematic_palette": cinematic_palette
        }
        block["spatial_configuration"] = {
            "safe_zone_tag": block.get("tag", "UNKNOWN"),
            "focus_area": None
        }
        block["yolo_omniscient_data"] = {
            "total_objects": people_count,
            "detections": block.get("_detections", [])
        }

        # 7. Remove all temporary private keys
        for key in [
            "_max_lap", "_people_count", "_detections", "_frame_in", "_frame_best",
            "_frame_out", "_sb_in", "_sb_best", "_sb_out",
            "_motion_samples", "_prev_gray_flow"
        ]:
            block.pop(key, None)

        return block

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

    def process_video(self, video_path, progress_callback=None):
        """
        3. Logica di Costruzione Stringout
        """
        print(f"🔍 Avvio analisi PancakeEditor (Blacklist) di: {video_path}")
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Impossibile aprire il file video: {video_path}")
            
        self.fps = cap.get(cv2.CAP_PROP_FPS)
        self.width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        self.height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        self.video_path = video_path
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        self.total_frames = total_frames
        self.duration_sec = total_frames / self.fps if self.fps > 0 else 0
        
        timeline = []
        trash_timeline = []
        current_block = None
        current_trash = None
        last_timestamp = 0.0
        
        ret, prev_frame = cap.read()
        if not ret:
            cap.release()
            return []
            
        # Inizializziamo il primo blocco (frame a 0s)
        tag, lap_var, people_count, detections = self.get_frame_tag(prev_frame, prev_frame)
        if not tag.startswith('TRASH'):
            small_frame = cv2.resize(prev_frame, (100, 100))
            sb_frame = cv2.resize(prev_frame, (896, 896))
            current_block = {
                "start": last_timestamp,
                "end": 0.0,
                "tag": tag,
                "best_moment": 0.0,
                "_people_count": people_count,
                "_detections": detections,
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
            
            tag, lap_var, people_count, detections = self.get_frame_tag(frame, prev_frame)
            
            if tag.startswith('TRASH'):
                if current_block is not None:
                    current_block["end"] = timestamp_sec
                    duration = current_block["end"] - cast(float, current_block["start"])

                    current_block = self._finalize_block(current_block, frame)

                    if duration >= 1.0:
                        current_block["is_usable"] = True
                        timeline.append(current_block)
                    else:
                        # Micro-clip or gap: force into trash to prevent black holes
                        current_block["is_usable"] = False
                        current_block["tag"] = "TRASH_GAP"
                        current_block["technical_flaws"] = "TRASH_GAP"
                        trash_timeline.append(current_block)

                    last_timestamp = current_block["end"]
                    current_block = None
                    
                if current_trash is None:
                    small_frame = cv2.resize(frame, (100, 100))
                    sb_frame = cv2.resize(frame, (896, 896))
                    current_trash = {
                        "start": last_timestamp,
                        "end": timestamp_sec,
                        "tag": tag,
                        "best_moment": timestamp_sec,
                        "_people_count": people_count,
                        "_detections": detections,
                        "_max_lap": lap_var,
                        "_frame_in": small_frame,
                        "_frame_best": small_frame,
                        "_sb_in": sb_frame,
                        "_sb_best": sb_frame,
                        "_motion_samples": [],
                        "_prev_gray_flow": cv2.cvtColor(cv2.resize(frame, (160, 90)), cv2.COLOR_BGR2GRAY)
                    }
                else:
                    current_trash["end"] = timestamp_sec
                    if lap_var > current_trash.get("_max_lap", 0):
                        current_trash["_max_lap"] = lap_var
                        current_trash["best_moment"] = timestamp_sec
                        current_trash["_people_count"] = people_count
                        current_trash["_detections"] = detections
                        current_trash["_frame_best"] = cv2.resize(frame, (100, 100))
                        current_trash["_sb_best"] = cv2.resize(frame, (896, 896))
                        
                    curr_gray_flow = cv2.cvtColor(cv2.resize(frame, (160, 90)), cv2.COLOR_BGR2GRAY)
                    if current_trash.get("_prev_gray_flow") is not None:
                        mag, d_dir = self.extract_motion_vectors(current_trash["_prev_gray_flow"], curr_gray_flow)
                        samples = current_trash["_motion_samples"]
                        assert isinstance(samples, list)
                        samples.append((mag, d_dir))
                    current_trash["_prev_gray_flow"] = curr_gray_flow
            else:
                if current_trash is not None:
                    current_trash["end"] = timestamp_sec
                    duration = float(current_trash["end"]) - float(current_trash["start"])

                    current_trash = self._finalize_block(current_trash, frame)

                    current_trash["is_usable"] = False
                    if duration < 0.5:
                        current_trash["tag"] = "TRASH_GAP"

                    current_trash["technical_flaws"] = current_trash["tag"]
                    trash_timeline.append(current_trash)

                    last_timestamp = current_trash["end"]
                    current_trash = None
                    
                if current_block is None:
                    small_frame = cv2.resize(frame, (100, 100))
                    sb_frame = cv2.resize(frame, (896, 896))
                    current_block = {
                        "start": last_timestamp,
                        "end": timestamp_sec,
                        "tag": tag,
                        "best_moment": timestamp_sec,
                        "_people_count": people_count,
                        "_detections": detections,
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
                        current_block["_people_count"] = people_count
                        current_block["_detections"] = detections
                        current_block["_frame_best"] = cv2.resize(frame, (100, 100))
                        current_block["_sb_best"] = cv2.resize(frame, (896, 896))
                        
                    curr_gray_flow = cv2.cvtColor(cv2.resize(frame, (160, 90)), cv2.COLOR_BGR2GRAY)
                    if current_block.get("_prev_gray_flow") is not None:
                        mag, d_dir = self.extract_motion_vectors(current_block["_prev_gray_flow"], curr_gray_flow)
                        samples = current_block["_motion_samples"]
                        assert isinstance(samples, list)
                        samples.append((mag, d_dir))
                    current_block["_prev_gray_flow"] = curr_gray_flow
                        
                    # Transizioni interne: Upgrade a MAIN_A
                    if current_block["tag"] == 'B-ROLL' and tag == 'MAIN_A':
                        current_block["tag"] = 'MAIN_A'
                        
            prev_frame = frame
            
            if next_pos % 500 < step:
                print(f"  Analizzati {int(next_pos)}/{total_frames} frames...")
                if progress_callback:
                    progress_callback("A_OPENCV", int((next_pos / total_frames) * 100), f"Estrazione frame OpenCV: {int(next_pos)}/{total_frames}")
                
        if current_block is not None:
            # Force end to the last available timestamp to cover the full video duration
            current_block["end"] = total_frames / self.fps
            duration = current_block["end"] - cast(float, current_block["start"])

            current_block = self._finalize_block(current_block, prev_frame)

            if duration >= 1.0:
                current_block["is_usable"] = True
                timeline.append(current_block)
            else:
                current_block["is_usable"] = False
                current_block["tag"] = "TRASH_GAP"
                current_block["technical_flaws"] = "TRASH_GAP"
                trash_timeline.append(current_block)

        if current_trash is not None:
            # Force end to the last available timestamp to cover the full video duration
            current_trash["end"] = total_frames / self.fps
            duration = float(current_trash["end"]) - float(current_trash["start"])

            current_trash = self._finalize_block(current_trash, prev_frame)

            current_trash["is_usable"] = False
            if duration < 0.5:
                current_trash["tag"] = "TRASH_GAP"

            current_trash["technical_flaws"] = current_trash["tag"]
            trash_timeline.append(current_trash)
                
        cap.release()
        if progress_callback:
            progress_callback("A_OPENCV", 100, f"Analisi Stringout completata. {len(timeline)} clip valide.")
        print(f"✅ Analisi Stringout completata. Trovati {len(timeline)} segmenti validi e {len(trash_timeline)} scarti.")
        return timeline, trash_timeline

    def generate_json(self, timeline, trash_timeline=None):
        """
        4. Output JSON
        """
        data = {
            "metadata": {
                "fps": getattr(self, 'fps', 50.0),
                "resolution": {
                    "width": getattr(self, 'width', 1920),
                    "height": getattr(self, 'height', 1080)
                },
                "duration_seconds": getattr(self, 'duration_sec', 0.0),
                "total_frames": getattr(self, 'total_frames', 0),
                "vlm_model_id": self.vlm_model_id
            },
            "stringout_timeline": timeline,
            "trash_timeline": trash_timeline or []
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
def process_pancake_video(video_path, sequence_name="Pancake_Sequence", clip_map=None, sampling_density_percent=0.15, vlm_model_id="google/gemma-4-E4B-it", llm_model_id="google/gemma-4-9b-it", progress_callback=None):
    editor = PancakeEditor(sequence_name, clip_map, sampling_density_percent, vlm_model_id, llm_model_id)
    timeline, trash_timeline = editor.process_video(video_path, progress_callback)
    json_path = editor.generate_json(timeline, trash_timeline)
    preview_path = editor.generate_preview(video_path, timeline)
    trash_path = editor.generate_trash_preview(video_path, trash_timeline)
    editor._export_director_package()
    return json_path, preview_path, len(timeline), trash_path

if __name__ == "__main__":
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    INPUT_VIDEO_PATH = os.path.join(BASE_DIR, 'input', 'input.mp4')
    if os.path.exists(INPUT_VIDEO_PATH):
        process_pancake_video(INPUT_VIDEO_PATH)
