# Brief Architetturale - Fix Infrastruttura e Preparazione QA

Questo documento delinea i passaggi necessari per allineare il `package.json` alla nuova architettura Monorepo (Wolf-Stack Boilerplate) eliminando i vecchi path relativi a `frontend/` e `backend/`. Inoltre, fornisce i passaggi di validazione QA per il Tech Lead.

## User Review Required

> [!WARNING]
> La Sandbox IA non può accedere al demone Docker dell'host. La fase di test dovrà essere eseguita manualmente dal PM seguendo la checklist di QA in fondo a questo documento.

## Proposed Changes

### [Component Name] NPM Scripts (Infrastructure)

#### [MODIFY] package.json (file:///Users/macbookm4cdv/Development/AI_Video_Editor/package.json)

Rimozione totale dei selettori `cd ../backend &&` e `cd ../frontend &&`. Modifica dei percorsi di output da relativi a root-based.

**Script aggiornati previsti:**
```json
"sb:serve": "supabase functions serve --no-verify-jwt",
"sb:start": "supabase start",
"sb:stop": "supabase stop",
"sb:status": "supabase status",
"kb:export": "echo '🐺 ESPORTAZIONE KNOWLEDGE BASE...' && rm -rf ../WOLF_EXPORTS && mkdir -p ../WOLF_EXPORTS && cp .gemini/*.md ../WOLF_EXPORTS/ && cp GEMINI.md ../WOLF_EXPORTS/ && echo '✅ File esportati in WOLF_EXPORTS pronti per Gemini!'",
"sb:mig:new": "supabase migration new",
"sb:mig:list": "supabase migration list",
"sb:types": "supabase gen types typescript --local > src/types/database.types.ts",
"sb:diff": "supabase db diff",
"sb:mig:save": "supabase db diff -f",
"sb:mig:up": "supabase migration up --local",
"sb:backup:local": "echo '💾 CREATING LOCAL SNAPSHOT...' && mkdir -p supabase/backups && supabase db dump --local --data-only > supabase/backups/LOCAL_$(date +%Y%m%d_%H%M%S).sql && ls -t supabase/backups/LOCAL_*.sql | tail -n +6 | xargs rm -f 2>/dev/null || true && echo '✅ Backup salvato (mantenuti solo gli ultimi 5 file)'",
"sb:snapshot": "echo '📸 UPDATING SEED.SQL FROM LOCAL DATA...' && supabase db dump --local --data-only > supabase/seed.sql && node scripts/sanitize-seed.js && echo '✅ seed.sql aggiornato e sanitizzato! Al prossimo reset avrai questi dati.'",
"sb:restore:latest": "echo '⏪ RESTORING LATEST LOCAL BACKUP...' && ls -t supabase/backups/LOCAL_*.sql | head -1 | xargs -I {} supabase db execute --local --file {} && echo '✅ Database ripristinato all ultimo backup!'",
"sb:login": "supabase login",
"sb:link": "echo '🔗 LINKING TO REMOTE PROJECT...' && supabase link",
"sb:push": "echo '🚀 DEPLOYING MIGRATIONS TO PRODUCTION...' && supabase db push",
"sb:types:remote": "echo '📥 FETCHING TYPES FROM PROD...' && supabase gen types typescript --linked > src/types/database.types.ts",
"sb:func:deploy": "echo '🚀 DEPLOYING EDGE FUNCTIONS...' && supabase functions deploy get-kiosk-config --no-verify-jwt && supabase functions deploy ingest-log --no-verify-jwt",
"sb:reset": "echo '🔄 RESET DB (SAFE)...' && supabase db reset",
"sb:nuke": "echo '☢️ HARD RESET...' && supabase stop --no-backup && supabase start && supabase db reset"
```

## Verification Plan & QA Instructions for PM (Host Docker)

### Manual Verification
> [!IMPORTANT]
> Una volta che il `package.json` sarà stato aggiornato dall'IA, tu (Tech Lead) dovrai eseguire la seguente checklist sul tuo terminale (Host):

1. **Avvio Infrastruttura Database:**
   Esegui `npm run sb:start`
   - *Verifica attesa:* Supabase parte via Docker senza errori di percorso. Le porte in output nel terminale devono corrispondere al range 5442x impostato nel `config.toml`.

2. **Avvio Frontend (Vite):**
   Esegui `npm run dev`
   - *Verifica attesa:* Vite monta il frontend correttamente ed è raggiungibile su `localhost`.

3. **Integrità Spegnimento:**
   Esegui `npm run sb:stop`
   - *Verifica attesa:* I container Docker vengono fermati correttamente senza lasciare processi appesi.
