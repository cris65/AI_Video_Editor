# 🐺 AI Video Editor Changelog & Walkthroughs

**Version:** v0.1.44 - 2026-05-21

This file logs the cumulative release walkthroughs, detailing code changes, architecture updates, and validation states for each committed version tag.

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
