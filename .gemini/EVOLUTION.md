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

## 🟢 FASE 1: Core AI Engine & Pipeline Dati (IN CORSO)

La pipeline è divisa in tre sotto-fasi rigorosamente sequenziali.

**FASE A: Analisi Spaziale (Pancake Cut / YOLO)**

- [x] Generazione Stringout e Asset Proxy (estrazione frame temporalizzati).
- [x] Rilevamento della Safe Zone tramite YOLO/OpenCV.
- [x] Estrazione del `people_count` da YOLO e iniezione nel dizionario della clip.

**FASE B: Analisi Semantica (MLX Vision)**

- [x] Sviluppo `mlx_client.py` svincolato da ComfyUI.
- [x] Chiamate sincrone-sequenziali per protezione VRAM.
- [x] Salvataggio JSON atomico e incrementale (Incremental Checkpointing).
- [x] Fix puntamento path verso `LLM_Export_Package`.
- [x] Pulizia stringa `visual_quality_score` in numero intero tramite Regex.

**FASE C: Il "Regista" (Assembly & EDL Export) - PROSSIMA**

- [ ] Lettura del "Passaporto" JSON arricchito.
- [ ] Logica decisionale testuale (LLM standard) per il montaggio creativo in
      base a continuità e score.
- [ ] Esportazione CMX3600 sicura con gestione Boundary Crossing.

---

## 🟡 FASE 2: Frontend HITL (Human-In-The-Loop) & Supabase

- [x] Inizializzazione ambiente React puro (root) purificato dal vecchio template CRM.
- [x] Dashboard HITL Split-View con Video Player Sincronizzato e Timeline Interattiva.
- [x] Sincronizzazione Anti-Lag a 60fps con requestAnimationFrame e disaccoppiamento dello stato temporale.
- [x] Navigazione avanzata tramite Keyboard Shortcuts (NLE Style) e Vertical Playlist auto-scrollante.
- [x] Override e forzatura manuale dei valori da parte dell'utente (Salvataggio in JSON locale).
- [x] Drag & Drop (dnd-kit) sulla timeline orizzontale Director's Cut per il riordino manuale delle clip (NLE-style, flex-row, `horizontalListSortingStrategy`). Persistenza dell'ordine su `_hitl_data.json` via `clip_order_override`.
- [ ] Global START / END: Supporto per fissare manualmente la prima clip (Establishing) e l'ultima clip (Logo/Finale) scavalcando l'AI.
- [ ] Integrazione Supabase per il salvataggio degli stati di avanzamento delle timeline e User Export Settings (es. formati custom di default).

## 🔴 FASE 3: Il "Regista" & Orchestrazione

- [ ] Supporto ai "Pinned Anchors": Gemma 4 rispetta il riordino manuale (Forced Order) e i Global START/END provenienti dall'HITL.
- [ ] Rilevamento di anomalie video avanzate (micro-mosso, drop frame).
- [ ] Esportazione XML multi-track per NLE alternativi (Premiere Pro / DaVinci / FCPX).
- [ ] Packaging e automazione esecuzione batch in background.

## 🟣 FASE 4: Integrazione Nativa & Distribuzione (Endgame)

- [ ] Refactoring del Frontend React in Adobe CEP Extension (Manifest XML, ExtendScript).
- [ ] Automazione I/O: Sincronizzazione automatica della timeline attiva tramite script JSX.
- [ ] Packaging MLX: Creazione di un installer "One-Click" (macOS .pkg o PyInstaller) per rendere il server MLX locale invisibile e friction-less per l'utente finale non tecnico.
