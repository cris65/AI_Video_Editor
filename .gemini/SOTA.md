# 🐺 SOTA (State of the Art)

> [!NOTE]
> AG: Questo documento riflette lo stato corrente dell'architettura e delle automazioni locali del Wolf-Stack Boilerplate.

## Architettura e Infrastruttura
- **Struttura Repository:** Monorepo root-based (rimosse separazioni legacy `frontend/` e `backend/`).
- **Stack Tecnologico Principale:** Vite, React, TypeScript, TailwindCSS.
- **Infrastruttura Dati:** Supabase locale (porte `5442x`) avviato tramite root `package.json` (`npm run sb:start`). Il demone Analytics è disattivato e il mapping `backend_port` è rimosso.

## Automazione (Open Agent Manager)
- I comandi custom dell'IA (macro e flussi di automazione) sono posizionati esclusivamente in `.agents/workflows/` sotto forma di file Markdown con intestazione YAML. I vecchi script `.toml` in `.gemini/` sono definitivamente deprecati e rimossi.
- **Workflow Pipeline:** Il comando `wolf_flow` non esegue operazioni remote (`npm run sb:push`) per garantire la sicurezza in fase di MVP. Tutti i push Git sono direzionati a `origin develop`.
