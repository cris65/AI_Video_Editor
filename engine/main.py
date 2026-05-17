import os
import sys
import glob
import shutil

# Import dei microservizi (Symmetrical EDL Workflow)
import edl_parser
import pancake_editor
import edl_exporter
import mlx_client

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIR_INPUT = os.path.join(BASE_DIR, 'input')
DIR_OUTPUT = os.path.join(BASE_DIR, 'output')
DIR_ARCHIVE = os.path.join(BASE_DIR, 'archive')

def setup_directories():
    """Crea le cartelle necessarie se non esistono."""
    os.makedirs(DIR_INPUT, exist_ok=True)
    os.makedirs(DIR_OUTPUT, exist_ok=True)
    os.makedirs(DIR_ARCHIVE, exist_ok=True)

def get_dynamic_inputs():
    """Scansiona la cartella di input per trovare il primo file .edl e un file video supportato."""
    edl_files = glob.glob(os.path.join(DIR_INPUT, '*.edl'))
    
    video_exts = ('*.mp4', '*.mov', '*.mxf', '*.avi', '*.mkv')
    vid_files = []
    for ext in video_exts:
        vid_files.extend(glob.glob(os.path.join(DIR_INPUT, ext)))
        vid_files.extend(glob.glob(os.path.join(DIR_INPUT, ext.upper())))
    
    edl_in = edl_files[0] if edl_files else None
    proxy_in = vid_files[0] if vid_files else None
    
    return edl_in, proxy_in

def cleanup_inputs(edl_path, proxy_path, sequence_name):
    """Sposta i file processati nella dir specifica di output per non lasciare strascichi."""
    dest_dir = os.path.join(DIR_OUTPUT, sequence_name)
    os.makedirs(dest_dir, exist_ok=True)
    try:
        if edl_path and os.path.exists(edl_path):
            shutil.move(edl_path, os.path.join(dest_dir, os.path.basename(edl_path)))
        if proxy_path and os.path.exists(proxy_path):
            shutil.move(proxy_path, os.path.join(dest_dir, os.path.basename(proxy_path)))
        print(f"\n🧹 Cleanup completato: File originali spostati in {sequence_name}/")
    except Exception as e:
        print(f"\n⚠️ Impossibile spostare i file in {sequence_name}/: {e}")

def run_pipeline():
    """
    Esegue la pipeline di orchestrazione con approvazione Human-in-the-Loop.
    Switch Architetturale: Propagazione Dinamica del Nome Sequenza
    """
    print("==========================================================")
    print("🎬 PANCAKE ENGINE: Avvio Pipeline Orchestrata (Dinamica Totale)")
    print("==========================================================")
    
    setup_directories()
    
    # ============================================================
    # 0. CONTROLLO PRE-FLIGHT DINAMICO
    # ============================================================
    FILE_EDL_IN, FILE_PROXY_IN = get_dynamic_inputs()
    
    if not FILE_EDL_IN:
        print(f"❌ ERRORE PRE-FLIGHT: Nessun file .edl trovato in {DIR_INPUT}")
        sys.exit(1)
        
    if not FILE_PROXY_IN:
        print(f"❌ ERRORE PRE-FLIGHT: Nessun video proxy trovato in {DIR_INPUT} (supportati: .mp4, .mov, .mxf, .avi)")
        sys.exit(1)
        
    print(f"✅ Pre-Flight Check passato.")
    print(f"   - Input EDL: {os.path.basename(FILE_EDL_IN)}")
    print(f"   - Input PROXY: {os.path.basename(FILE_PROXY_IN)}")

    # ============================================================
    # 1. FASE A: ANALISI (Ingest EDL + AI Cut)
    # ============================================================
    print("\n--- FASE A: Analisi EDL e Pancake Cut ---")
    try:
        # Estrazione mappa da EDL
        print("⏳ Lettura Ingest EDL...")
        sequence_name, clip_map = edl_parser.parse_ingest_edl(FILE_EDL_IN)
        
        # Esecuzione Engine Video AI con Propagazione Sequence Name e Mappa
        print("⏳ Avvio Elaborazione Pancake Editor (YOLO + OpenCV)...")
        json_main_path, preview_main_path, valid_cuts_count, trash_preview_path = pancake_editor.process_pancake_video(FILE_PROXY_IN, sequence_name, clip_map)
        
        # Override del json_main_path per puntare rigorosamente al "Director Package"
        json_main_path = os.path.join(DIR_OUTPUT, sequence_name, "LLM_Export_Package", f"{sequence_name}_stringout.json")
        
    except Exception as e:
        print(f"❌ ERRORE CRITICO in Fase A: {e}")
        sys.exit(1)
        
    if valid_cuts_count == 0 or not json_main_path:
        print("⚠️ Nessun taglio valido generato dall'AI. Pipeline interrotta.")
        sys.exit(0)

    tag_counts = {}
    try:
        import json
        with open(json_main_path, 'r') as f:
            data = json.load(f)
            timeline = data.get("stringout_timeline", [])
            for clip in timeline:
                tag = clip.get("tag", "UNKNOWN")
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
    except Exception as e:
        pass

    # ============================================================
    # 2. GATE DI APPROVAZIONE (Human-in-the-Loop)
    # ============================================================
    print("\n==========================================================")
    print("🔔 ATTENZIONE: Elaborazione Completata.")
    print(f"L'Intelligenza Artificiale ha generato {valid_cuts_count} subclip totali.")
    print("Dettaglio Categorie:")
    for tag_name, count in tag_counts.items():
        print(f"- {tag_name}: {count}")
    print(f"\nControlla l'anteprima video qui: {preview_main_path}")
    if trash_preview_path:
        print(f"Controlla gli scarti (Trash Reel) qui: {trash_preview_path}")
    print("==========================================================")
        
    # ============================================================
    # 3. FASE B: ANALISI SEMANTICA (MLX Server - Vision LLM)
    # ============================================================
    print("\n--- FASE B: Analisi Semantica Vision (MLX Server) ---")
    if mlx_client.check_mlx_server_health():
        print("✅ Server MLX rilevato e attivo. Avvio arricchimento metadati...")
        mlx_client.process_stringout_batch(json_main_path)
    else:
        print("⚠️ Server MLX (127.0.0.1:8080) offline o irraggiungibile. Skip arricchimento semantico.")
        
    # ============================================================
    # 4. FASE C: EXPORT EDL
    # ============================================================
    print("\n--- FASE C: Generazione Timeline EDL ---")
    try:
        # Crea la cartella se non esiste
        seq_output_dir = os.path.join(DIR_OUTPUT, sequence_name)
        os.makedirs(seq_output_dir, exist_ok=True)
        
        FILE_EDL_OUT = os.path.join(seq_output_dir, f"{sequence_name}_Stringout_Cut.edl")
        
        edl_exporter.export_to_edl(
            json_path=json_main_path,
            sequence_name=f"{sequence_name}_Stringout",
            clip_map=clip_map,
            output_edl_path=FILE_EDL_OUT,
            fps=25
        )
    except Exception as e:
        print(f"❌ ERRORE CRITICO in Fase B: {e}")
        sys.exit(1)

    print(f"\n✅ PIPELINE COMPLETATA. Il file EDL CMX3600 ({os.path.basename(FILE_EDL_OUT)}) è pronto per l'importazione in Adobe Premiere.")
    cleanup_inputs(FILE_EDL_IN, FILE_PROXY_IN, sequence_name)

if __name__ == "__main__":
    run_pipeline()
