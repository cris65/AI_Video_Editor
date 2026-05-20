import os
import sys
import glob
import json
import shutil
import argparse

# Import dei microservizi (Symmetrical EDL Workflow)
import edl_parser
import pancake_editor
import edl_exporter
import xml_exporter
import mlx_client
import bgm_generator
import audio_analyzer
import director

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIR_INPUT = os.path.join(BASE_DIR, 'input')
DIR_OUTPUT = os.path.join(BASE_DIR, 'output')
DIR_ARCHIVE = os.path.join(BASE_DIR, 'archive')


def parse_args():
    """Parsa gli argomenti CLI. --force disabilita lo Smart Resume."""
    parser = argparse.ArgumentParser(
        description="🎬 Pancake Engine — Pipeline Orchestrata AI Video Editor"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Disabilita lo Smart Resume e riesegue tutte le fasi da zero, ignorando la cache."
    )
    return parser.parse_args()


def setup_directories():
    """Crea le cartelle necessarie se non esistono."""
    os.makedirs(DIR_INPUT, exist_ok=True)
    os.makedirs(DIR_OUTPUT, exist_ok=True)
    os.makedirs(DIR_ARCHIVE, exist_ok=True)


def get_dynamic_inputs():
    """
    Scansiona la cartella input/ per trovare EDL e video proxy.
    Fallback automatico: se input/ è vuota (cleanup post-run eseguito),
    scansiona la sottodirectory di output più recente dove cleanup() ha spostato i file.
    """
    video_exts = ('*.mp4', '*.mov', '*.mxf', '*.avi', '*.mkv')

    edl_files = glob.glob(os.path.join(DIR_INPUT, '*.edl'))
    vid_files = []
    for ext in video_exts:
        vid_files.extend(glob.glob(os.path.join(DIR_INPUT, ext)))
        vid_files.extend(glob.glob(os.path.join(DIR_INPUT, ext.upper())))

    # Fallback: dopo un run completato i file sono in output/{sequence}/
    if not edl_files:
        output_subdirs = sorted(
            [d for d in glob.glob(os.path.join(DIR_OUTPUT, '*/')) if os.path.isdir(d)],
            key=os.path.getmtime,
            reverse=True  # Directory più recente prima
        )
        for subdir in output_subdirs:
            all_edl = glob.glob(os.path.join(subdir, '*.edl'))
            # CRITICAL: esclude gli EDL esportati da Fase E (suffisso _Cut.edl)
            fallback_edl = [f for f in all_edl if not os.path.basename(f).endswith('_Cut.edl')]
            if fallback_edl:
                edl_files = fallback_edl
                print(f"   ↳ [Pre-Flight Fallback] EDL originale trovato in: .../{os.path.basename(subdir.rstrip('/'))}/")
                if not vid_files:
                    for ext in video_exts:
                        candidates = glob.glob(os.path.join(subdir, ext))
                        candidates += glob.glob(os.path.join(subdir, ext.upper()))
                        # CRITICAL: esclude i video generati dalla pipeline (_preview_, _TRASH)
                        candidates = [
                            f for f in candidates
                            if '_preview_' not in os.path.basename(f)
                            and '_TRASH' not in os.path.basename(f)
                        ]
                        vid_files.extend(candidates)
                break

    edl_in = edl_files[0] if edl_files else None
    proxy_in = vid_files[0] if vid_files else None

    return edl_in, proxy_in


def load_phase_a_cache(json_path):
    """
    Tenta di caricare i dati di Fase A da cache.
    Ritorna (data, timeline) se validi e popolati, (None, None) altrimenti.
    """
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        timeline = data.get("stringout_timeline", [])
        if timeline and len(timeline) > 0:
            return data, timeline
    except Exception:
        pass
    return None, None


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


def run_pipeline(force: bool = False):
    """
    Esegue la pipeline di orchestrazione con Smart Resume.
    Se force=True, ignora la cache e riesegue tutto da zero.
    """
    print("==========================================================")
    print("🎬 PANCAKE ENGINE: Avvio Pipeline Orchestrata (Dinamica Totale)")
    print("==========================================================")

    if force:
        print("⚡ [FORCE MODE] Smart Resume disabilitato. Ricalcolo completo forzato.\n")

    setup_directories()

    # ============================================================
    # 0. CONTROLLO PRE-FLIGHT DINAMICO
    # ============================================================
    FILE_EDL_IN, FILE_PROXY_IN = get_dynamic_inputs()

    if not FILE_EDL_IN:
        print(f"❌ ERRORE PRE-FLIGHT: Nessun file .edl trovato in {DIR_INPUT}")
        sys.exit(1)

    print(f"✅ Pre-Flight Check passato.")
    print(f"   - Input EDL: {os.path.basename(FILE_EDL_IN)}")
    if FILE_PROXY_IN:
        print(f"   - Input PROXY: {os.path.basename(FILE_PROXY_IN)}")

    # ============================================================
    # 1. FASE A: ANALISI (Ingest EDL + AI Cut)
    # ============================================================
    print("\n--- FASE A: Analisi EDL e Pancake Cut ---")
    preview_main_path = None
    trash_preview_path = None
    valid_cuts_count = 0

    import time
    from datetime import datetime
    import performance_tracker

    session_start_dt = datetime.now()
    cv_start = time.time()
    cv_duration = 0.0

    try:
        # EDL parsing is always fast — eseguito sempre per ottenere sequence_name e clip_map
        print("⏳ Lettura Ingest EDL...")
        sequence_name, clip_map = edl_parser.parse_ingest_edl(FILE_EDL_IN)

        # Smart Resume: calcola il path della cache PRIMA di decidere
        json_main_path = os.path.join(
            DIR_OUTPUT, sequence_name, "LLM_Export_Package",
            f"{sequence_name}_stringout.json"
        )

        # --- VERIFICA CACHE ---
        phase_a_skipped = False
        if not force and os.path.exists(json_main_path):
            cached_data, cached_timeline = load_phase_a_cache(json_main_path)
            if cached_data is not None:
                phase_a_skipped = True
                valid_cuts_count = len(cached_timeline) if cached_timeline is not None else 0
                preview_main_path = os.path.join(
                    DIR_OUTPUT, sequence_name,
                    f"{sequence_name}_preview_stringout.mp4"
                )
                trash_candidate = os.path.join(
                    DIR_OUTPUT, sequence_name,
                    f"{sequence_name}_preview_TRASH.mp4"
                )
                trash_preview_path = trash_candidate if os.path.exists(trash_candidate) else None
                print(f"🚀 [SMART RESUME] Fase A: Cache HIT ✅")
                print(f"   ↳ {valid_cuts_count} clip trovate nel JSON esistente. Salto YOLO/OpenCV.")
                print(f"   ↳ Usa python main.py --force per ricalcolare dall'inizio.")

        if not phase_a_skipped:
            # CACHE MISS oppure --force: esegue Fase A completa
            if not FILE_PROXY_IN:
                print(f"❌ ERRORE PRE-FLIGHT: Nessun video proxy trovato in {DIR_INPUT} "
                      f"(supportati: .mp4, .mov, .mxf, .avi)")
                sys.exit(1)

            print("⏳ Avvio Elaborazione Pancake Editor (YOLO + OpenCV)...")
            _, preview_main_path, valid_cuts_count, trash_preview_path = \
                pancake_editor.process_pancake_video(FILE_PROXY_IN, sequence_name, clip_map)

            cv_duration = time.time() - cv_start

            # Override del json_main_path per puntare rigorosamente al "Director Package"
            json_main_path = os.path.join(
                DIR_OUTPUT, sequence_name, "LLM_Export_Package",
                f"{sequence_name}_stringout.json"
            )

    except Exception as e:
        print(f"❌ ERRORE CRITICO in Fase A: {e}")
        sys.exit(1)

    if valid_cuts_count == 0 or not json_main_path:
        print("⚠️ Nessun taglio valido generato dall'AI. Pipeline interrotta.")
        sys.exit(0)

    tag_counts = {}
    try:
        with open(json_main_path, 'r') as f:
            data = json.load(f)
            timeline = data.get("stringout_timeline", [])
            for clip in timeline:
                tag = clip.get("tag", "UNKNOWN")
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
    except Exception:
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
    if preview_main_path:
        print(f"\nControlla l'anteprima video qui: {preview_main_path}")
    if trash_preview_path:
        print(f"Controlla gli scarti (Trash Reel) qui: {trash_preview_path}")
    print("==========================================================")

    # ============================================================
    # 3. FASE B: ANALISI SEMANTICA (MLX Server - Vision LLM)
    # ============================================================
    print("\n--- FASE B: Analisi Semantica Vision (MLX Server) ---")
    mlx_start = time.time()
    mlx_duration = 0.0
    vlm_model_id = "mlx-community/gemma-4-e4b-it-4bit"
    if mlx_client.check_mlx_server_health():
        print("✅ Server MLX rilevato e attivo (deep-probe OK). Avvio arricchimento metadati...")
        mlx_client.process_stringout_batch(json_main_path)
        mlx_duration = time.time() - mlx_start
    else:
        print("⚠️  Server MLX non disponibile o incompatibile. Skip Fase B (arricchimento semantico).")
        print("   👉 Per attivare la Fase B, apri un terminale separato ed esegui:")
        print("      cd engine && source venv/bin/activate")
        print("      python -m mlx_lm server --model mlx-community/gemma-4-e4b-it-4bit --port 8080")
        print("   Attendi il messaggio '[INFO] Starting server...' prima di rieseguire main.py.")

    # Record telemetry
    try:
        import cv2
        cap = cv2.VideoCapture(FILE_PROXY_IN or "")
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) if cap.isOpened() else 0
        cap.release()
        
        extracted_frames = max(1, int(total_frames * 0.15))
        
        session_end_dt = datetime.now()
        performance_tracker.record_run(
            vlm_model_id=vlm_model_id,
            session_start_time=session_start_dt.isoformat(),
            session_end_time=session_end_dt.isoformat(),
            total_frames=total_frames,
            extracted_frames=extracted_frames,
            cv_duration_sec=cv_duration,
            mlx_duration_sec=mlx_duration
        )
        print("📊 Telemetry recorded successfully to performance history.")
    except Exception as telemetry_err:
        print(f"⚠️ Failed to record telemetry run: {telemetry_err}")

    # ============================================================
    # 4. FASE C: GENERAZIONE AUDIO E BEAT EXTRACTION
    # ============================================================
    print("\n--- FASE C: Generazione BGM e Analisi Beat ---")
    try:
        seq_llm_export_dir = os.path.join(DIR_OUTPUT, sequence_name, "LLM_Export_Package")
        bgm_wav_path = bgm_generator.generate_bgm(json_main_path, seq_llm_export_dir, sequence_name)
        if bgm_wav_path:
            audio_analyzer.extract_beats(bgm_wav_path, seq_llm_export_dir, sequence_name)
    except Exception as e:
        print(f"❌ ERRORE in Fase C (Audio): {e}")

    # ============================================================
    # 5. FASE D: THE AI DIRECTOR (FINAL CUT)
    # ============================================================
    print("\n--- FASE D: L'AI Director (Risoluzione Vincoli) ---")
    final_edit_json = None
    try:
        seq_llm_export_dir = os.path.join(DIR_OUTPUT, sequence_name, "LLM_Export_Package")
        hitl_path = os.path.join(seq_llm_export_dir, f"{sequence_name}_hitl_data.json")
        beats_path = os.path.join(seq_llm_export_dir, f"{sequence_name}_audio_beats.json")

        final_edit_json = director.generate_final_cut(
            stringout_path=json_main_path,
            hitl_path=hitl_path,
            beats_path=beats_path,
            output_dir=seq_llm_export_dir,
            sequence_name=sequence_name
        )
    except Exception as e:
        print(f"❌ ERRORE in Fase D (Director): {e}")

    # ============================================================
    # 6. FASE E: EXPORT EDL & XML
    # ============================================================
    print("\n--- FASE E: Generazione Timeline EDL & XML ---")

    # Estrazione FPS dinamico da Stringout
    fps = 25.0
    try:
        with open(json_main_path, 'r') as f:
            s_data = json.load(f)
            fps = s_data.get("metadata", {}).get("fps", 25.0)
    except Exception:
        pass

    FILE_XML_OUT = None
    try:
        seq_output_dir = os.path.join(DIR_OUTPUT, sequence_name)
        os.makedirs(seq_output_dir, exist_ok=True)

        FILE_EDL_OUT = os.path.join(seq_output_dir, f"{sequence_name}_Stringout_Cut.edl")

        edl_exporter.export_to_edl(
            json_path=json_main_path,
            sequence_name=f"{sequence_name}_Stringout",
            clip_map=clip_map,
            output_edl_path=FILE_EDL_OUT,
            fps=fps
        )

        # Generazione XML del Director's Cut
        if final_edit_json and os.path.exists(final_edit_json):
            seq_llm_export_dir = os.path.join(DIR_OUTPUT, sequence_name, "LLM_Export_Package")
            FILE_XML_OUT = os.path.join(seq_llm_export_dir, f"{sequence_name}_FinalCut.xml")

            bgm_wav_path = os.path.join(seq_llm_export_dir, f"{sequence_name}_bgm.wav")

            xml_exporter.export_to_xml(
                json_path=final_edit_json,
                clip_map=clip_map,
                output_xml_path=FILE_XML_OUT,
                sequence_name=f"{sequence_name}_FinalCut",
                audio_bgm_path=bgm_wav_path if os.path.exists(bgm_wav_path) else None,
                fps=fps
            )
        else:
            print("⚠️ Nessun Final Cut trovato. Salto l'esportazione XML.")

    except Exception as e:
        print(f"❌ ERRORE CRITICO in Fase E: {e}")
        sys.exit(1)

    edl_name = os.path.basename(FILE_EDL_OUT) if 'FILE_EDL_OUT' in locals() else 'N/A'
    xml_name = os.path.basename(FILE_XML_OUT) if FILE_XML_OUT else 'N/A'
    print(f"\n✅ PIPELINE COMPLETATA. EDL ({edl_name}) e XML ({xml_name}) pronti per Premiere.")
    cleanup_inputs(FILE_EDL_IN, FILE_PROXY_IN, sequence_name)


if __name__ == "__main__":
    args = parse_args()
    run_pipeline(force=args.force)
