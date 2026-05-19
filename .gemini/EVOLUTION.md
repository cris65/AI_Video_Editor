# 🚀 EVOLUTION (Roadmap & Fasi)

> [!NOTE]
> Questo documento traccia la direzione del prodotto e la fase corrente di
> sviluppo per l'AI Video Editor. Mantiene lo stato di avanzamento rigorosamente
> allineato all'architettura Offline-First (Python/MLX/YOLO) e all'interfaccia
> HITL (React).

## 🎯 Obiettivo Globale

Creare un ecosistema di montaggio video Local-First e automatizzato, che abbatte
i tempi di pre-selezione tramite inferenza AI (YOLO + MLX Vision) pur mantenendo
totale agnosticità (EDL CMX3600) verso Adobe Premiere Pro.

---

## 🟢 FASE 1: Core AI Engine & Ingest Pipeline (COMPLETATA)

La pipeline "pesante" (Velocità 1) che gira una sola volta per mappare il video.

**FASE A: Analisi Spaziale & Tecnica (Pancake Cut / OpenCV + YOLO)**
- [x] Generazione Stringout e Asset Proxy (estrazione frame temporalizzati).
- [x] Slicing deterministico basato su FPS originali e target `analysis_fps`.
- [x] Rilevamento della Safe Zone dinamica tramite YOLO.
- [x] Estrazione nitidezza (Laplaciano) e Motion Flow.
- [x] Generazione payload nidificato: `technical_quality`, `spatial_configuration`, `yolo_omniscient_data`.

**FASE A2: Analisi Audio (BGM & Transienti)**
- [x] Implementazione script Python (`bgm_generator.py`) per generare tracce.
- [x] Iniezione dei timecode dei beat e della waveform nel JSON base per consentire il futuro "Cut on Beat".

**FASE B: Analisi Semantica (MLX Vision + Gemma 4)**
- [x] Sviluppo `mlx_client.py` con prompt strutturato (Rule of Six).
- [x] Chiamate sincrone-sequenziali per protezione VRAM.
- [x] Iniezione incrementale nel JSON dei macro-oggetti: `cinematography`, `continuity`, `commercial`, `story`.
- [x] Salvataggio JSON atomico (`_stringout.json`).

---

## 🟡 FASE 2: Frontend HITL & Orchestrazione (COMPLETATA)

**FASE C: L'Interfaccia Umana (React UI)**
- [x] Dashboard HITL Split-View con Video Player Sincronizzato e Timeline Interattiva.
- [x] Sincronizzazione Anti-Lag a 60fps con disaccoppiamento dello stato temporale.
- [x] Override manuali (KEEP/TRASH/BROLL, IN/OUT/BM) persistiti in `_hitl_data.json`.
- [x] Settings Panel avanzato: Safe Zone margins, Target Duration, Expected Subjects.
- [x] Drag & Drop (dnd-kit) sulla timeline orizzontale Director's Cut.

**FASE D: Il Cablaggio e Il "Regista" (API Gateway)**
- [x] Endpoint FastAPI `POST /api/orchestrate`.
- [x] Payload ibrido validato tramite `Pydantic` strict typing.
- [x] Propagazione del `Seed` per determinismo stocastico.
- [x] Esecuzione isolata (Velocità 2) che rigenera solo il testo e i JSON senza ricalcolare il video, restituendo il `_final_edit.json`.

---

## 🔴 FASE 3: Esportazione & Integrazione Nativa (Endgame) - PROSSIMA

- [ ] Supporto ai "Pinned Anchors": Gemma 4 rispetta il riordino manuale (Forced Order) e i Global START/END provenienti dall'HITL.
- [ ] Rilevamento di anomalie video avanzate (micro-mosso, drop frame).
- [ ] Esportazione XML multi-track per NLE (Premiere Pro / DaVinci / FCPX) (Fase E).
- [ ] Refactoring del Frontend React in Adobe CEP Extension (Manifest XML, ExtendScript) per sincronizzazione automatica della timeline attiva.
- [ ] Installer "One-Click" (macOS .pkg o PyInstaller) per rendere il server MLX invisibile e friction-less.
- [ ] Motore Audio-Generativo Locale (MusicGen / Stable Audio) offline.

---

## 🌌 EPIC: Versioning, Cloud Persistence & Semantic Memory

**Problema Attuale:** Il sistema sovrascrive il file `_final_edit.json` ad ogni rigenerazione. Sebbene il Seed garantisca la riproducibilità a parità di prompt, la modifica del prompt (es. l'aggiunta di una nuova direttiva) altera il contesto del LLM, rendendo impossibile tornare a un montaggio precedente se non ci si ricorda l'esatto stato della UI.
**Obiettivo:** Trasformare il workflow in un processo non distruttivo, con salvataggio in cloud e memoria semantica dell'IA.

### Milestone 1: Local Versioning (File System)
- **Logica Backend:** Logica di auto-incremento che generi `_final_edit_v1.json`, `_final_edit_v2.json`, associando a ciascun file un log del Seed e del DirectorConfig.
- **Logica Frontend:** Menu a tendina "History" per re-idratare istantaneamente lo stato della UI (Seed, Vincoli, Prompt).

### Milestone 2: The Supabase Awakening (Cloud Persistence)
- **Data Modeling:** Creazione tabelle in Postgres: `users`, `projects`, `media_assets`, ed `edit_versions`.
- **JSONB Storage:** I payload complessi e le "Recipe" verranno salvati in colonne JSONB.
- **Sync:** Il frontend salverà lo stato ibrido su Supabase, e FastAPI leggerà i vincoli dal DB.

### Milestone 3: Vectorized RAG (The Omniscient Director)
- **pgvector Integration:** Abilitare l'estensione `pgvector` su Supabase.
- **Embedding Pipeline:** I prompt testuali, i flaw aggirati e le motivazioni della "Recipe" convertiti in vettori.
- **Semantic Search:** Search bar conversazionale per il recupero storico.

### Milestone 4: Production Readiness (i18n & Refactoring)
- **Localizzazione:** Integrazione di `react-i18next` per rendere la UI multi-lingua senza introdurre regressioni.
- **Pulizia UI:** Componentizzazione spinta e decoupling della logica dallo strato di presentazione.
