import json
import os

def seconds_to_timecode(seconds, fps=50):
    """Converte un float di secondi nel formato SMPTE standard HH:MM:SS:FF."""
    fps = int(round(fps))  # Garantisce int: il JSON può passare fps come float (es. 50.0)
    total_frames = int(round(seconds * fps))
    ff = total_frames % fps
    ss = (total_frames // fps) % 60
    mm = (total_frames // (fps * 60)) % 60
    hh = (total_frames // (fps * 3600))
    return f"{hh:02d}:{mm:02d}:{ss:02d}:{ff:02d}"

def find_source_clip(timeline_start, clip_map):
    """
    Dato un timecode in secondi del proxy (timeline_start),
    trova la clip RAW corrispondente nella clip_map estratta da edl_parser.
    Ritorna: (file_name, source_start_sec_effettivo, clip_timeline_end_sec)
    """
    for clip in clip_map:
        if clip["timeline_start_sec"] <= timeline_start <= clip["timeline_end_sec"]:
            # Calcola l'offset dall'inizio della clip proxy
            offset_in_clip = timeline_start - clip["timeline_start_sec"]
            actual_source_start = clip["source_start_sec"] + offset_in_clip
            return clip["file_name"], actual_source_start, clip["timeline_end_sec"]
            
    return None, 0.0, 0.0

def export_to_edl(json_path, sequence_name, clip_map, output_edl_path, fps=50):
    """
    Itera i tagli del pancake editor, li incrocia con la mappa originale (clip_map)
    e genera un file EDL CMX3600 Premiere-ready.
    """
    if not os.path.exists(json_path):
        print(f"❌ ERRORE: File JSON tagli mancante: {json_path}")
        return
        
    with open(json_path, 'r') as f:
        data = json.load(f)
        
    # Risoluzione lista tagli dal nostro formato JSON
    cuts_list = []
    if isinstance(data, dict):
        if "cuts" in data:
            cuts_list = data["cuts"]
        elif "stringout_timeline" in data:
            cuts_list = data["stringout_timeline"]
    elif isinstance(data, list):
        cuts_list = data
        
    if not cuts_list:
        print(f"⚠️ Nessun taglio da esportare in EDL.")
        return

    # Costruzione Header EDL
    edl_lines = [
        f"TITLE: {sequence_name}",
        "FCM: NON-DROP FRAME",
        ""
    ]
    
    # Il "Record In" del pancake parte da zero ed è sequenziale
    rec_in_sec = 0.0
    event_counter = 1
    
    for cut in cuts_list:
        proxy_start = cut.get("start_sec", cut.get("start", 0.0))
        proxy_end = cut.get("end_sec", cut.get("end", 0.0))
        
        if proxy_end <= proxy_start:
            continue
            
        current_start = proxy_start
        while current_start < proxy_end:
            # Trova la source clip originale
            src_file, src_in_sec, global_clip_end = find_source_clip(current_start, clip_map)
            
            if not src_file:
                # Fallback: clip non trovata nella mappa, saltiamo
                break
                
            current_end = min(proxy_end, global_clip_end)
            duration_sec = current_end - current_start
            
            if duration_sec <= 0:
                break
                
            src_out_sec = src_in_sec + duration_sec
            
            # Calcola Record Out (timeline compilata sequenzialmente)
            rec_out_sec = rec_in_sec + duration_sec
            
            # Converti tutto in SMPTE Timecode
            tc_src_in = seconds_to_timecode(src_in_sec, fps)
            tc_src_out = seconds_to_timecode(src_out_sec, fps)
            tc_rec_in = seconds_to_timecode(rec_in_sec, fps)
            tc_rec_out = seconds_to_timecode(rec_out_sec, fps)
            
            # Costruzione entry CMX3600 (Tape id AX = generico)
            edl_event_num = f"{event_counter:03d}"
            
            # Line 1: Numero Evento | Tape | Channel | Type | Src In | Src Out | Rec In | Rec Out
            line_1 = f"{edl_event_num}  AX       V     C        {tc_src_in} {tc_src_out} {tc_rec_in} {tc_rec_out}"
            
            # Line 2: Note per collegare nativamente in Premiere (usando il nome del file)
            line_2 = f"* FROM CLIP NAME: {src_file}"
            
            edl_lines.append(line_1)
            edl_lines.append(line_2)
            edl_lines.append("") # riga vuota separatrice
            
            # Aggiorna il playhead di registrazione e avanza
            rec_in_sec = rec_out_sec
            current_start = current_end
            event_counter += 1
        
    # Scrittura File
    os.makedirs(os.path.dirname(os.path.abspath(output_edl_path)), exist_ok=True)
    with open(output_edl_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(edl_lines))
        
    print(f"✅ EDL generato con successo: {output_edl_path}")

# ==============================================================================
# MOCK TEST
# ==============================================================================
if __name__ == "__main__":
    print("🚀 Test del Microservizio: edl_exporter.py")
    
    mock_json = 'mock_cuts.json'
    mock_edl = 'test_timeline.edl'
    
    with open(mock_json, 'w') as f:
        json.dump({"cuts": [{"start_sec": 10.0, "end_sec": 15.0}, {"start_sec": 30.5, "end_sec": 40.5}]}, f)
        
    clip_map = [
        {"file_name": "RAW_A.mxf", "timeline_start_sec": 0.0, "timeline_end_sec": 20.0, "source_start_sec": 3600.0},
        {"file_name": "RAW_B.mxf", "timeline_start_sec": 20.0, "timeline_end_sec": 50.0, "source_start_sec": 0.0}
    ]
    
    export_to_edl(mock_json, "Mock_Sequence_Name", clip_map, mock_edl, fps=25)
    
    if os.path.exists(mock_edl):
        with open(mock_edl, 'r') as f:
            print(f.read())
            
    # Pulizia mock
    for file in [mock_json, mock_edl]:
        if os.path.exists(file):
            os.remove(file)
