# Brief Architetturale - Analisi e Fix del Comando /wolf_flow

Hai innescato il comando `/plan` chiedendomi di analizzare perché `/wolf_flow` sta fallendo in questo nuovo ambiente `AI_Video_Editor`.

## Analisi del Problema (Perché non funziona?)

Il workflow `/wolf_flow` (ereditato dal vecchio progetto CRM) e lo script `wolf:prep` nel `package.json` contengono comandi cablati (hardcoded) che non sono compatibili con lo stato vergine di questo nuovo Boilerplate:

1. **Branch mismatch:** Lo script tenta di eseguire `git push origin develop`, ma come visibile dal tuo terminale, il branch principale di questo nuovo repository si chiama `master`. Questo fa fallire istantaneamente il comando `git push`.
2. **Push Remoto Supabase Assente:** Lo script lancia `npm run sb:push`. Tuttavia, non hai ancora collegato l'ambiente locale a un progetto remoto Supabase tramite `supabase link`. Il demone di Supabase va quindi in errore cercando di eseguire push di migrazioni su un database inesistente.

## Proposed Changes

### [Component Name] Wolf Workflows

#### [MODIFY] .agents/workflows/wolf_flow.md
Sostituire la stringa cablata `git push origin develop` con un comando dinamico che individui automaticamente il branch corrente:
`git push origin HEAD`

### [Component Name] NPM Scripts

#### [MODIFY] package.json
Nello script `wolf:prep`, sostituire il testo di cortesia che suggerisce il comando:
`👉 Ultimo step: git push origin develop --no-verify`
con una versione dinamica o corretta per il master:
`👉 Ultimo step: git push origin HEAD --no-verify`

## User Review Required

> [!WARNING]
> Il comando `/wolf_flow` include la direttiva `npm run sb:push`. Poiché siamo in una fase iniziale (Boilerplate) e non hai un database cloud di produzione collegato, **vuoi che io rimuova `npm run sb:push` dalla pipeline autonoma di wolf_flow**, oppure preferisci tenerlo ed eseguire prima tu il comando `npm run sb:link` sul terminale host?

Attendo la tua decisione prima di eseguire il fix!
