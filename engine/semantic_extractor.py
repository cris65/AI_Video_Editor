import cv2
import json
import os
from ultralytics import YOLO

def extract_bm_semantics(stringout_path, hitl_path, video_path, target_classes):
    """
    Estrae i frame in corrispondenza dei Best Moment (BM) attivi e analizza i tag semantici
    usando YOLO-World (Open-Vocabulary) basandosi su target_classes dinamiche.
    """
    if not target_classes or not video_path or not os.path.exists(video_path):
        return {}

    print("🔥 Inizializzazione YOLOE / YOLO-World (Zero-Shot)...")
    try:
        # Carica il modello YOLOWorld. Ultralytics scaricherà yolov8s-worldv2.pt se mancante.
        model = YOLO('yolov8s-worldv2.pt')
        # Imposta le classi custom dinamicamente
        set_classes_method = getattr(model, 'set_classes', None)
        if callable(set_classes_method):
            set_classes_method(target_classes)
        else:
            print("⚠️ Metodo set_classes non trovato sul modello YOLO.")
    except Exception as e:
        print(f"❌ Errore caricamento modello YOLOE/World: {e}")
        return {}
    
    # Leggi stringout e hitl
    s_data = {}
    if os.path.exists(stringout_path):
        with open(stringout_path, 'r') as f:
            s_data = json.load(f)
            
    overrides = {}
    if os.path.exists(hitl_path):
        with open(hitl_path, 'r') as f:
            h_data = json.load(f)
            overrides = h_data.get("clip_overrides", {})
            
    semantic_tags_map = {}
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"❌ Impossibile aprire il video proxy: {video_path}")
        return {}
        
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    
    print(f"🔍 Scansione dei Best Moments ({len(s_data.get('clips', []))} clips)...")
    
    for clip in s_data.get("clips", []):
        clip_id = str(clip["start"])
        override = overrides.get(clip_id, {})
        
        # Determina lo stato e il best moment
        best_moment = clip.get("best_moment")
        is_trash = False
        
        if isinstance(override, dict):
            if override.get("best_moment") is not None:
                best_moment = override.get("best_moment")
            if override.get("force_status") == "TRASH":
                is_trash = True
        elif override == "TRASH":
            is_trash = True
            
        # Ignora clip cestinate o senza best moment
        if is_trash or best_moment is None:
            continue
            
        # Verifica che il BM sia entro i confini della clip
        if clip["start"] <= best_moment <= clip["end"]:
            base_frame_num = int(best_moment * fps)
            
            # Gestione Difensiva: Fino a 3 tentativi di lettura in avanti (offset +1 frame)
            frame = None
            max_attempts = 3
            for attempt in range(max_attempts):
                frame_num = base_frame_num + attempt
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
                ret, current_frame = cap.read()
                if ret and current_frame is not None:
                    frame = current_frame
                    if attempt > 0:
                        print(f"   ⚠️ [Clip {clip_id}] Frame corrotto al BM esatto. Fallback riuscito all'offset +{attempt} frame.")
                    break
                    
            if frame is not None:
                # Inferenza Zero-Shot
                results = model(frame, verbose=False)
                
                found_tags = set()
                for r in results:
                    for box in r.boxes:
                        class_idx = int(box.cls[0])
                        conf = float(box.conf[0])
                        # Soglia minima di confidenza
                        if conf > 0.05 and class_idx < len(model.names):
                            class_name = model.names[class_idx]
                            found_tags.add(class_name)
                            
                if found_tags:
                    print(f"   ✓ [Clip {clip_id}] BM T={best_moment}s -> Trovati: {list(found_tags)}")
                    semantic_tags_map[clip_id] = list(found_tags)
            else:
                print(f"   ❌ [Clip {clip_id}] Impossibile leggere il frame al BM dopo {max_attempts} tentativi. Estrazione annullata.")
                    
    cap.release()
    print("✅ Estrazione semantica completata.")
    return semantic_tags_map
