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
- **Semantic Storyboard & Smart Naming:** Estrazione al volo di tre frame (IN, BEST, OUT) a 480x270, uniti orizzontalmente. I frame estratti non sono più anonimi, ma intercettano dalla mappa EDL il VERO nome nativo (`C4369`) e il Timecode sicuro calcolato dal motore, generando `{clip_name}_{tc_safe}.jpg`.

### 3. FASE B - Vision LLM Inference (MLX Server)
L'Engine non è più "cieco". Integrando l'ecosistema MLX locale via standard OpenAI-compatible (`http://127.0.0.1:8080/v1/chat/completions`), il sistema analizza la timeline di Stringout:
- Convertendo al volo lo Semantic Storyboard in `base64`.
- Iniettando il Context Prompt specifico sulla Continuità Cronologica.
- Salvando il risultato validato nel dict JSON tramite una logica tollerante e autonoma (retry x3, regex cleaning e salvataggio JSON progressivo).
- Bypass morfologico (Skip Morbido) per l'ingest automatico se il server non è avviato.

### 4. Automazione Drop-Zone Flessibile
- **Ingest Agnostico:** Supporto esteso a `.mp4`, `.mov`, `.mxf`, `.avi`, `.mkv`.
- **Auto-Cleanup:** Una volta emesso il file EDL (`_Stringout_Cut.edl`), i file originali nella drop zone vengono puliti e spostati direttamente nella cartella di output della rispettiva sequenza per evitare strascichi.
- **Esportazione Diretta:** Eliminato il gate manuale [Y/N]; il motore macina proxy, calcola scarti e genera CMX3600 in autonomia totale a 50fps.

## Frontend (React HITL Dashboard)

### 1. NLE-Style Split-View
- **Interactive Timeline**: Barra temporale sincronizzata al millisecondo, renderizza cromaticamente i segmenti validi (Verde MAIN, Blu B-ROLL) e scartati (Rosso).
- **Vertical Playlist Auto-Scrollante**: L'ispettore laterale scorre autonomamente e tiene sempre a fuoco la clip attiva nel video, garantendo una UX immersiva.
- **Keyboard Shortcuts Professionali**: Integrazione standard per il montaggio. Spazio per Play/Pausa, frecce orizzontali per lo scrubbing, frecce verticali per "saltare" istantaneamente ai tagli successivi/precedenti calcolati dall'Engine.
- **Anti-Lag Engine (60fps)**: Data-binding del tempo completamente sganciato dal React State e demandato a un `requestAnimationFrame` diretto sul DOM. I re-render React sono bloccati tramite `React.memo` tranne quando il video sorpassa un effettivo "taglio" dell'EDL virtuale.
