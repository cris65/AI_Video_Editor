import sys
import os
import glob

# Assicuriamoci che il modulo engine sia nel path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import director
import edl_parser
import xml_exporter

def update_cut(sequence):
    print(f"🔄 Avvio aggiornamento cut per la sequenza: {sequence}")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    seq_dir = os.path.join(base_dir, 'output', sequence)
    llm_export_dir = os.path.join(seq_dir, 'LLM_Export_Package')
    
    # 1. Rigenera il Final Cut (JSON)
    stringout_path = os.path.join(llm_export_dir, f"{sequence}_stringout.json")
    hitl_path = os.path.join(llm_export_dir, f"{sequence}_hitl_data.json")
    beats_path = os.path.join(llm_export_dir, f"{sequence}_audio_beats.json")
    
    # Estrai FPS reale dal JSON stringout
    fps = 25.0
    if os.path.exists(stringout_path):
        import json
        try:
            with open(stringout_path, 'r') as f:
                s_data = json.load(f)
                fps = s_data.get("metadata", {}).get("fps", 25.0)
        except Exception as e:
            print(f"⚠️ Impossibile leggere FPS da stringout, fallback a 25: {e}")
            
    # Estrai export resolution da hitl_data se presente
    export_width = 1920
    export_height = 1080
    if os.path.exists(hitl_path):
        import json
        try:
            with open(hitl_path, 'r') as f:
                h_data = json.load(f)
                res_str = h_data.get("director_config", {}).get("export_resolution", "1920x1080")
                if "x" in res_str:
                    parts = res_str.split("x")
                    export_width = int(parts[0])
                    export_height = int(parts[1])
        except Exception as e:
            print(f"⚠️ Impossibile leggere export_resolution da hitl_data, fallback a 1920x1080: {e}")

    final_edit_json = director.generate_final_cut(stringout_path, hitl_path, beats_path, llm_export_dir, sequence)
    
    # 2. Recupera la clip_map originale dall'EDL di ingest
    # Cerchiamo un .edl nella root della sequenza che NON sia quello generato da noi
    edl_files = [f for f in glob.glob(os.path.join(seq_dir, '*.edl')) if not f.endswith('_Stringout_Cut.edl')]
    clip_map = []
    if edl_files:
        print(f"🔍 Trovato EDL ingest originale: {os.path.basename(edl_files[0])}")
        _, clip_map = edl_parser.parse_ingest_edl(edl_files[0])
    else:
        print("⚠️ Nessun EDL ingest trovato. L'XML potrebbe non contenere i riferimenti originali ai file.")
    
    # 3. Esporta FCP 7 XML
    if final_edit_json and os.path.exists(final_edit_json):
        FILE_XML_OUT = os.path.join(llm_export_dir, f"{sequence}_FinalCut.xml")
        bgm_wav_path = os.path.join(llm_export_dir, f"{sequence}_bgm.wav")
        
        print(f"⚙️ Generazione dell'XML per Adobe Premiere ({export_width}x{export_height})...")
        xml_exporter.export_to_xml(
            json_path=final_edit_json,
            clip_map=clip_map,
            output_xml_path=FILE_XML_OUT,
            sequence_name=f"{sequence}_FinalCut",
            audio_bgm_path=bgm_wav_path if os.path.exists(bgm_wav_path) else None,
            fps=fps,
            width=export_width,
            height=export_height
        )
        print("✅ Aggiornamento completato con successo.")
    else:
        print("❌ Errore: Final Cut JSON non trovato.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        update_cut(sys.argv[1])
    else:
        print("Usage: python update_cut.py <sequence_name>")
