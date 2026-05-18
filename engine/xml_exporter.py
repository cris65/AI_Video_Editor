import json
import os
import xml.etree.ElementTree as ET
import xml.dom.minidom
import urllib.parse

def sec_to_frame(seconds, fps=25):
    """Converte un float di secondi in frame assoluti (int) in base al framerate."""
    return int(round(seconds * fps))

def prettify(elem):
    """Ritorna una stringa XML formattata con indentazione (pretty-print)."""
    rough_string = ET.tostring(elem, 'utf-8')
    reparsed = xml.dom.minidom.parseString(rough_string)
    # Rimuovi le linee vuote generate da minidom
    return '\n'.join([line for line in reparsed.toprettyxml(indent='  ').split('\n') if line.strip()])

def build_rate_node(parent, fps=25):
    """Crea e appende il nodo standard <rate>."""
    rate = ET.SubElement(parent, "rate")
    
    fps_float = float(fps)
    is_ntsc = False
    
    # Arrotondamento ai timebase standard
    if abs(fps_float - 23.976) < 0.1:
        timebase = 24
        is_ntsc = True
    elif abs(fps_float - 29.97) < 0.1:
        timebase = 30
        is_ntsc = True
    elif abs(fps_float - 59.94) < 0.1:
        timebase = 60
        is_ntsc = True
    else:
        timebase = int(round(fps_float))
        
    ET.SubElement(rate, "timebase").text = str(timebase)
    ET.SubElement(rate, "ntsc").text = "TRUE" if is_ntsc else "FALSE"
    return rate

def get_file_node(file_id, file_path, file_name, fps=25, is_audio=False):
    """Crea un nodo <file> completo. Usato la prima volta che si incontra un media."""
    file_elem = ET.Element("file", id=file_id)
    ET.SubElement(file_elem, "name").text = file_name
    
    abs_path = os.path.abspath(file_path)
    url_path = urllib.parse.quote(abs_path)
    ET.SubElement(file_elem, "pathurl").text = f"file://localhost{url_path}"
    
    build_rate_node(file_elem, fps)
    
    media_elem = ET.SubElement(file_elem, "media")
    if is_audio:
        audio_elem = ET.SubElement(media_elem, "audio")
        ET.SubElement(audio_elem, "channelcount").text = "2"
    else:
        video_elem = ET.SubElement(media_elem, "video")
        # Sample characteristics could be added here if needed
    return file_elem

def build_clipitem(clip_id, name, duration_frames, timeline_in_frames, timeline_out_frames, source_in_frames, source_out_frames, file_elem, is_audio=False, fps=25):
    """Crea l'oggetto <clipitem> per video o audio."""
    clipitem = ET.Element("clipitem", id=clip_id)
    ET.SubElement(clipitem, "name").text = name
    ET.SubElement(clipitem, "duration").text = str(duration_frames)
    build_rate_node(clipitem, fps)
    
    ET.SubElement(clipitem, "start").text = str(timeline_in_frames)
    ET.SubElement(clipitem, "end").text = str(timeline_out_frames)
    ET.SubElement(clipitem, "in").text = str(source_in_frames)
    ET.SubElement(clipitem, "out").text = str(source_out_frames)
    
    # Inietta il file reference
    clipitem.append(file_elem)
    
    if is_audio:
        sourcetrack = ET.SubElement(clipitem, "sourcetrack")
        ET.SubElement(sourcetrack, "mediatype").text = "audio"
        ET.SubElement(sourcetrack, "trackindex").text = "1"
    
    return clipitem

def find_source_clip_info(source_clip_start, clip_map):
    """Trova le informazioni del file originale dalla clip_map."""
    for clip in clip_map:
        if clip["timeline_start_sec"] <= source_clip_start <= clip["timeline_end_sec"]:
            return clip
    return None

def export_to_xml(json_path, clip_map, output_xml_path, sequence_name, audio_bgm_path=None, fps=25, width=1920, height=1080):
    """
    Legge il JSON (Director's Cut) e genera un file FCP 7 XML (.xml).
    """
    if not os.path.exists(json_path):
        print(f"❌ ERRORE XML: File JSON mancante: {json_path}")
        return
        
    with open(json_path, 'r') as f:
        data = json.load(f)
        
    cuts_list = data.get("final_edit_timeline", [])
    if not cuts_list:
        cuts_list = data.get("stringout_timeline", [])
        
    if not cuts_list:
        print(f"⚠️ Nessun taglio da esportare in XML nel file {json_path}")
        return

    # Calcolo durata totale
    last_cut = cuts_list[-1]
    total_timeline_sec = last_cut.get("timeline_out", last_cut.get("end_sec", 0.0))
    total_duration_frames = sec_to_frame(total_timeline_sec, fps)

    # Inizializza Root XML
    xmeml = ET.Element("xmeml", version="5.0")
    project = ET.SubElement(xmeml, "project")
    ET.SubElement(project, "name").text = f"{sequence_name}_Project"
    children = ET.SubElement(project, "children")
    
    sequence = ET.SubElement(children, "sequence", id="sequence-1")
    ET.SubElement(sequence, "name").text = sequence_name
    ET.SubElement(sequence, "duration").text = str(total_duration_frames)
    build_rate_node(sequence, fps)
    
    media = ET.SubElement(sequence, "media")
    video = ET.SubElement(media, "video")
    
    # Formato Base Video
    fmt = ET.SubElement(video, "format")
    sc = ET.SubElement(fmt, "samplecharacteristics")
    ET.SubElement(sc, "width").text = str(width)
    ET.SubElement(sc, "height").text = str(height)
    ET.SubElement(sc, "pixelaspectratio").text = "square"
    build_rate_node(sc, fps)

    # Tracce Video
    track_v1 = ET.SubElement(video, "track")
    track_v2 = ET.SubElement(video, "track")
    
    registered_files = {} # id -> node
    
    for idx, cut in enumerate(cuts_list):
        # Supporta sia il formato final_edit_timeline sia stringout_timeline
        # Questi valori "source_in/out" nel JSON sono in realtà relativi alla timeline dello stringout
        stringout_in_sec = cut.get("source_in", cut.get("start_sec", 0.0))
        stringout_out_sec = cut.get("source_out", cut.get("end_sec", 0.0))
        
        timeline_in_sec = cut.get("timeline_in", cut.get("start", 0.0))
        timeline_out_sec = cut.get("timeline_out", cut.get("end", 0.0))
        
        # Source clip mapping (per trovare l'MP4 sorgente originale)
        src_start = cut.get("source_clip_start", stringout_in_sec)
        clip_info = find_source_clip_info(src_start, clip_map)
        
        if clip_info:
            file_name = clip_info.get("file_name", "UNKNOWN.mxf")
            file_path = clip_info.get("file_path", file_name)
            
            # Mapping temporale (Local Time zero-based dall'inizio del vero MP4 sorgente)
            local_in_sec = stringout_in_sec - clip_info["timeline_start_sec"]
            local_out_sec = stringout_out_sec - clip_info["timeline_start_sec"]
            
            # Mappa anche il Best Moment se presente
            local_bm_sec = None
            if "_bm_time" in cut:
                local_bm_sec = cut["_bm_time"] - clip_info["timeline_start_sec"]
        else:
            file_name = "UNKNOWN.mxf"
            file_path = "UNKNOWN.mxf"
            local_in_sec = stringout_in_sec
            local_out_sec = stringout_out_sec
            local_bm_sec = cut.get("_bm_time", None)
            
        # Matematica frame basata sul Local Time
        s_in = sec_to_frame(local_in_sec, fps)
        s_out = sec_to_frame(local_out_sec, fps)
        t_in = sec_to_frame(timeline_in_sec, fps)
        t_out = sec_to_frame(timeline_out_sec, fps)
        
        file_id = f"file-{file_name.replace(' ', '_').replace('.', '_')}"
        
        # Gestione File ID Univoci
        if file_id not in registered_files:
            file_node = get_file_node(file_id, file_path, file_name, fps)
            registered_files[file_id] = True
        else:
            file_node = ET.Element("file", id=file_id) # Solo la ref
            
        # Creazione clipitem
        clipitem_id = f"clipitem-{idx}"
        duration_frames = s_out - s_in
        
        clipitem = build_clipitem(
            clip_id=clipitem_id,
            name=file_name,
            duration_frames=duration_frames,
            timeline_in_frames=t_in,
            timeline_out_frames=t_out,
            source_in_frames=s_in,
            source_out_frames=s_out,
            file_elem=file_node,
            fps=fps
        )
        
        # Marker Injection
        if cut.get("role") == "PILLAR" and local_bm_sec is not None:
            # Il marker in XML FCP7 si posiziona dentro il <clipitem>
            # <in> e <out> devono essere identici per definire un singolo "punto" nel tempo
            marker_frame = sec_to_frame(local_bm_sec, fps)
            
            marker = ET.SubElement(clipitem, "marker")
            ET.SubElement(marker, "name").text = "MUST BE"
            ET.SubElement(marker, "in").text = str(marker_frame)
            ET.SubElement(marker, "out").text = str(marker_frame)
            
        # Multitraccia: B-ROLL su V2, altri su V1
        if cut.get("tag") == "B-ROLL":
            track_v2.append(clipitem)
        else:
            track_v1.append(clipitem)

    # --- Traccia Audio (BGM) ---
    if audio_bgm_path and os.path.exists(audio_bgm_path):
        audio = ET.SubElement(media, "audio")
        a_format = ET.SubElement(audio, "format")
        a_sc = ET.SubElement(a_format, "samplecharacteristics")
        ET.SubElement(a_sc, "depth").text = "16"
        ET.SubElement(a_sc, "samplerate").text = "48000"
        
        track_a1 = ET.SubElement(audio, "track")
        
        audio_name = os.path.basename(audio_bgm_path)
        audio_file_id = "file-bgm"
        audio_file_node = get_file_node(audio_file_id, audio_bgm_path, audio_name, fps, is_audio=True)
        
        audio_clipitem = build_clipitem(
            clip_id="clipitem-audio-1",
            name=audio_name,
            duration_frames=total_duration_frames,
            timeline_in_frames=0,
            timeline_out_frames=total_duration_frames,
            source_in_frames=0,
            source_out_frames=total_duration_frames,
            file_elem=audio_file_node,
            is_audio=True,
            fps=fps
        )
        track_a1.append(audio_clipitem)

    # Scrittura su file
    xml_str = prettify(xmeml)
    
    # Aggiungi direttiva XML e rimuovi quella autogenerata da minidom
    xml_lines = xml_str.split('\n')
    if xml_lines[0].startswith('<?xml'):
        xml_lines = xml_lines[1:]
    
    final_xml = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n' + '\n'.join(xml_lines)
    
    os.makedirs(os.path.dirname(os.path.abspath(output_xml_path)), exist_ok=True)
    with open(output_xml_path, 'w', encoding='utf-8') as f:
        f.write(final_xml)
        
    print(f"✅ XML esportato con successo in: {output_xml_path}")
    return output_xml_path

if __name__ == "__main__":
    print("Test microservizio xml_exporter.py")
