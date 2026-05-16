import xml.etree.ElementTree as ET
import os

def _parse_time_to_float(time_str):
    """
    Converte i formati timecode XML esportati da Premiere/Final Cut in float.
    Spesso Premiere esporta i tempi in FCPXML come '30s', '360000/1000s' o '30.5'.
    """
    if not time_str:
        return 0.0
        
    # Rimuove la 's' tipica del formato FCPXML
    clean_str = time_str.replace('s', '').strip()
    
    # Gestione delle frazioni razionali (es: 1001/30000)
    if '/' in clean_str:
        num, den = clean_str.split('/')
        return float(num) / float(den)
        
    return float(clean_str)

def parse_ingest_xml(xml_path_or_string, is_string=False):
    """
    Legge un file XML (o una stringa per test) in formato FCPXML (Premiere/FCP).
    Estrae la mappa temporale delle clip nella timeline.
    
    In FCPXML:
    - 'name': Nome del file (o ref id).
    - 'offset': Start time nella timeline (timeline_start_sec).
    - 'duration': Durata della clip. timeline_end_sec = offset + duration.
    - 'start': In-point della clip sorgente (source_start_sec).
    """
    if is_string:
        root = ET.fromstring(xml_path_or_string)
    else:
        if not os.path.exists(xml_path_or_string):
            raise FileNotFoundError(f"Il file XML non esiste: {xml_path_or_string}")
        tree = ET.parse(xml_path_or_string)
        root = tree.getroot()

    clips_data = []

    # Ricerca iterativa per tutti gli elementi che rappresentano clip.
    # In FCPXML, i tag comuni sono <clip>, <asset-clip>, <video>, <title>, ecc.
    # Per robustezza, cerchiamo qualsiasi nodo che contenga attributi temporali utili.
    valid_tags = ['clip', 'asset-clip', 'video']
    
    for tag in valid_tags:
        for element in root.iter(tag):
            # Controlla se il nodo ha gli attributi temporali di base
            if 'duration' in element.attrib and ('offset' in element.attrib or 'start' in element.attrib):
                
                # Nome del file (in FCPXML spesso è 'name', altrimenti fallback su 'ref' o ID)
                file_name = element.attrib.get('name', 'Unknown_Asset.MXF')
                
                # Offset in FCPXML è la posizione di attacco sulla Timeline
                offset_str = element.attrib.get('offset', '0s')
                timeline_start_sec = _parse_time_to_float(offset_str)
                
                # Duration è la lunghezza della clip
                duration_str = element.attrib.get('duration', '0s')
                duration_sec = _parse_time_to_float(duration_str)
                
                timeline_end_sec = timeline_start_sec + duration_sec
                
                # Start è il timecode di partenza sul media sorgente (in-point)
                start_str = element.attrib.get('start', '0s')
                source_start_sec = _parse_time_to_float(start_str)
                
                clips_data.append({
                    "file_name": file_name,
                    "timeline_start_sec": float(round(timeline_start_sec, 3)),
                    "timeline_end_sec": float(round(timeline_end_sec, 3)),
                    "source_start_sec": float(round(source_start_sec, 3))
                })

    return clips_data

# ==============================================================================
# MOCK TEST
# ==============================================================================
if __name__ == "__main__":
    print("🚀 Test del Microservizio Ingest: xml_parser.py")
    
    # Mock di un file FCPXML standard esportato da Premiere
    MOCK_XML_STRING = """<?xml version="1.0" encoding="UTF-8"?>
    <fcpxml version="1.9">
        <project name="Ingest Timeline">
            <sequence>
                <spine>
                    <!-- Esempio 1: Clip classica con secondi interi -->
                    <clip name="A001_C002_RAW.MXF" offset="0s" duration="30.5s" start="3600s">
                        <video ref="r1"/>
                    </clip>
                    
                    <!-- Esempio 2: Clip con frazioni razionali tipiche di NTSC 29.97/59.94 -->
                    <asset-clip name="B099_C010_PROXY.mp4" offset="30.5s" duration="10010/1000s" start="15s"/>
                    
                    <!-- Esempio 3: Senza 's' (strutture corrotte/alternative) -->
                    <video name="C003_DRONE_SHOT.mov" offset="40.51" duration="15.25" start="0.0"/>
                </spine>
            </sequence>
        </project>
    </fcpxml>
    """
    
    print("\n⏳ Parsing del mock XML...")
    parsed_clips = parse_ingest_xml(MOCK_XML_STRING, is_string=True)
    
    import json
    print("\n📊 Risultato Estratto:")
    print(json.dumps(parsed_clips, indent=2))
    
    print("\n✅ Microservizio Parser validato.")
