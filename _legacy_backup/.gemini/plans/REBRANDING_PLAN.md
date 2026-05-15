# 🐺 REBRANDING PLAN: tAImetrack

## 1. UI/User-Facing Text Updates
The following files control the visual text and localization across the application layout:

- **HTML & PWA Config:** 
  - `frontend/index.html`: Update the main browser `<title>`.
  - `frontend/vite.config.ts`: Update the `manifest` configuration for `name` and `short_name`.
- **Localization Ecosystem (`frontend/src/lib/locales/*.ts`):** 
  - Update all localization dictionaries (e.g., `en.ts`, `it.ts`, `fr.ts`). Transform values mentioning "TimeTrackCRM" or "TimeTrack CRM" out to the official "tAImetrack" string. Be careful not to modify the internal key maps mapping, only the presentation values.
- **Component Text:** 
  - `frontend/src/auth/LoginComponent.tsx`: Main gateway branding.
  - `frontend/src/components/TimeTrackerPage.tsx` & `App.tsx`: App framing, navigation headers, and fallback states.

## 2. Configuration & Logistics Updates
- **Nodemon / Server Config:** 
  - `frontend/package.json`: Update the core package identifier to strictly lowercase to respect npm specs: `"name": "taimetrack"`.
- **Testing Constants:**
  - `frontend/src/tests/utils/wolf-base.ts`: Update test titles and generic strings where necessary.

## 3. Risk Assessment & Architectural Protection
🚨 **CRITICAL DATA-LOSS RISKS IDENTIFIED:**
- **IndexedDB Engine (`frontend/src/lib/db.ts`):** 
  - The Dexie instantiation utilizes a hardcoded database moniker globally on user devices. If we rename the internal `DB_NAME` variable inside Javascript, Dexie will mount an entirely new, empty container for every user on load. This will orphan all of their un-synced offline records, yielding catastrophic local data loss. 
  - **Strategy:** The front-facing interface will rebrand, but the architectural DB identifier MUST BE PRESERVED unchanged perfectly.
- **E2E Playwright Suite Regression:** 
  - The testing architecture (`frontend/src/tests/e2e/*.spec.ts`) relies on exact URL checking, Title validation (e.g., `await expect(page).toHaveTitle(/TimeTrack/)`), and strict aria-label evaluations. These will immediately crash in Husky CI checks upon deployment if not adapted synchronously.
  - **Strategy:** Plan an immediate follow-up patch to audit and remap `expect` blocks inside `/tests/e2e/`. All instances of `TimeTrack` in automated tests must be updated to explicitly evaluate `tAImetrack`.
- **Supabase / Postgres Integrations:**
  - Remote architecture remains mechanically decoupled from front-end styling namespaces. No Supabase edge functions or `database.types.ts` schemas require modifications. Zero backend risk detected.
