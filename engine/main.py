import os
import sys
import glob

# Import dei microservizi (Symmetrical EDL Workflow)
import edl_parser
import pancake_editor
import edl_exporter

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIR_INPUT = os.path.join(BASE_DIR, 'input')
DIR_OUTPUT = os.path.join(BASE_DIR, 'output')

def setup_directories():
    """Crea le cartelle necessarie se non esistono."""
    os.makedirs(DIR_INPUT, exist_ok=True)
    os.makedirs(DIR_OUTPUT, exist_ok=True)

def get_dynamic_inputs():
    """Scansiona la cartella di input per trovare il primo file .edl e .mp4."""
    edl_files = glob.glob(os.path.join(DIR_INPUT, '*.edl'))
    mp4_files = glob.glob(os.path.join(DIR_INPUT, '*.mp4'))
    
    edl_in = edl_files[0] if edl_files else None
    proxy_in = mp4_files[0] if mp4_files else None
    
    return edl_in, proxy_in

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
        print(f"❌ ERRORE PRE-FLIGHT: Nessun video proxy .mp4 trovato in {DIR_INPUT}")
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
        
        # Esecuzione Engine Video AI con Propagazione Sequence Name
        print("⏳ Avvio Elaborazione Pancake Editor (YOLO + OpenCV)...")
        json_main_path, preview_main_path, valid_cuts_count = pancake_editor.process_pancake_video(FILE_PROXY_IN, sequence_name)
        
    except Exception as e:
        print(f"❌ ERRORE CRITICO in Fase A: {e}")
        sys.exit(1)
        
    if valid_cuts_count == 0 or not json_main_path:
        print("⚠️ Nessun taglio valido generato dall'AI. Pipeline interrotta.")
        sys.exit(0)

    # ============================================================
    # 2. GATE DI APPROVAZIONE (Human-in-the-Loop)
    # ============================================================
    print("\n==========================================================")
    print(f"🔔 ATTENZIONE: Elaborazione Completata.")
    print(f"L'Intelligenza Artificiale ha generato {valid_cuts_count} subclip perfette per la Main Track.")
    print(f"Controlla l'anteprima video qui: {preview_main_path}")
    print("==========================================================")
    
    approval = input(f"Guarda il file {os.path.basename(preview_main_path)}. Approvi la generazione dell'EDL per Premiere? [Y/N]: ")
    
    if approval.strip().lower() not in ['y', 'yes']:
        print("\n❌ Esportazione Annullata. Esco in modo pulito.")
        sys.exit(0)
        
    # ============================================================
    # 3. FASE B: EXPORT
    # ============================================================
    print("\n--- FASE B: Generazione Timeline EDL ---")
    try:
        FILE_EDL_OUT = os.path.join(DIR_OUTPUT, f"{sequence_name}_Pancake_Cut.edl")
        
        edl_exporter.export_to_edl(
            json_path=json_main_path,
            sequence_name=f"{sequence_name}_Pancake",
            clip_map=clip_map,
            output_edl_path=FILE_EDL_OUT,
            fps=25
        )
    except Exception as e:
        print(f"❌ ERRORE CRITICO in Fase B: {e}")
        sys.exit(1)

    print(f"\n✅ PIPELINE COMPLETATA. Il file EDL CMX3600 ({os.path.basename(FILE_EDL_OUT)}) è pronto per l'importazione in Adobe Premiere.")

if __name__ == "__main__":
    run_pipeline()
