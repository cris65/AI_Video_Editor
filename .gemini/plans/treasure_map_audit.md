# Treasure Map: Phase 1 (OpenCV + YOLO) & Chunking Logic Audit

This document contains a comprehensive audit of the Phase 1 implementation (Technical Culling, Frame Extraction, and Batching Logic) within the `engine/` directory.

## 1. Video Loading & Frame Extraction (Step-slicing)
**Location:** `engine/pancake_editor.py`
The process uses `cv2.VideoCapture` to ingest the proxy video. Instead of processing every frame, it implements a step-slicing logic (`step = 10`), jumping ahead and reading only 1 frame every 10 frames to optimize analysis speed.

```python
    def process_video(self, video_path):
        """
        3. Logica di Costruzione Stringout
        """
        print(f"🔍 Avvio analisi PancakeEditor (Blacklist) di: {video_path}")
        cap = cv2.VideoCapture(video_path)
        # ...
        self.fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        # ...
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
```

## 2. YOLO Object Detection, Focus Variance (Blur) & Movement Vectors
**Location:** `engine/pancake_editor.py`

### Focus Variance & Sballottamento
The `get_frame_tag` function applies a Center-Weighted Focus filter. It calculates the Laplacian variance exclusively on the central 50% of the image. It also calculates an absolute pixel difference between consecutive frames to detect harsh movements (Sballottamento).

```python
    def get_frame_tag(self, frame, prev_frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
        
        # Filtro Cecità (Center-Weighted Focus)
        h, w = gray.shape
        center_gray = gray[int(h*0.25):int(h*0.75), int(w*0.25):int(w*0.75)]
        lap_var = cv2.Laplacian(center_gray, cv2.CV_64F).var()
        if lap_var < self.BLUR_THRESHOLD:
            return 'TRASH_BLUR', lap_var, 0
            
        is_soft = (self.BLUR_THRESHOLD <= lap_var < self.SOFT_FOCUS_THRESHOLD)
            
        # Filtro Sballottamento
        diff = cv2.absdiff(gray, prev_gray)
        motion_diff = np.mean(diff)
        if motion_diff > self.MOTION_THRESHOLD:
            return 'TRASH_MOTION', lap_var, 0
```

### YOLO Object Detection
It uses `yolov8n` to scan for people (class 0). It dynamically tags frames (`MAIN_A`, `B-ROLL`, `EDGE_DANGER`) based on the person's location within the frame's horizontal axis (using the Safe Zone boundaries).

```python
        # Analisi YOLO (classe 0 = person)
        results = self.yolo_model(frame, verbose=False, conf=self.CONFIDENCE_MIN)
        boxes = results[0].boxes
        person_boxes = [box for box in boxes if int(box.cls[0]) == 0]
        
        people_count = len(person_boxes)
        # ...
        # Analisi Spaziale
        frame_width = frame.shape[1]
        for box in person_boxes:
            x1, y1, x2, y2 = box.xyxy[0]
            center_x = (x1 + x2) / 2.0
            norm_x = center_x / frame_width
            
            if self.SAFE_LEFT <= norm_x <= self.SAFE_RIGHT:
                return 'MAIN_A' + suffix, lap_var, people_count
                
        return 'EDGE_DANGER' + suffix, lap_var, people_count
```

### Movement Vectors (Optical Flow)
The `extract_motion_vectors` function applies the Farneback algorithm on a heavily downscaled version of the frames (160x90) to classify the motion direction and intensity.

```python
    def extract_motion_vectors(self, prev_gray, gray):
        """
        Calcola l'Optical Flow (Farneback) su 160x90 per estrarre intensità e direzione.
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
            # ...
```

## 3. Chunking & Batch Processing Logic (Vision LLM)
**Location:** `engine/mlx_client.py`
The chunking logic is inherently synchronous and sequential to protect VRAM. It iterates through the stringout timeline, sending the `base64` storyboard to the local MLX server one by one. It features an atomic, incremental saving mechanism (`json.dump` inside the loop) to checkpoint progress after every single frame analysis.

```python
def process_stringout_batch(json_path):
    # ...
    for idx, clip in enumerate(timeline):
        storyboard_path = clip.get("storyboard_path")
        if not storyboard_path or not os.path.exists(storyboard_path):
            continue
            
        # CHIAMATA SINCRONA MLX API
        people_count = clip.get("people_count", 0)
        semantic_data = analyze_frame(storyboard_path, people_count)
        
        if semantic_data:
            clip["scene_and_lighting"] = semantic_data.get("scene_and_lighting", "")
            # ...
            
        # Sovrascrittura atomica progressiva del JSON (salvataggio immediato post-clip)
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
```
