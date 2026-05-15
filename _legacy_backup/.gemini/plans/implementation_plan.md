# 🐺 Brief Architetturale - Fase 0.5: Generazione Wolf-Stack Boilerplate

Questo documento definisce il piano di setup per la costruzione dell'infrastruttura "Wolf-Stack" pura. L'obiettivo è configurare l'ambiente locale in totale isolamento (porte 5442x) e predisporre lo stack (Vite + Supabase + Dexie) senza alcuna logica di dominio.

## User Review Required
> [!IMPORTANT]
> Siccome l'attuale directory `AI_Video_Editor` contiene già file clonati da progetti precedenti (es. `package.json`, cartella `.gemini` piena), l'esecuzione di `create-vite` potrebbe andare in conflitto. 
> Confermi che posso "piallare" o forzare la sovrascrittura dell'attuale contenuto della cartella root per installare il boilerplate Vite da zero, oppure preferisci che io adatti l'attuale `package.json` installando solo i pacchetti mancanti e resettando `supabase`?

---

## 1. Inizializzazione Frontend
Comandi per generare l'infrastruttura di base (Vite + React + TypeScript) partendo da zero:

```bash
# Svuota la directory corrente (opzionale se vogliamo fare una installazione veramente pulita)
# rm -rf node_modules package-lock.json src public

# Crea il progetto Vite forzando nella cartella corrente
npx -y create-vite@latest . --template react-ts
```

## 2. Inizializzazione Dipendenze Core
Comandi per installare la "Trinity" (Dexie + Supabase) e le utility di base richieste dal Wolf-Stack:

```bash
# Installazione librerie core e di produzione
npm install dexie dexie-react-hooks @supabase/supabase-js lucide-react zustand react-router-dom i18next react-i18next i18next-browser-languagedetector

# Installazione TailwindCSS e inizializzazione configurazione
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

## 3. Setup Supabase Parallelo (Isolamento su 5442x)
Inizializzazione e configurazione dell'istanza locale di Supabase per evitare conflitti con altri progetti in esecuzione sull'host.

```bash
# Inizializza il progetto Supabase (creerà la cartella /supabase)
npx supabase init
```

### [MODIFY] `supabase/config.toml`
Modificheremo le porte di default per garantire l'isolamento sul range **5442x**:

```toml
[api]
port = 54421

[db]
port = 54422

[studio]
port = 54423

[inbucket]
port = 54424

[analytics]
backend_port = 54427
```

## 4. Configurazione Knowledge Base (I Template Vuoti)
La cartella `.gemini/` fungerà da scheletro per il boilerplate.

#### Core Immutabili (Da preservare identici):
- `GEMINI.md` (root)
- `.gemini/WOLF_PROTOCOL.md`
- `.gemini/TESTING.md`

#### Di Dominio (Da svuotare e trasformare in template):
- `.gemini/SCHEMA.md`: Conterrà solo l'intestazione `# 🐺 Database Schema & Interfaces` e l'istruzione per l'AI di popolarlo.
- `.gemini/VISION.md`: Conterrà solo l'intestazione `# 📘 VISION` e le sezioni vuote per Obiettivi e Pillars.
- `.gemini/FEATURES.md`: Conterrà solo l'intestazione `# 🐺 Functional Specifications` pronto per essere compilato.
- `.gemini/SOTA.md`: Template vuoto per lo stack tecnologico e l'architettura.

---

## 🚀 Prossimi Passi
Appena darai l'OK, procederò ad eseguire i comandi bash, scriverò i file di configurazione, e pulirò la cartella `.gemini` trasformandola nel template definitivo.
