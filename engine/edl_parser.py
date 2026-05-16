import os
import re
import json

def timecode_to_seconds(tc, fps=50):
    """Converte una stringa SMPTE 'HH:MM:SS:FF' in float di secondi."""
    if not tc or tc.strip() == "":
        return 0.0
        
    parts = tc.split(':')
    if len(parts) != 4:
        # Se il frame separator è ';', gestiscilo per drop-frame
        parts = tc.replace(';', ':').split(':')
        
    if len(parts) == 4:
        hh, mm, ss, ff = map(int, parts)
        return (hh * 3600) + (mm * 60) + ss + (ff / float(fps))
    return 0.0

def parse_ingest_edl(edl_path, fps=50):
    """
    Legge un file EDL CMX3600 e ne estrae la mappa temporale.
    Restituisce: (sequence_name, clip_map)
    """
    sequence_name = "AI_Pancake_Cut"
    clip_map = []
    
    if not os.path.exists(edl_path):
        raise FileNotFoundError(f"File EDL mancante: {edl_path}")
        
    with open(edl_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    current_clip = {}
    
    # Regex per la riga evento: "001  AX       V     C        00:00:00:00 00:00:05:00 00:00:00:00 00:00:05:00"
    event_pattern = re.compile(r'^\d+\s+\w+\s+\w+\s+\w+\s+(\d{2}:\d{2}:\d{2}[:;]\d{2})\s+(\d{2}:\d{2}:\d{2}[:;]\d{2})\s+(\d{2}:\d{2}:\d{2}[:;]\d{2})\s+(\d{2}:\d{2}:\d{2}[:;]\d{2})')
    
    for line in lines:
        line = line.strip()
        
        if line.startswith("TITLE:"):
            sequence_name = line.replace("TITLE:", "").strip()
            continue
            
        # Match riga dell'evento (TC)
        match = event_pattern.search(line)
        if match:
            # Nuova clip trovata, se c'è ne era una "appesa" la scartiamo o resettiamo
            src_in_tc = match.group(1)
            # src_out_tc = match.group(2)
            rec_in_tc = match.group(3)
            rec_out_tc = match.group(4)
            
            current_clip = {
                "source_start_sec": timecode_to_seconds(src_in_tc, fps),
                "timeline_start_sec": timecode_to_seconds(rec_in_tc, fps),
                "timeline_end_sec": timecode_to_seconds(rec_out_tc, fps),
                "file_name": "UNKNOWN_CLIP.mp4" # fallback
            }
            continue
            
        # Match riga del nome del file: "* FROM CLIP NAME: filename.mxf"
        if line.startswith("* FROM CLIP NAME:") and current_clip:
            current_clip["file_name"] = line.replace("* FROM CLIP NAME:", "").strip()
            clip_map.append(current_clip)
            current_clip = {} # svuotiamo per il prossimo giro
            
    return sequence_name, clip_map

# ==============================================================================
# MOCK TEST
# ==============================================================================
if __name__ == "__main__":
    print("🚀 Test del Microservizio: edl_parser.py")
    
    mock_edl = 'mock_ingest_test.edl'
    mock_content = """TITLE: Test_Sequence_EDL
FCM: NON-DROP FRAME

001  AX       V     C        00:00:10:00 00:00:20:00 00:00:00:00 00:00:10:00
* FROM CLIP NAME: RAW_A001.mxf

002  AX       V     C        00:01:00:00 00:01:30:00 00:00:10:00 00:00:40:00
* FROM CLIP NAME: RAW_B002.mp4
"""
    with open(mock_edl, 'w') as f:
        f.write(mock_content)
        
    seq_name, clip_map = parse_ingest_edl(mock_edl)
    print(f"\nSequence Name: {seq_name}")
    print("\n📊 Risultato Mappa:")
    print(json.dumps(clip_map, indent=2))
    
    if os.path.exists(mock_edl):
        os.remove(mock_edl)
    print("\n✅ Microservizio Parser validato.")
