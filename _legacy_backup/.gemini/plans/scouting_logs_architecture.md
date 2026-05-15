# 🐺 SCOUTING REPORT: Logs & Micro-CMS Architecture

**Date:** 2026-04-13
**Status:** Read-Only Scouting Mission Passed

This report outlines the structural feasibility of using the current architecture to act as a dynamic Micro-CMS for specialized tracking elements like "Logs" (Health, Meeting, Expense, etc.) without requiring structural database schema modifications or new Supabase migrations.

---

## 1. The Target Database Schema (The `notes` Table)

Based on an inspection of `SCHEMA.md` and the Dexie local database initialization (`src/lib/db.ts`), the existing `notes` table acts as the perfect Polymorphic container for a Micro-CMS via the **FAST Model**. We do not need to create a new database table.

The `notes` table provides:
- **Relational Integrity:** Natively supports `<X>_id` relationships like `project_id`, `client_id`, `supplier_id`, `deal_id`, and `list_id`.
- **Classification Engine:** Integrates a `behavior_class` (e.g., `ACTIONABLE`, `EVENT`, `DESCRIPTIVE`), `type`, and an `archetype` column for domain-specific categorization.
- **Dynamic Payload Capacity (JSONB):** Utilizes `content` for rich text and `metadata` for strictly-typed but adaptable JSON objects.

---

## 2. Current State of Archetype Interfaces

Reviewing the central data dictionary (`frontend/src/types/crm.ts`), the TypeScript interfaces are already pre-configured for extensible polymorphic records. 

### The `NoteArchetype`
The exact `NoteArchetype` is defined as:
```typescript
export type NoteArchetype = 'note' | 'idea' | 'todo' | 'reminder' | 'meeting' | 'bug' | 'expense' | 'journal';
```

### The `NoteMetadata`
The `NoteMetadata` holds the true power for this Micro-CMS initiative. It already enforces baseline types (e.g., `financial_amount`, `pinned`, `severity`) but also explicitly exposes a flexible index signature:
```typescript
export interface NoteMetadata {
    // ... predefined fields ...
    [key: string]: unknown;
}
```
This arbitrary `[key: string]: unknown` dictates that any form state, dynamically generated input data, or domain-specific log (e.g., `blood_pressure: number`, `meeting_agenda_points: string[]`, `mood: string`) can be injected straight into `metadata` natively without violating the TypeScript compiler.

---

## 3. Supabase Sync Orchestration & Whitelisting

Analyzing the Sync Orchestrator handler (`frontend/src/lib/sync/handlers/syncNotes.ts`), the data propagation path to Supabase is fully mature and protected.

1. **Archetype Whitelisting:**
   During the Supabase `UPSERT` operation, `note.archetype` is evaluated against a strict array whitelist (`VALID_ARCHETYPES`). 
   ```typescript
   const VALID_ARCHETYPES = ['note', 'idea', 'todo', 'reminder', 'meeting', 'bug', 'expense', 'journal'];
   const safeArchetype = (note.archetype && VALID_ARCHETYPES.includes(note.archetype)) ? (note.archetype as NoteArchetype) : 'note';
   ```
   **Developer Note:** If we decide to introduce a new archetype (e.g., `'health_log'`), we only need to append it to `VALID_ARCHETYPES` in both `crm.ts` and `syncNotes.ts`. We do not need to mutate PostgreSQL schemas.

2. **JSONB Delivery:**
   The `metadata` field receives safe, direct casting:
   ```typescript
   const metadataForServer = (note.metadata as unknown as Json) || ({} as Json);
   ```
   This confirms that Supabase expects and accepts a generic PostgreSQL `JSONB` block on the `metadata` column. Any unstructured dictionary stored locally by Dexie will transmit intact and be correctly serialized onto the remote table.

---

## 4. Assessment for Phase V0 (Micro-CMS Viability)

**✅ The existing architecture is fully ready to support a dynamic Micro-CMS.**

**Why it works:**
1. We can deploy new React UI Forms ("Logs") matching specific domains.
2. The UI can serialize the resulting dynamic structured logic into `<X>LogPayload`.
3. The mutation layer drops this directly into `LocalNote.metadata`. 
4. We assign existing (e.g. `'journal'`) or newly mapped `archetype` strings to cleanly route filtering in the BI analytics layers.
5. `syncNotes.ts` pushes the payload straight to the cloud via the generic JSONB conduit with absolutely `0` backend modifications required.

We can confidently proceed with Phase V0 UI/UX development for 'Logs' leveraging the `notes` table.
