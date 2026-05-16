import json
import xml.etree.ElementTree as ET
from xml.dom import minidom
import os

def _float_to_fcpxml_time(seconds, fps=25):
    """
    Converte i float timecode in notazione frazionaria FCPXML compatibile con Premiere.
    Per 25fps, FCPXML solitamente usa denominatori basati su multipli di 25 (es. 2500s).
    """
    den = fps * 100
    num = int(round(seconds * den))
    return f"{num}/{den}s"

def export_to_fcpxml(json_path, output_xml_path, sequence_name="AI Pancake Editor Timeline", fps=25):
    """
    Legge un JSON contenente array di clips (decisioni di editing dell'AI) 
    e li converte in un formato standard FCPXML compatibile con Adobe Premiere.
    """
    # 1. Lettura dati dal JSON
    with open(json_path, 'r') as f:
        data = json.load(f)
        
    # Supporto per due formati JSON: 
    # Formato A: [{"file_name": "...", "source_start_sec": 1.0, "source_end_sec": 5.0}]
    # Formato B (nostro pancake_cuts.json): {"cuts": [{"start_sec": 1.0, "end_sec": 5.0}], "track_type": "main"}
    clips_list = []
    if isinstance(data, list):
        clips_list = data
    elif isinstance(data, dict) and "cuts" in data:
        clips_list = data["cuts"]
        
    if not clips_list:
        print(f"⚠️ Nessun taglio trovato nel file {json_path}")
        return

    # 2. Costruzione dell'albero FCPXML
    fcpxml = ET.Element("fcpxml", version="1.9")
    resources = ET.SubElement(fcpxml, "resources")
    
    # Crea un project e una sequence
    project = ET.SubElement(fcpxml, "project", name=sequence_name)
    sequence = ET.SubElement(project, "sequence")
    spine = ET.SubElement(sequence, "spine")
    
    # Teniamo traccia del timeline offset per concatenare le clip una dopo l'altra
    current_timeline_offset = 0.0

    # Risorse cache (per evitare di duplicare i tag <asset>)
    asset_id_map = {}
    asset_counter = 1

    # 3. Iterazione e popolazione delle clip
    for idx, clip_data in enumerate(clips_list):
        # Mappatura dei campi in base a come li chiama il JSON fornito (robusto a varianti)
        file_name = clip_data.get("file_name", "input.mp4")
        start_sec = clip_data.get("source_start_sec", clip_data.get("start_sec", 0.0))
        end_sec = clip_data.get("source_end_sec", clip_data.get("end_sec", 0.0))
        duration_sec = end_sec - start_sec
        
        if duration_sec <= 0:
            continue
            
        # Gestione della risorsa
        if file_name not in asset_id_map:
            r_id = f"r{asset_counter}"
            asset_id_map[file_name] = r_id
            asset_counter += 1
            
            # Aggiunge risorsa nel tag <resources>
            ET.SubElement(resources, "asset", id=r_id, name=file_name)
        
        r_id = asset_id_map[file_name]
        
        # Conversione tempi
        offset_fcpxml = _float_to_fcpxml_time(current_timeline_offset, fps)
        start_fcpxml = _float_to_fcpxml_time(start_sec, fps)
        duration_fcpxml = _float_to_fcpxml_time(duration_sec, fps)
        
        # Creazione del nodo <clip> / <asset-clip>
        clip_node = ET.SubElement(spine, "asset-clip", 
            name=f"Cut_{idx+1}_{file_name}",
            ref=r_id,
            offset=offset_fcpxml,
            start=start_fcpxml,
            duration=duration_fcpxml
        )
        
        # Aggiorna il playhead per la prossima clip sulla timeline
        current_timeline_offset += duration_sec

    # 4. Scrittura del file XML indentato correttamente
    xml_string = ET.tostring(fcpxml, encoding='utf-8')
    parsed_xml = minidom.parseString(xml_string)
    pretty_xml = parsed_xml.toprettyxml(indent="  ")
    
    os.makedirs(os.path.dirname(os.path.abspath(output_xml_path)), exist_ok=True)
    
    with open(output_xml_path, "w", encoding="utf-8") as f:
        # FCPXML solitamente include il DTD, ma per test va benissimo la dichiarazione xml standard.
        # Il topettyxml aggiunge già <?xml version="1.0" ?>
        f.write(pretty_xml)
        
    print(f"✅ FCPXML generato con successo in: {output_xml_path}")

# ==============================================================================
# MOCK TEST
# ==============================================================================
if __name__ == "__main__":
    print("🚀 Test del Microservizio XML Exporter: xml_exporter.py")
    
    # 1. Creazione file JSON temporaneo di mock per il test
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    OUTPUT_DIR = os.path.join(BASE_DIR, 'output')
    MOCK_JSON_PATH = os.path.join(OUTPUT_DIR, 'mock_exporter_data.json')
    TEST_XML_OUTPUT = os.path.join(OUTPUT_DIR, 'final_timeline.xml')
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    mock_data = [
        {
            "file_name": "A001_C002_RAW.MXF",
            "source_start_sec": 10.0,
            "source_end_sec": 40.5
        },
        {
            "file_name": "A001_C003_RAW.MXF",
            "source_start_sec": 5.25,
            "source_end_sec": 10.25
        }
    ]
    
    with open(MOCK_JSON_PATH, 'w') as f:
        json.dump(mock_data, f, indent=2)
        
    print(f"⏳ File mock JSON creato. Avvio conversione a FCPXML (25fps)...")
    
    # 2. Esecuzione esportazione
    export_to_fcpxml(MOCK_JSON_PATH, TEST_XML_OUTPUT, fps=25)
    
    # 3. Validazione finale (lettura prime righe)
    if os.path.exists(TEST_XML_OUTPUT):
        with open(TEST_XML_OUTPUT, 'r') as f:
            preview = f.read(500)
            print("\n📊 Anteprima FCPXML Generato:")
            print(preview + "\n...")
            print("\n✅ Microservizio Exporter validato.")
