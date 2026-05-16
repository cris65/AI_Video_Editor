# 🐺 Functional Specifications (FEATURES.md)

## Core Capabilities (Stringout AI Engine)

### 1. Taglio a Singolo Binario (Stringout Workflow)
Il sistema estrapola un'unica timeline ottimizzata per massimizzare la velocità di post-produzione offline:
- **Stringout Track:** Raccoglie tutti i frammenti utilizzabili del girato, classificandoli semanticamente (MAIN_A, B-ROLL, EDGE_DANGER).
- **Trash Reel:** Binario parallelo invisibile all'EDL finale ma renderizzato in `.mp4` (preview_TRASH) per il Quality Control visivo di ciò che l'algoritmo ha scartato.

### 2. Filtri Fisici e Saliency (Action Peak)
- **Center-Weighted Focus:** Il filtro Laplaciano calcola la cecità (blur) esclusivamente sul 50% centrale dell'inquadratura, tollerando lenti luminose e forti effetti bokeh ai lati.
- **Dual Threshold Soft Focus:** Seleziona rigorosamente i frame: `TRASH_BLUR` sotto `10.0`, mentre la "zona grigia" (10-25) viene ammessa nella timeline ma taggata con il suffisso `_SOFT` (es. `MAIN_A_SOFT`).
- **MOTION_THRESHOLD:** Scarta movimenti di camera estremi o sballottamenti (soglia `40.0`).
- **Action Peak (Best Moment):** Tracciamento in tempo reale del picco di nitidezza. L'engine memorizza la chiave temporanea `_max_lap` e certifica all'interno della metadata clip il `best_moment`, ovvero il millisecondo esatto del fotogramma perfetto per gli LLM successivi.
- **Boundary Crossing Split:** Tagli proxy che scavallano il bordo della clip originale vengono spezzati dinamicamente durante l'export EDL per prevenire errori "Media Offline" o pattern zebrati su Adobe Premiere.
- **DNA Cromatico (Cinematic Palette):** Tramite K-Means Clustering su OpenCV, l'algoritmo estrae al volo i 5 colori HEX dominanti di ogni clip. Il campionamento fonde 3 matrici (IN, OUT, e BEST) per una color-continuity perfetta senza pesare sulle performance CPU e RAM (Zero-Seeking).
- **Optical Flow (Motion Scoring):** Calcolo vettoriale `Farneback` ultraleggero a 160x90 per ogni blocco. Restituisce `intensity` e `camera_direction` (PAN, TILT, STATIC) nello `stringout.json`.
- **Semantic Storyboard:** Estrazione al volo di tre frame (IN, BEST, OUT) a risoluzione 480x270, uniti orizzontalmente in un'unica stringa JPEG per agevolare l'ingest degli LLM Vision.
- **Valigetta del Regista (Export Package):** Tutti i file processati (JSON, EDL, Storyboard, Proxy e Scarti) vengono ora convogliati e ordinati automaticamente in `engine/output/{sequence_name}`. La cartella LLM è predisposta pronta all'uso senza file intermedi orfani.

### 3. Automazione Drop-Zone Flessibile
- **Ingest Agnostico:** Supporto esteso a `.mp4`, `.mov`, `.mxf`, `.avi`, `.mkv`.
- **Auto-Cleanup:** Una volta emesso il file EDL (`_Stringout_Cut.edl`), i file originali nella drop zone vengono puliti e spostati direttamente nella cartella di output della rispettiva sequenza per evitare strascichi.
- **Esportazione Diretta:** Eliminato il gate manuale [Y/N]; il motore macina proxy, calcola scarti e genera CMX3600 in autonomia totale a 50fps.
