# 🐺 AI Video Editor Changelog & Walkthroughs

**Version:** v0.1.52 - 2026-05-22

This file logs the cumulative release walkthroughs, detailing code changes, architecture updates, and validation states for each committed version tag.

---

## 🐺 Walkthrough — v0.1.51 → v0.1.52

### Sommario

Release dedicata all'implementazione del **Director History Archive** — un sistema di persistenza immutabile per ogni inferenza eseguita dal Director (Fase D). Ogni run produce ora una snapshot cronologica arricchita con metadati completi, abilitando benchmarking e analisi comparativa tra sessioni. Risolto anche un errore di tipo IDE (`Expected a callable, got None`) nel sampler MLX.

### File Modificati

| File | +Ins | -Del | Descrizione |
|---|---|---|---|
| `engine/director.py` | +83 | -8 | History Archive System completo |
| `.gemini/SOTA.md` | +3 | -1 | Documentazione History Archive |

---

### 1. Director History Archive — `_save_history_archive()`

**File:** `engine/director.py`

**Prima:** Ad ogni Regenerate Cut, `_final_edit.json` veniva sovrascritto. Nessuna traccia storica delle sessioni precedenti. Impossibile confrontare l'output di Gemma 4 E4B vs 31B sullo stesso materiale.

**Dopo:** Nuova funzione privata `_save_history_archive()` invocata subito dopo il salvataggio del file di lavoro corrente. Salva in `engine/output/{sequence_name}/history/` (isolato per progetto) un file immutabile con naming cronologico:

```
20260522_175513_Gemma4_31B_ORGANIC_recipe.json
```

**Struttura `_metadata` iniettata:**
```json
{
  "_metadata": {
    "timestamp": "2026-05-22T17:55:13.421836",
    "sequence_name": "RAW_BASE_SEQ_AMICI_DONDOLO_SHORT",
    "brain_model": "mlx-community/gemma-4-31b-it-4bit",
    "inference_time_seconds": 4.72,
    "user_directives": {
      "target_duration": 30,
      "rhythmic_strictness": 65,
      "energy_threshold": 0.4,
      "audio_marker_priority": "DYNAMIC_PRIORITY",
      "duration_mode": "ORGANIC",
      "style_prompt": "..."
    },
    "director_vision": "A slow-burn emotional descent...",
    "clip_count": 4
  }
}
```

**Fallback euristico coperto:** Se l'LLM non risponde, il campo `director_vision` diventa `"HEURISTIC_FALLBACK"` e `inference_time_seconds` è `null`.

---

### 2. Inference Timing — `time.perf_counter()`

**File:** `engine/director.py`

`_t_start / _t_end` avvolge la chiamata `generate()`. Il delta arrotondato a 2 decimali viene iniettato nel `recipe_dict` prima del return e poi estratto dal `_metadata` dell'archivio. Il log ora mostra:

```
✅ LLM ha risposto con successo (Visione: ...) [4.72s]
```

---

### 3. Fix Type Error — `_make_sampler` always callable

**File:** `engine/director.py`

**Prima:** Nel ramo `except ImportError`, `_make_sampler = None`. Il type checker segnalava `Expected a callable, got None` alla riga della chiamata `generate()`.

**Dopo:** Il ramo `except ImportError` definisce `_make_sampler` come funzione che solleva `RuntimeError` esplicito. È dead code (gated da `check_director_llm_available()`), ma ora il type checker vede sempre un callable.

---

### `.gitignore`

`engine/output/` era già completamente ignorato — nessuna modifica necessaria. Le cartelle `history/` sono automaticamente escluse dal tracking git.

---

### Validazione

- **ESLint:** ✅ 0 errori, 0 warning
- **TSC:** ✅ 0 errori
- **IDE Linter:** ✅ `Expected a callable, got None` risolto

---

## 🐺 Walkthrough — v0.1.50 → v0.1.51

### Sommario

Release focalizzata sulla stabilizzazione dell'intero pipeline di orchestrazione AI Director (Fase D). Risolti 4 bug critici che bloccavano l'endpoint `/api/orchestrate` con errori 422, un crash dell'inferenza MLX per API deprecata, e un errato routing del modello LLM. Il pipeline è ora completamente funzionante end-to-end con Gemma 4 31B in locale.

### File Modificati

| File | +Ins | -Del | Descrizione |
|---|---|---|---|
| `engine/api_server.py` | +13 | -4 | Allineamento schema Pydantic completo |
| `engine/director.py` | +22 | -3 | AI_MODEL_MAP + mlx_lm API fix |
| `src/components/dashboard/AdvancedDirectorModal.tsx` | +13 | -23 | Rimozione Analysis Rate (Fase 1) |
| `src/components/dashboard/DirectorSettingsPanel.tsx` | +4 | -2 | Label modello Llama 3.3 |
| `src/components/dashboard/PancakeDashboard.tsx` | +1 | -1 | Fix diagnostica temporanea rimossa |
| `src/hooks/usePancakeData.ts` | +1 | -1 | Tipo `ai_model` aggiornato con Llama |

---

### 1. Rimozione `Analysis Rate (FPS)` — Separazione Fase 1 / Fase 2

**File:** `AdvancedDirectorModal.tsx`

**Prima:** Il campo `Analysis Rate (FPS)` era presente nel tab "Engine & System" del pannello Director (Fase 2), ma quel parametro controlla il campionamento frame della Fase 1 (`PhaseAPayload`) e non ha rilevanza per l'LLM di orchestrazione.

**Dopo:** Campo fisicamente rimosso. La griglia `grid-cols-2` del blocco "Sequence Format" è stata convertita in `w-full` per mantenere il layout bilanciato con solo il campo "Target Resolution".

---

### 2. Fix 422 — `UserConstraint` mancante di `'AUDIO'`

**File:** `engine/api_server.py`

**Root cause:** Il frontend inviava marker di tipo `"AUDIO"` (shortcut `A`) ma la classe Pydantic `UserConstraint` accettava solo `Literal['IN', 'OUT', 'BM']`. FastAPI rifiutava la request con ValidationError 422.

**Fix:** Aggiunto `'AUDIO'` al Literal type della classe `UserConstraint`.

---

### 3. Fix 422 — `LockedClipOverride` incompatibile con Bookend System

**File:** `engine/api_server.py`

**Root cause:** Il Bookend System (introdotto in v0.1.48) aveva aggiornato la struttura TypeScript `clipOverrides` nel frontend con campi come `force_status`, `is_global_start`, `is_global_end`, ma il modello Pydantic `LockedClipOverride` era rimasto congelato alla vecchia struttura (`action`, `locked`). La `Union[LockedClipOverride, Literal['KEEP','TRASH','BROLL']]` falliva per entrambi i tipi.

**Fix:** `LockedClipOverride` aggiornato con tutti i campi del Bookend System come `Optional`.

---

### 4. Fix 422 — Campi mancanti in `DirectorConfigPayload`

**File:** `engine/api_server.py`

**Root cause:** `duration_mode`, `rhythmic_strictness`, `energy_threshold`, `audio_marker_priority` erano presenti nell'interfaccia TypeScript `DirectorConfig` ma assenti nel modello Pydantic del backend.

**Fix:** Aggiunti tutti e 4 i campi come `Optional` con i default corretti.

---

### 5. Fix mlx_lm API — `generate_step() got unexpected keyword argument 'temperature'`

**File:** `engine/director.py`

**Root cause:** La versione di `mlx_lm` installata nel venv ha deprecato `temperature` come argomento diretto di `generate()`. Il parametro si passa ora tramite un oggetto `sampler` callable.

**Fix:** Importazione condizionale di `make_sampler` da `mlx_lm.sample_utils`. Fallback con lambda nativa `mlx.core.random.categorical`. La chiamata `generate()` usa ora `sampler=_make_sampler(temp=0.3)`.

---

### 6. AI Model Routing — `AI_MODEL_MAP` in `director.py`

**File:** `engine/director.py`

**Prima:** Il `llm_model_id` veniva letto esclusivamente dai metadati del `stringout.json`, ignorando completamente la scelta del modello nell'UI Director. La mappa era assente.

**Dopo:** Introdotto `AI_MODEL_MAP` che mappes le chiavi UI ai percorsi MLX locali reali. La scelta dell'utente nell'`AdvancedDirectorModal` ha **priorità assoluta** sui metadati. Fallback sui metadati stringout se la chiave non è riconosciuta.

```python
AI_MODEL_MAP = {
    'gemma-4-4b':    'mlx-community/gemma-4-e4b-it-4bit',
    'gemma-4-31b':   'mlx-community/gemma-4-31b-it-4bit',
    'llama-3.3-70b': 'mlx-community/Llama-3.3-70B-Instruct-4bit',
}
```

---

### Validazione

- **ESLint:** ✅ 0 errori, 0 warning
- **TSC:** ✅ 0 errori
- **API `/api/orchestrate`:** ✅ 200 OK (era 422)
- **LLM Inference Gemma 4 31B:** ✅ `"A slow-burn emotional descent from tranquil beauty to pensive melancholy..."`

---


## 🐺 Walkthrough — v0.1.49 → v0.1.50

**Commit:** `[v0.1.50] feat(ui): implement native Audio Beats visualization in Advanced Director Modal`

### Riepilogo File Modificati

| File | +ins | -del | Cosa |
| ---- | ---- | ---- | ---- |
| `src/components/dashboard/AdvancedDirectorModal.tsx` | +150 | -50 | Visualizzatori avanzati SVG (Energy Threshold e Rhythmic Strictness) agganciati ai dati audio reali. |
| `src/components/dashboard/DirectorSettingsPanel.tsx` | +10 | -15 | Cleanup variabili non usate, binding dati audioBeats verso il modal. |
| `src/components/dashboard/PancakeDashboard.tsx` | +5 | -2 | Passaggio `audioBeats` verso i settings panel. |
| `engine/director.py` | +3 | -1 | Fix tipizzazione Python su load di `mlx_lm`. |
| `package.json` | +1 | -1 | Bump a v0.1.50 |
| `.gemini/SOTA.md` | +2 | -2 | Aggiornamento documentazione KB per UI Modale. |

### Dettagli Release (Visualizzazione Nativa Audio Beats)
- **Advanced UI Data Binding:** Il pannello avanzato delle impostazioni del Director (`AdvancedDirectorModal`) ora riceve l'array nativo `audioBeats` generato da Librosa.
- **Rhythmic Strictness Visualizer:** Riprogettato completamente il visualizzatore SVG. Introdotta un'onda sonora organica in background basata su Curve di Bezier Cubiche (`vectorEffect="non-scaling-stroke"`) per una risoluzione cristallina indipendentemente dalle proporzioni del contenitore.
- **Energy Threshold Visualizer:** Il visualizzatore di soglia d'energia ora non utilizza più dati fittizi, ma mappa dinamicamente il 100% dei veri battiti audio (BPM/Energy) per la clip corrente. Spostando lo slider della soglia (Cutoff Filter), l'interfaccia evidenzia in tempo reale i picchi che supereranno il filtro per l'LLM. 
- **Code Quality:** Risolti tutti i warning ESLint (rimossi handler/state non usati da `DirectorSettingsPanel`) e un errore di unpack TypeError Python in `director.py`.

### Validazione
- **TypeScript & ESLint:** Validato localmente con `0` errori (0 unused variables, no any).
- **Python:** Risolto TypeError sull'unpack di `mlx_lm.load` (tuple size mismatch evitato).

---

## 🐺 Walkthrough — v0.1.48 → v0.1.49

### 1. UX/UI Restorations
- **Engine Control Recovery:** Restored the "Engine Control" button to the `PancakeDashboard` Master Toggle header, which had been accidentally dropped in prior refactorings.
- **Routing Hookup:** Plumbed `onOpenEngine` prop down from `App.tsx` through `PancakeDashboardProps` so that clicking the Engine Control button cleanly triggers a top-level state change back to the `ImageEngineControls` (`setup`) view.
- **Iconography:** Assigned the `Cpu` icon from Lucide-React to cleanly identify the Engine.

### 2. Python Engine Pipeline Adjustments
- **Director Config Serialization:** Added robust boolean parsing in `director.py` (for `fast_cut`, `social_media`, `rhythmic`) to correctly convert `"true"` string payloads arriving from the Frontend JSON into true Python Booleans before passing them down the MLX Pipeline.

### Validation
- **TypeScript:** Validated via Husky / Pre-commit.
- **ESLint:** Clean.
- **State Navigation:** Confirmed seamless visual handoff back and forth between Editor and Setup views.

---

## 🐺 Walkthrough — v0.1.47 → v0.1.48

### 1. UX/UI Keyboard Shortcuts Overhaul
- **P/L Mouse Modifiers:** Implemented tracking for P and L keys as modifiers for timeline dragging. `P + Drag` pans the view while keeping the playhead static. `P + L + Drag` scrubs the playhead.
- **Categorized Keyboard Modal:** Restructured the Keyboard Shortcuts modal in both `InteractiveTimeline` and `FinalCutTimeline` into a 2-column layout organized by "Area of Intervention" (Global Navigation, Timeline Interaction, Markers & Status).

### 2. Selective Marker Deletion
- **Shift + Marker Keys:** Added functionality to delete only specific categories of markers from the hovered clip using `Shift + I` (IN), `Shift + O` (OUT), `Shift + M` (Bookmarks), and `Shift + A` (Audio).
- **Macro Rerouting:** Updated `useVideoShortcuts.ts` to emit specific `CLEAR_TYPE_[CATEGORY]` constraints when Shift is held.
- **Dashboard Handler:** Upgraded `PancakeDashboard.tsx` to intercept `CLEAR_TYPE_*` constraints and filter out only the target marker type locally.

### 3. Bookend Macro Conflict Resolution
- **Rebinding:** Moved the "Sequence IN/OUT (Bookend)" macros in `FinalCutTimeline` from `Shift + I / O` to `Alt + I / O` to prevent conflicts with the new selective deletion logic.

### 4. Architectural Rules
- **DRY Axiom:** Added `LAW 11 — THE DRY PRINCIPLE AXIOM` to `GEMINI.md` to permanently forbid the duplication of core UI components and sync handlers, setting the stage for the upcoming Universal Timeline Refactoring.

### Validation
- **TypeScript:** Validated via Husky / Pre-commit.
- **ESLint:** Clean.

---

## 🐺 Walkthrough — v0.1.46 → v0.1.47

**Commit:** `[v0.1.47] feat(ui): implement dual waveform rendering and rhythmic energy toggle`

### Riepilogo File Modificati

| File | +ins | -del | Cosa |
| ---- | ---- | ---- | ---- |
| `engine/audio_analyzer.py` | +153 | -50 | Estrazione duale: Amplitude (`np.abs(y)`) ed Energy (`onset_env_b`). |
| `src/components/dashboard/InteractiveTimeline.tsx` | +255 | -20 | UI per "Waveform Control" e switch tra viste. Risolto glitch su SVG overflow. |
| `src/hooks/usePancakeData.ts` | +72 | -15 | Supporto per JSON nested `waveforms: { amplitude, energy }` con fallback. |

### Dettagli Release (Dual Waveform Rendering)
- **Audio Extraction Backend:** Modificato il parser di `librosa` per generare due set di dati a 80 punti al secondo. Il primo è l'Amplitude (volume puro e tradizionale, utile per il sync del parlato), il secondo è l'Energy (basato su `onset_strength`, che traccia i picchi ritmici e la tensione emotiva per guidare il VLM).
- **Frontend State Management:** Introdotto `waveformView` in `PancakeDashboard`, propagato verso il basso su `InteractiveTimeline` e `FinalCutTimeline`.
- **UI / Popover:** Aggiunto un interruttore galleggiante **Waveform Control** che permette all'utente di alternare istantaneamente il rendering della curva SVG verde tra Amplitude ed Energy. Entrambi i set di punti sono calcolati localmente al volo.
- **Validazione:** ✅ Typescript e ESLint corretti e funzionanti.

---

**Commit:** `[v0.1.46] feat(engine): inject audio rhythm metadata into LLM director prompt`

### Riepilogo File Modificati

| File | +ins | -del | Cosa |
| ---- | ---- | ---- | ---- |
| `engine/director.py` | +14 | -4 | Iniezione del `[RHYTHM CONTEXT]` e `audio_directive` nel payload inviato a Llama 3 / Gemma 4. |

### Dettagli Release (Audio Rhythm Engine - Phase 3)
- **Engine / AI Injection:** Implementato il logic bridge finale che rende il LLM consapevole del ritmo audio. `generate_final_cut` scarica l'array dei beats (generato precedentemente da Librosa e salvato in `_audio_beats.json`) e lo inietta come parametro matematico opzionale in `call_director_llm`.
- **Context Engineering:** Se rileva una traccia musicale, il Director System Prompt include la direttiva rigida di allinearsi alla griglia temporale (*"strictly align clip boundaries..."*). L'array esatto dei timestamp viene aggiunto all'inizio della lista delle clip.
- **Lazy Fallback:** Totale sicurezza architetturale. Se non ci sono beat, il dizionario non viene caricato e il Director esegue un montaggio puro e narrativo 100% visivo.
- **Validazione:** ✅ Nessun errore sintattico in Python (`python -m py_compile`).

---

## 🐺 Walkthrough — v0.1.44 → v0.1.45

**Commit:** `[v0.1.45] feat(ui): integrate Audio Rhythm Engine modal and UX layout`

### Riepilogo File Modificati

| File | +ins | -del | Cosa |
| ---- | ---- | ---- | ---- |
| `src/components/dashboard/AudioSettingsModal.tsx` | ~150 | 0 | Creazione nuovo componente modale React per interazione audio. |
| `src/components/dashboard/PancakeDashboard.tsx` | +25 | -5 | Integrazione AudioSettingsModal, nuovo bottone e riordino cronologico. |
| `src/components/dashboard/InteractiveTimeline.tsx` | +1 | -1 | Fix di linting: rimossa dipendenza `Info` non utilizzata. |

### Dettagli Release (Audio Rhythm Engine - Phase 2 & UX)
- **UI/UX:** Aggiunta modale "Dark/Overlay" per selezionare le tracce ed estrarre la griglia BPM (Librosa).
- **Workflow Layout:** Pulsante "Audio Track" riposizionato nell'Header tra "Stringout" e "Director's Cut" per riflettere il flow cronologico nativo.
- **Code Quality:** Risolto warning unused import in `InteractiveTimeline.tsx`. Assoluta zero `any` policy rispettata.
- **Validazione:** ✅ Tipo e linter perfetti nativamente.

---

## 🐺 Walkthrough — v0.1.43 → v0.1.44

**Commit:** `[v0.1.44] feat(audio): implement Audio Rhythm Engine API for Librosa`

### Riepilogo File Modificati

| File | +ins | -del | Cosa |
|---|---|---|---|
| `engine/api_server.py` | +29 | -0 | Aggiunti endpoint `/api/audio/files` e `/api/audio/analyze` |
| `engine/audio_analyzer.py` | +79 | -0 | Aggiunta funzione `analyze_audio_for_api` con estrazione BPM e transienti |
| `package.json` | +1 | -1 | Bump versione a v0.1.44 |
| `.gemini/SOTA.md` | +2 | -2 | Aggiunta documentazione endpoint Audio API |
| `.gemini/FEATURES.md` | +2 | -1 | Documentata nuova feature Audio Rhythm Engine |
| `.gemini/EVOLUTION.md` | +2 | -1 | Marcata Fase A2 Audio API come completata |
| `.gemini/CHANGELOG.md` | +29 | -0 | Inserito walkthrough corrente |

---

### Dettaglio Modifiche

#### 1. Audio Rhythm Engine Backend
È stata sviluppata l'interfaccia backend per l'Audio Rhythm Engine in modo non distruttivo. Il modulo `audio_analyzer.py` è stato esteso con la funzione `analyze_audio_for_api`, che estrae:
- BPM (tempo) della traccia.
- Durata totale in secondi.
- Array di beats con il rispettivo timestamp (`time`) e intensità del transiente (`energy`), normalizzata da 0.0 a 1.0 usando l'inviluppo `onset_strength`.

#### 2. Nuovi Endpoint FastAPI (`api_server.py`)
- `GET /api/audio/files`: Effettua una scansione della directory `engine/input/` e restituisce i file compatibili (`.mp3` e `.wav`), pronti per essere visualizzati nella UI.
- `POST /api/audio/analyze`: Endpoint strutturato (tramite Pydantic) per innescare l'analisi Librosa su un file specifico, con salvataggio automatico dell'output JSON nel formato atteso dal LLM Director (`_audio_beats.json`).

---

### Validazione
* ✅ `py_compile` — Nessun errore sintattico in Python (Sostitutivo a `wolf:audit` per via dei blocchi OpenSSL su sandbox).
* ✅ `.gemini` Knowledge Base aggiornata autonomamente per riflettere lo stack attuale.

---

## 🐺 Walkthrough — v0.1.42 → v0.1.43

**Commit:** `[v0.1.43] feat(docs): integrate release walkthroughs into repository changelog`

### Riepilogo File Modificati

| File | +ins | -del | Cosa |
|---|---|---|---|
| `.gemini/CHANGELOG.md` | +150 | — | Nuovo file changelog della Knowledge Base |
| `GEMINI.md` | +2 | — | Aggiunto CHANGELOG.md a KB routing e release sub-routine |
| `.agents/workflows/wolf_flow.md` | +9 | -3 | Aggiornato workflow per richiedere CHANGELOG.md |
| `package.json` | +1 | -1 | Bump versione a v0.1.43 |

---

### Dettaglio Modifiche

#### 1. Integrazione di `CHANGELOG.md` nel Repository
Per eliminare la barriera tra il walkthrough locale dell'IDE (invisibile a modelli esterni come Gemini Web) e il repository, abbiamo introdotto il file `.gemini/CHANGELOG.md`. 
D'ora in poi, ogni rilascio documenterà il proprio walkthrough direttamente all'interno del repository, consentendo a Gemini di caricare la cronologia dettagliata delle modifiche al `/launch`.

#### 2. Adeguamento Workflow `wolf_flow.md`
* Lo step 5 del workflow `/wolf_flow` è stato modificato in modo da richiedere esplicitamente di appendere il walkthrough in cima a `.gemini/CHANGELOG.md`.
* Poiché `wolf_flow` copia già tutto il contenuto di `.gemini/*.md` nella directory `WOLF_EXPORTS`, il changelog aggiornato farà sempre parte degli export.

---

### Validazione
* ✅ `eslint .` — 0 errori (12 warning pre-esistenti react-hooks, invariati)
* ✅ `tsc --noEmit` — 0 errori

---

## 🐺 Walkthrough — v0.1.41 → v0.1.42

**Commit:** `eec10058` — `[v0.1.42] feat(ui): Premiere marker palette, ClipCard 4-area layout, complete legend & shortcuts`

### Riepilogo File Modificati

| File | +ins | -del | Cosa |
|---|---|---|---|
| `ClipCard.tsx` | +230 | -large | Layout 4 aree + palette colori + fix conteggio |
| `InteractiveTimeline.tsx` | +65 | -some | Palette colori + legenda completa + shortcuts |
| `PancakeDashboard.tsx` | +133 | -some | Bookend system + filteredTimeline in useMemo |
| `useVideoShortcuts.ts` | +1 | — | Fix Space bar repeat |
| `engine/director.py` | +90 | -some | Refactoring AI Director (sessione precedente) |
| `.agents/workflows/brainstorming.md` | +20 | — | Nuovo workflow `/brainstorming` |
| `scratch/old_pancake.tsx` | — | -881 | File temporaneo eliminato (LAW 5) |
| `SOTA.md` | +6 | -2 | KB aggiornata |

---

### Dettaglio Modifiche UI

#### 1. `ClipCard.tsx` — Layout 4 Aree

La card è stata riorganizzata in 4 aree semantiche distinte:

```
┌──────────────────────────────────────┐
│ AREA A: C4366 │ MAIN_A │ 👤 1       │  ← top bar thumbnail (3 colonne allineate)
│                                      │
│             [ IN ]                   │  ← AREA B: bookend centered (invariato)
│                                      │
│ 🔥 4 MARKERS SET    0.0s–22.6s 22.6s│  ← AREA C: badge (sx) + timer (dx) in bottom bar
└──────────────────────────────────────┘
  ● ● ● ●                              ← AREA D: pallini analisi cromatica
  Score MLX  9  /10  ════════
  [lista marker rows]
```

**Prima:** `MAIN_A` era sotto il nome clip (2 righe sx). Badge marker era sovrapposto al thumbnail centro-alto. Pallini erano nel bottom-bar del thumbnail sovrapposti.

**Dopo:** Tutto in 3 colonne allineate nella top bar. Badge nel bottom-bar con il timer. Pallini nella prima riga del content.

---

#### 2. `ClipCard.tsx` — Disambiguazione Bookend

Nel marker list, Col1 delle righe bookend ora mostra il simbolo grafico invece del tipo testuale:

```diff
- {isIN ? 'IN' : 'OUT'}   ← confuso con user markers
+ {isIN ? '['  : ']' }    ← visivamente distinto
```

**Risultato:**
```
[    [ IN    [00:10.04]   ← bookend (blue)
IN   IN1     [00:14.06]   ← user marker (green)
OUT  OUT2    [00:15.44]   ← user marker (red)
```

---

#### 3. `ClipCard.tsx` + `InteractiveTimeline.tsx` — Palette Premiere Pro

Tutti i marker ora usano la palette cromatica di Adobe Premiere Pro:

| Tipo | Colore | Hex |
|---|---|---|
| 🟢 IN marker | Verde Premiere | `#4CAF50` |
| 🔴 OUT marker | Rosso Premiere | `#E53935` |
| 🟠 BM (user + native) | Arancio Premiere | `#FF6D00` |
| 🟡 AUDIO | Gold Premiere | `#FFC107` |
| 🔵 Bookend IN | Blu | `#3B82F6` (invariato) |
| 🟣 Bookend OUT | Viola | `#A855F7` (invariato) |

Applicata uniformemente su: `BORDER_COLOR` (ClipCard list), `MARKER_COLORS` (timeline ruler pills), native BM badge, legenda footer, keyboard shortcuts.

---

#### 4. `InteractiveTimeline.tsx` — Legenda Footer Completa

**Prima (6 item):**
`● Valid | ● B-ROLL | ● Trash | ● Marker IN | ● Marker OUT | ● Bookend [IN | ● Bookend OUT]`

**Dopo (8 item):**
`● Valid | ● B-ROLL | ● Trash | ● Marker IN | ● Marker OUT | ● Marker BM | ● Marker Audio | ● Bookend [IN | ● Bookend OUT]`

---

#### 5. `InteractiveTimeline.tsx` — Keyboard Shortcuts Color-Coded

**Prima:** tutte le voci marker in bianco neutro + Audio in vecchio verde.

**Dopo:** ogni voce con il proprio colore Premiere, IN/OUT su righe separate:

| Shortcut | Label | Colore |
|---|---|---|
| `I` | Marker IN | 🟢 `#4CAF50` |
| `O` | Marker OUT | 🔴 `#E53935` |
| `M` | Marker BM (M#) | 🟠 `#FF6D00` |
| `A` | Marker Audio (♪) | 🟡 `#FFC107` ← fix da vecchio verde |

---

#### 6. `PancakeDashboard.tsx` — Bookend System

`clipOverrides` esteso da `Record<string, 'KEEP'|'TRASH'|'BROLL'>` a oggetto strutturato:

```typescript
{
  force_status?: 'KEEP' | 'TRASH' | 'BROLL',
  is_global_start?: boolean,
  is_global_end?: boolean,
  bookend_start_time?: number,   // timestamp esatto playhead
  bookend_end_time?: number,
}
```

Il marker Bookend si posiziona al **timestamp esatto della playhead** al momento del click, non al bordo della clip. `filteredTimeline` refactored in `useMemo` con ordinamento cronologico.

---

#### 7. `useVideoShortcuts.ts` — Fix Space Repeat

```diff
+ if (e.repeat) break;
```
Previene il play/pause multiplo su pressione prolungata della barra spaziatrice.

---

#### 8. `.agents/workflows/brainstorming.md` — Nuovo Workflow

Aggiunto workflow `/brainstorming` che blocca l'agente in modalità dialogo-puro: zero modifiche ai file fino a `/execute` esplicito del Tech Lead.

---

### Validazione

- ✅ `tsc --noEmit` — 0 errori
- ✅ `eslint .` — 0 errori (12 warning pre-esistenti react-hooks, invariati)
- ✅ Husky pre-commit — superato
- ✅ `scratch/old_pancake.tsx` eliminato (LAW 5 compliance)
