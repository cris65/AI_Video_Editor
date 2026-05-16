# 🐺 Functional Specifications (FEATURES.md)

## Core Capabilities (Pancake AI Engine)

### 1. Taglio a Doppio Binario (Pancake Workflow)
Il sistema estrapola due timeline simultanee per massimizzare la velocità di post-produzione offline:
- **Main Track:** Dedicata al solista (`person_count == 1` su YOLO). È l'impalcatura narrativa.
- **B-Roll Track:** Dettagli e inquadrature anonime (`person_count == 0` su YOLO). Perfetta per coperture e overlay.
- Le anomalie (`person_count > 1`) causano il taglio netto (scarto) della clip in esecuzione.

### 2. Filtri Fisici e Tolleranze (Dynamic Backtrack)
- **BLUR_THRESHOLD:** Settata a `60.0` per preservare forti profondità di campo pur eliminando il micro-mosso impercettibile.
- **MOTION_THRESHOLD:** Settata a `15.0`.
- **Dynamic Backtrack:** La vera magia dell'engine. Quando YOLO rileva un "intruso", il sistema non si limita a tagliare, ma **pota gli ultimi 0.5 secondi** (`BACKTRACK_SECONDS`) del segmento valido per eliminare i margini di entrata nell'inquadratura.

### 3. Esportazione Flessibile
- **Json Maps:** `[sequence]_main_cuts.json` e `[sequence]_broll_cuts.json`.
- **Anteprime Visive:** `.mp4` creati al volo con `MoviePy` senza audio per la verifica rapida.
- **EDL Premiere-Ready:** Generazione `.edl` per importazione nativa in NLE, collegando file proxy al RAW nativo tramite commenti `* FROM CLIP NAME`.
