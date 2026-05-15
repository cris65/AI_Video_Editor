# 🐺 SOTA (State of the Art) — TimeTrack CRM
**Version:** v0.7.167 - 2026-05-02

**DOCUMENT DEFINITION FOR AI AGENTS:** This document is a strict architectural
blueprint derived from a direct forensic audit of the source code. It describes
only what is compiled and functional right now. No roadmaps. No past bugs. No
planned phases.

**Last Architectural Synchronisation:** v0.7.149 (2026-04-26) **Status:**
Architectural Blueprint (Forensic Audit)

---

## 1. Tech Stack (Active Libraries)

| Layer     | Library                      | Version      | Role                                              |
| --------- | ---------------------------- | ------------ | ------------------------------------------------- |
| Core      | React                        | ^18.3        | Component rendering                               |
| Core      | React Router DOM             | ^6.28        | SPA routing                                       |
| Build     | Vite + vite-plugin-pwa       | ^5.4 / ^0.20 | Bundler + PWA/Workbox                             |
| Styling   | TailwindCSS                  | ^3.4         | Utility-first CSS                                 |
| Animation | Framer Motion                | ^12          | Micro-animations                                  |
| Local DB  | Dexie.js + dexie-react-hooks | ^4.0 / ^1.1  | IndexedDB wrapper (Offline-First source of truth) |
| Remote    | @supabase/supabase-js        | ^2.46        | PostgreSQL + Realtime WebSockets                  |
| State     | Zustand                      | ^5.0         | Global UI/filter state stores                     |
| Editor    | @tiptap/react + extensions   | ^2.9         | Rich text editing                                 |
| DnD       | @dnd-kit/core + sortable     | ^6.3 / ^10.0 | Drag & Drop engine                                |
| Charting  | Recharts                     | ^2.13        | SVG analytics charts                              |
| Dates     | date-fns + rrule             | ^4.1 / ^2.8  | Date math + iCalendar recurrence                  |
| i18n      | i18next + react-i18next      | ^23 / ^15    | Localization (12 languages)                       |
| Testing   | Vitest + Playwright          | ^2.1 / ^1.48 | Unit tests + E2E tests                            |
| CI Gate   | Husky                        | ^9.1         | Pre-commit / pre-push hooks                       |

---

## 2. Local Database Schema (Dexie v68 — `TimeTrackDB`)

The local IndexedDB instance is managed by `src/lib/db.ts` at schema version
**68**. The following tables constitute the full Dexie schema currently in
production.

### Primary CRM Entities

| Dexie Table         | Mirrors Supabase Table | Key Indexes                                                                                                         |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `clients`           | `clients`              | `id, organization_id, status, is_personal, syncStatus, is_deleted, updated_at`                                      |
| `suppliers`         | `suppliers`            | `id, organization_id, status, is_personal, syncStatus, is_deleted, updated_at`                                      |
| `externalResources` | `external_resources`   | `id, organization_id, supplier_id, type, status, syncStatus, is_deleted`                                            |
| `contacts`          | `contacts`             | `id, organization_id, status, type, is_personal, syncStatus, is_deleted, updated_at`                                |
| `contactRoles`      | `contact_roles`        | `id, contact_id, role_type, is_personal, related_supplier_id, related_client_id, related_resource_id, syncStatus`   |
| `projects`          | `projects`             | `id, supplier_id, organization_id, client_id, status, is_personal, is_billable, syncStatus, is_deleted, updated_at` |
| `project_phases`    | `project_phases`       | `id, project_id, is_milestone, syncStatus, is_deleted, updated_at`                                                  |
| `deals`             | `deals`                | `id, name, stage_id, sort_order, client_id, syncStatus, is_deleted, organization_id, project_id`                    |
| `deal_stages`       | `deal_stages`          | `id, organization_id, sort_order, archetype, syncStatus, is_deleted`                                                |

### Relational Join (Bridge) Tables

| Dexie Table        | Mirrors Supabase Table | Key Indexes                                                              |
| ------------------ | ---------------------- | ------------------------------------------------------------------------ |
| `projectSuppliers` | `project_suppliers`    | `id, project_id, supplier_id, organization_id, syncStatus`               |
| `supplierContacts` | `supplier_contacts`    | `id, supplier_id, contact_id, organization_id, [supplier_id+contact_id]` |
| `projectContacts`  | `project_contacts`     | `id, project_id, contact_id, organization_id, [project_id+contact_id]`   |

### Notes & Tracking Tables

| Dexie Table     | Mirrors Supabase Table | Key Indexes                                                                                                                                                                             |
| --------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notes`         | `notes`                | `id, supplier_id, project_id, client_id, deal_id, list_id, type, status, due_date, sort_order, phase_id, is_archived, is_deleted, syncStatus, behavior_class, [project_id+type]`        |
| `note_lists`    | `note_lists`           | `id, organization_id, project_id, type, is_deleted, syncStatus`                                                                                                                         |
| `timeEntries`   | `time_entries`         | `id, supplier_id, contact_id, project_id, phase_id, organization_id, client_id, note_id, external_resource_id, start_time, is_running, is_personal, syncStatus, is_deleted, updated_at` |
| `tasks`         | `tasks`                | `id, supplier_id, project_id, phase_id, deal_id, client_id, status, is_archived, syncStatus, is_deleted, [project_id+phase_id]`                                                         |
| `user_settings` | `user_settings`        | `user_id, syncStatus, updated_at`                                                                                                                                                       |

### Entity Relational Map

```
contacts (neutral human)
  ├─── contact_roles ──► related_supplier_id (Supplier employee edge)
  │                 └──► related_client_id (Client contact edge)
  ├─── supplier_contacts ──► supplier_id (M:N vendor membership)
  └─── project_contacts  ──► project_id (M:N direct project assignment)

suppliers (vendor company)
  └─── project_suppliers ──► project_id (legacy vendor-project link)

clients ──► projects ──► project_phases
                    └──► notes (tasks, thoughts, expenses)
                    └──► time_entries

deals ──► deal_stages
      └──► client_id / project_id (optional links)

notes ──► note_lists (custom folder grouping)
      └──► project_id / client_id / supplier_id / deal_id / phase_id (contextual FK)
      └──► time_entries (via note_id — auto-generated by Meeting Transmutation)
```

---

## 3. Terminology Bridge: `notes` ↔ UI Labels

The underlying `notes` table in both Dexie and Supabase powers two distinct UI
surfaces. The technical table name is never exposed to the user.

| Code / DB Name                                           | UI Label                 | Description                                                       |
| -------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------- |
| `notes` (table)                                          | **Thoughts** / **Tasks** | The single unified persistence layer for all user-created entries |
| `archetype: 'note'/'idea'/'meeting'/'expense'/'journal'` | **Thought**              | Informational entries shown in the Thoughts UI (`/thoughts`)      |
| `archetype: 'todo'/'reminder'/'bug'`                     | **Task**                 | Actionable entries shown in the Tasks UI (`/tasks`)               |
| `note_lists`                                             | **Lists**                | Custom folder containers grouping `notes`                         |
| `time_entries`                                           | **Tracks**               | Billable/non-billable time logs                                   |
| `project_phases`                                         | **Phases**               | Timeline milestones within projects                               |

---

## 4. The Note-Centric Engine (FAST Model — Exhaustive Technical Detail)

### 4.1 NoteArchetype — The 9 Archetypes

The `NoteArchetype` union type is defined in `src/types/crm.ts` and is the
primary behavioral classifier for every `note` record.

```typescript
export type NoteArchetype =
  | "note"
  | "idea"
  | "todo"
  | "reminder"
  | "meeting"
  | "bug"
  | "expense"
  | "journal"
  | "log";
```

They are divided into two hard families by `src/lib/noteUtils.ts`:

```typescript
// Informational — displayed in Thoughts UI
export const THOUGHT_ARCHETYPES: NoteArchetype[] = [
  "idea",
  "note",
  "meeting",
  "journal",
  "expense",
  "log",
];

// Actionable — displayed in Tasks UI
export const TASK_ARCHETYPES: NoteArchetype[] = [
  "todo",
  "reminder",
  "bug",
  "expense",
];
```

> **Note:** `expense` appears in both families. It is a financial thought that
> carries an ACTIONABLE behavior class for lifecycle tracking. `log` represents
> automated telemetry injected via the Kiosk engine.

### 4.2 NoteClass — The 7 Behavior Classes (FAST Model)

Each archetype maps to a strict `NoteClass` string (replacing a legacy `1-5`
integer system). This mapping is enforced at save time in `useThoughts.tsx`:

```typescript
export type NoteClass =
  | "ACTIONABLE"
  | "EVENT"
  | "ISSUE"
  | "REMINDER"
  | "DESCRIPTIVE"
  | "FINANCIAL"
  | "METRIC";

const ARCHETYPE_TO_CLASS: Record<NoteArchetype, NoteClass> = {
  "todo": "ACTIONABLE",
  "reminder": "REMINDER",
  "bug": "ISSUE",
  "meeting": "EVENT",
  "note": "DESCRIPTIVE",
  "idea": "DESCRIPTIVE",
  "expense": "FINANCIAL",
  "journal": "DESCRIPTIVE",
  "log": "METRIC",
};
```

The `syncNotes.ts` handler applies a `enforceBehaviorClass()` gatekeeper that
converts any legacy numeric values to their string equivalents before any
Supabase payload is dispatched. In v0.7.149, we also strictly mapped the `expense` archetype to force `FINANCIAL` as its behavior class, resolving legacy UI-only mapping bugs.

### 4.3 NoteMetadata — Archetype-Specific Payload Fields

The `metadata: NoteMetadata` JSONB field on each note carries archetype-specific
structured data. All fields are optional but typed:

```typescript
interface NoteMetadata {
    // Universal fields
    pinned?: boolean;
    color?: string;
    tags?: string[];
    severity?: 'low' | 'medium' | 'high' | 'critical';
    priority?: 'low' | 'medium' | 'high' | 'urgent' | null;

    // EVENT archetype (meeting)
    event_start?: string | null;   // ISO datetime string
    event_end?: string | null;     // ISO datetime string

    // FINANCIAL archetype (expense)
    financial_amount?: number | null;
    financial_currency?: string | null;
    expense_date?: string | null;
    category?: ExpenseCategory | string;  // 'Software' | 'Travel' | 'Meals' | 'Office' | 'Marketing' | 'Consulting' | 'Other'
    payment_method?: PaymentMethod | string; // 'Credit Card' | 'Bank Transfer' | 'Cash' | 'PayPal' | 'Other'
    is_billable?: boolean;
    tax_amount?: number | null;
    receipt_ref?: string | null;
}

> **Merge/Replace Strategy:** Custom 'category' and 'payment_method' values are derived at runtime using a `DISTINCT` scan over active expense notes. Deleting a custom option executes a sweeping `db.notes.where('metadata.category').equals(val).modify()` call to bulk-update or nullify the field across all historical records synchronously.
```

### 4.4 The Meeting-to-Track Transmutation (Automation Logic)

This is the primary automation in the engine. It lives entirely in
`handleSaveNote()` inside `src/hooks/useThoughts.tsx` (lines 333–381).

**Trigger condition:** A note with `archetype === 'meeting'` is saved with
`metadata.status === 'done'` for the first time (idempotency check:
`existing.metadata?.status !== 'done'`).

**Execution sequence:**

1. An idempotency check queries Dexie:
   `db.timeEntries.where('note_id').equals(targetId).first()`. If a linked track
   already exists, the transmutation is skipped.
2. Duration is calculated from `metadata.event_start` and `metadata.event_end`.
   Fallback: 3600 seconds (60 minutes).
3. A new `TimeEntry` is constructed with:
   - `id`: fresh `crypto.randomUUID()`
   - `note_id`: the source meeting note's id (the relational link)
   - `project_id`, `client_id`, `supplier_id`: inherited from the note (or from
     the `extra` save payload)
   - `external_resource_id`: mapped from `note.assigned_to`
   - `description`: the meeting title
   - `start_time` / `end_time`: from `metadata.event_start` /
     `metadata.event_end`
   - `duration`: calculated seconds
   - `is_running: false`, `is_done: true`
   - `syncStatus: 'pending_create'`
4. The new track is written to `db.timeEntries` via `db.timeEntries.put()`.
5. The source meeting note is simultaneously auto-archived (`is_archived: true`)
   on the same save operation.
6. `syncPendingData()` is called after a 300ms `setTimeout` to dispatch both
   records to Supabase asynchronously.

### 4.5 Universal Archetype Mutation Engine (db.ts Proxy)

All three write entry points on `db.notes` (`add`, `put`, `update`) are
monkey-patched in `src/lib/db.ts` to enforce structural correctness
automatically:

- If `archetype` is a task type (`'todo'`, `'reminder'`, `'bug'`), it forces
  `behavior_class: 'ACTIONABLE'`, `type: 'task'`, and `status: 'todo'` (if no
  status exists).
- If `phase_id` is set and the target phase is **not** a `type: 'list'` phase,
  and the archetype is not a protected structural type (`'expense'`,
  `'meeting'`, `behavior_class: 'EVENT'`), the engine coerces the note to
  `archetype: 'todo'`.
- Uses `Dexie.currentTransaction` to detect active transactions that don't
  include `project_phases`, falling back gracefully to avoid
  `PrematureCommitError`.

### 4.6 Auto-Archive Gating (NoteModal + useThoughts)

The auto-archive mechanism is gated by the `ARCHETYPE_TO_CLASS` dictionary in
`NoteConstants.ts`. Only notes whose archetype maps to `'ACTIONABLE'` are
eligible for automatic archival when their status reaches a terminal value
(`done`, `solved`, `wont_fix`, `canceled`, `archived`).

**Two enforcement points exist:**

1. `NoteModal.tsx` → `updateMetadata()`: When a status change hits an
   `ARCHIVE_TRIGGER_STATUSES` value, the `onArchive` callback and `onClose()`
   are only fired if `ARCHETYPE_TO_CLASS[formData.archetype] === 'ACTIONABLE'`.
   Non-actionable archetypes (e.g., `expense` → `FINANCIAL`) simply save their
   status via standard auto-save without triggering the archive cascade.
2. `useThoughts.tsx` → `handleSaveNote()`: The spread `{ is_archived: true }` is
   conditionally applied only when
   `ARCHETYPE_TO_CLASS[archetype] === 'ACTIONABLE'`.

## 4.7 Universal Markdown & Mermaid Architecture (TiptapEditor)

The application intercepts, hydrates, and parses Markdown content universally
through the `TiptapEditor` integration:

1. **Hydration Middleware (`resolveContent`)**: Before initialization, TipTap
   payloads are forcefully scanned for restrictive wrappers (e.g., legacy
   `codeBlock` or `paragraph` JSON encasements). If raw structural markdown is
   found buried inside these nodes, it is mathematically extracted as a literal
   string to ensure accurate `text/plain` parsing by the Markdown engine upon
   mount.
2. **VSCode Clipboard Scrubber**: The `transformPastedHTML` configuration
   actively scrubs heavily styled HTML IDE text (`vscode-editor` traces) dropped
   during paste events. This blocks the TipTap core HTML `CodeBlock` from
   swallowing markdown pastes blindly, explicitly shifting routing to the
   `tiptap-markdown` module natively.
3. **Mermaid React NodeView**: `<CodeBlock>` nodes strictly asserting
   `language='mermaid'` are piped into a custom `@tiptap/react`
   `NodeViewWrapper`. Using dynamic ID generation (`mermaid-cast-*`),
   `mermaid.js` executes autonomous, offline offline SVG rendering. It hooks
   identically into TipTap's selection cycle to smoothly oscillate between
   visual SVG output and real-time Markdown syntax editability.
4. **Editor Synchronization Stabilization**: The Editor natively deflects
   aggressive state-update props or tick-renders using `React.memo` and a strict
   string/JSON `useRef` hash comparator. TipTap `editor.commands.setContent()`
   is mathematically gated to only fire when the external network explicitly
   injects an inbound content payload that structurally differs from the local
   hash. Furthermore, during active editing, the local TipTap instance acts as
   the Sovereign source of truth—the `NoteModal` strict autosave debounce logic
   completely severs background Dexie loop updates, mathematically blocking the
   Editor from injecting its own autosaved content updates, thereby eradicating
   UX scroll-jumps. The wrapper click handler is also strictly bound to
   `e.target === e.currentTarget` to prevent selection hijacking.

---

## 6. Semantic Z-Index Configuration

The application employs a strict Tailwind CSS custom configuration for z-index
(`tailwind.config.js`):

- `z-base`: 0
- `z-ui`: 100
- `z-floating`: 500
- `z-dropdown`: 1000
- `z-tooltip`: 1500
- `z-app-modal`: 5000 (standard app modals like NoteModal, ExportModal)
- `z-system-modal`: 10000 (critical system alerts, print modals, Kiosk overlays)
- `z-notification`: 20000
- `z-god`: 100000 Arbitrary rogue z-index values (e.g., `z-[11000]`) are
  permanently forbidden.

## 5. Data Synchronization Architecture (Trinity Stack)

### 5.1 The Three Pillars

1. **Dexie.js** (`src/lib/db.ts`): The authoritative local source of truth.
   Every mutation writes here first, synchronously, enabling zero-latency
   optimistic UI.
2. **Sync Orchestrator** (`src/lib/sync/utils/syncOrchestrator.ts`): A 15-second
   metronome (`intervalMs = 15000`) that runs domain sync handlers sequentially
   in strict topological FK order.
3. **Supabase Realtime** (`src/lib/syncManager.ts`): WebSocket listeners
   subscribed to all 16 tables. Inbound events are processed **immediately and unconditionally** via `handleRealtimeEvent()`, applying a **strict 4-rule LWW contract** (see §5.3). The `isSyncing` lock is exclusively for the Orchestrator upload cycle and **never** blocks the inbound WebSocket stream.

### 5.2 Sync Orchestrator — Topological Priority Order

The orchestrator enforces this exact push sequence to prevent FK `23503`
violations:

```
0. user_settings    (root preferences)
1. clients          (root B2B entity)
2. suppliers        (legacy B2B)
3. external_resources (depends on suppliers)
4. contacts         (neutral human — must precede contact_roles)
5. contact_roles    (bridge: depends on contacts, suppliers, resources)
6. projects         (depends on clients)
7. project_phases   (depends on projects)
8. deal_stages      (root for deals)
9. deals            (depends on deal_stages, clients)
10. note_lists      (parent of notes)
11. tasks           (depends on projects)
12. notes           (depends on projects, note_lists)
13. time_entries    (leaf — depends on notes via note_id)
```

The orchestrator also manages:

- A **global mutex** (`isGlobalSyncRunning`) preventing overlapping cycles.
- **Per-table locks** (`tableLocks`) preventing concurrent access to a single
  handler.
- A **`window.__isSyncing__`** guard that blocks Realtime WebSocket echo
  processing during an active sync cycle.
- An **emergency mutex release** if a cycle runs beyond 60 seconds (stuck
  detection).

### 5.3 Realtime WebSocket Layer — Strict LWW Contract (v0.7.158)

`handleRealtimeEvent()` in `src/lib/syncManager.ts` is the **inbound-only** handler for Supabase Realtime WebSocket events. It applies a **strict 4-rule LWW (Last-Write-Wins) contract** — timestamp is the sole arbiter:

1. **Resurrection Guard (Rule 1):** If the local record has `is_deleted: true` or `syncStatus: 'pending_delete'` and the remote payload is NOT a delete, the event is dropped. A locally-deleted record can never be resurrected from the server.
2. **Echo Shield (Rule 2 & 4):** If the local record has a `pending_update` or `pending_create` status AND `local.updated_at >= remote.updated_at`, the event is a network echo of our own mutation — it is dropped.
3. **Cross-Device Win (Rule 3):** If `remote.updated_at > local.updated_at`, the change originated on **another device**. The remote payload **MUST win** and is written to Dexie immediately, regardless of `syncStatus`.
4. **Stale Drop:** If `local.updated_at > remote.updated_at` (with no pending status), the remote payload is stale — dropped.

> **Critical architectural note:** The `window.__isSyncing__` flag was removed from `handleRealtimeEvent()`. It now exclusively guards the Orchestrator's upload cycle. Blocking inbound Realtime events during a sync cycle was the root cause of Mobile→Desktop sync silently failing (changes from another device were dropped as "echoes").

### 5.4 Hydration Protocol (Cold Boot)

`src/lib/hydrationManager.ts` orchestrates cold-boot data loading from Supabase
to Dexie in two parallel waves:

- **Wave 1 (Primary entities — parallel):** `clients`, `suppliers`, `contacts`,
  `projects`, `project_phases`, `note_lists`, `deal_stages`
- **Wave 2 (Relational leaves — parallel):** `external_resources`,
  `supplier_contacts`, `project_suppliers`, `project_contacts`, `contact_roles`,
  `tasks`, `notes`, `time_entries`, `deals`

Each hydration call applies a **LWW check** before writing: if a local record
exists with a newer `updated_at`, the remote data is not overwritten. Entities
with `is_deleted: true` are excluded from hydration queries at the Supabase
level (`eq('is_deleted', false)`).

> **`time_entries` Special Case:** The hydration handler explicitly coerces
> `rrule: e.rrule ?? null` to normalize `undefined` to `null` on newly added
> iCalendar fields, preventing Dexie schema type mismatches.

### 5.4.1 Notes Pull Query Contract (v0.7.159)

The `pullRemoteData()` function inside `syncNotes.ts` fetches all notes using a strict `.eq('organization_id', orgId)` filter (no `.or()` clause). This guarantees that **every note belonging to the organization** is pulled, regardless of its `is_personal` value or `user_id`.

The previous `.or('organization_id.eq.X,user_id.eq.Y')` query was dropped because it introduced logical ambiguity with the preceding `.eq('is_deleted', false)` filter in PostgREST, causing notes with `is_personal: null` to be silently excluded from the pull result.

### 5.4.2 `is_personal` Tri-State Contract (v0.7.159)

The `is_personal` field on `notes` is a **tri-state**:

| Value | Meaning | UI Tab |
|---|---|---|
| `true` | Explicitly personal | PERSONAL |
| `false` | Explicitly team/work | WORK |
| `null` / `undefined` | Default (created without explicit flag) | **WORK** |

**THE LAW:** The `NotesManager` workspace filter MUST use `n.is_personal === true` as the inclusion predicate for PERSONAL. Using `n.is_personal !== false` (the old broken pattern) incorrectly promoted `null`-flagged notes to PERSONAL, hiding them from the WORK tab. Notes created on mobile without an explicit `is_personal: false` carry `null` from the server and MUST be displayed in the WORK tab.

### 5.4.3 Universal Hydration LWW Contract (v0.7.165)

All `hydrateXxx()` functions in `hydrationManager.ts` apply a **unified `shouldWriteFromServer()` helper** — NOT a syncStatus check. This replaces the previous broken `if (!local || local.syncStatus === 'synced')` gate that was present on 13 of 14 hydration handlers.

The `shouldWriteFromServer(local, remoteUpdatedAt)` function implements the same 4-rule LWW contract as `handleRealtimeEvent()`:

| Condition | Action |
|---|---|
| Record not in Dexie (`!local`) | Always write from server |
| Local has no pending mutation + `remote.updated_at >= local.updated_at` | Write from server (standard update) |
| Local has `pending_update/create` + `remote.updated_at > local.updated_at` | Server is even newer → server wins |
| Local has `pending_update/create` + `remote.updated_at <= local.updated_at` | Skip — protect offline mutation |

This contract is applied uniformly to: `clients`, `suppliers`, `externalResources`, `contacts`, `contactRoles`, `projects`, `project_phases`, `deal_stages`, `deals`, `tasks`, `note_lists`, `notes`, `timeEntries`.

> **Critical fix:** The previous `if (!local || local.syncStatus === 'synced')` condition was architecturally incorrect for 13 handlers. It blocked any entity with a stale `pending_update` syncStatus from being overwritten by a newer server version, causing permanent cross-device divergence on ALL entity types. The LWW timestamp is the sole arbiter, identical to `handleRealtimeEvent()`.

### 5.4.4 `syncProjects` Race Condition Fix (v0.7.164)

`src/lib/sync/handlers/syncProjects.ts` no longer reads back the Supabase `upsert` response to update Dexie. The previous `...data` spread overwrote Dexie with server state that could be stale if the user edited the project between the sync read and the HTTP response arrival.

**The corrected contract:**
- The upsert is fired without `.select().maybeSingle()`
- On success: only `{ syncStatus: 'synced', lastUpdated: now }` is written to Dexie
- The Realtime echo from Supabase — protected by the LWW contract (§5.4.3) — is the canonical path for server-authoritative data to reach Dexie
- This prevents the race condition: `pending_create` → sync ack overwrites user edits → user sees stale name

---

## 6. State Management (Zustand Stores)

### `useGlobalFilters` — Persisted to `localStorage`

Controls global BI analytical context across Dashboard, Tracker, and Projects.

- `workspace: 'work' | 'personal' | 'all'` — Active domain filter.
- `dateRange / timeRange: TimeRange` — Active time window
  (`'all' | 'ytd' | 'month' | 'week' | 'today' | 'custom'`).
- `customStartDate / customEndDate: string | null` — Boundaries for `'custom'`
  range.
- `selectedClients: string[]` / `selectedProjects: string[]` — Multi-select
  inclusion filters (empty = "All").
- `trackerIsPersonal: boolean` — Tracker-specific workspace override.
- `showWork / showPersonal / showInternal: boolean` — Legacy compatibility
  booleans derived from `workspace`.

### `useCalendarFilterStore` — Volatile (not persisted)

Governs the independent visual layer toggles in the `CalendarHub` and
`ProjectCalendar`.

- `showToDos / showEvents / showTimeEntries / showProjects / showExpenses / showPlanned: boolean`
  — Independent archetype visibility toggles per calendar entity type.
- `hideCompleted: boolean` — Noise reduction toggle.
- `showWork / showPersonal: boolean` — Domain context (multi-select, not
  exclusive). These are **passed as reactive dependencies** into
  `useCalendarAggregator` and directly gate the `recordPulse` function for Daily
  Pulse totals.
- `selectedClientId / selectedProjectId: string | null` — Contextual scoping for
  project-specific calendar views.

### `useUIStore` — Volatile (not persisted)

Global triage controller for modal lifecycle and creation context.

- `spawnDate: Date | null` — Carries a date a user clicked in the calendar,
  piped to creation modals via `MainLayout`.
- `isActionSheetOpen: boolean` — Controls the mobile FAB action sheet.
- `isActionCenterOpen: boolean` — Global flag that opens the
  `ActionCenterModal`. `Dashboard.tsx` subscribes via selector and renders
  `ActionCenterModal` reactively.
- `actionCenterProjectId: string | null` — Optional project scope for the Action
  Center. When set, the modal only renders alerts for that specific project. Set
  via `setActionCenterOpen(true, projectId)`.
- `closeAllModals()` — Called by React Router on navigation to guarantee
  teardown. Resets both `isActionCenterOpen` and `actionCenterProjectId` to
  their default values.

### Global Alert System

The alert system is Dashboard-native. There is no cross-route header badge.

- **`Dashboard.tsx` — Inline Attention Required Banner:** A full-width
  block-level banner renders at the top of the Dashboard content area (above
  `<ExecutiveKpiRow />`). It renders when
  `Object.keys(filteredAnomalies).length > 0`. The `filteredAnomalies` memo
  intersects the raw hook anomalies with `dashboardProjects` (which respects
  Work/Personal/Internal and Client/Project filters), guaranteeing the banner
  count is strictly scoped to the active view.
- **`useDashboard.ts` — `anomalies` map:** The `anomalies` `useLiveQuery`
  detects three flag types: `overdue` (due_date in the past), `inconsistent`
  (time entry outside project date range), and `budgetOverrun` (tracked seconds
  > estimated_hours × 3600). Terminal projects (`done`, `archived`, `completed`)
  are explicitly skipped.
- **`ActionCenterModal.tsx` — `actionCenterProjectId` scope:** The modal
  consumes `useUIStore.actionCenterProjectId`. When set, the `alerts` `useMemo`
  filters for the specific project ID, enabling a per-project Action Center view
  from `ProjectDetailsPage`.
- **Alert Data Contract:** `filteredAnomalies` (Dashboard) and
  `ActionCenterModal.alerts` maintain strict parity: identical project status
  exclusions and scope application.

### Custom Component Architectures (Portals)

The app systematically replaces nested z-index stacking with React Portals
(`createPortal(..., document.body)`) to escape `overflow: hidden` and
`handleClickOutside` listener trapping.

- **`CustomSelect.tsx`:** Custom creation and renaming forms use `z-[999999]`
  Portals paired with `e.stopPropagation()` on the backdrop overlay. This
  structurally isolates typing events and prevents the underlying combobox from
  unmounting out of state during an interaction.

---

## 7. RRULE Recurrence Engine

The `rrule` column exists on the `time_entries` table (Dexie index included). It
stores standard iCalendar RRULE strings (e.g., `"FREQ=WEEKLY;BYDAY=MO,WE"`).

- **Template rows:** Real Dexie records with an `rrule` string. Displayed in
  calendars with `is_recurring_ghost: false`.
- **Ghost occurrences:** In-memory, virtualized expansions produced by
  `expandRRuleOccurrences()` in `src/lib/rruleUtils.ts`. Their calendar IDs
  follow the pattern `${templateId}-ghost-${N}`. No Dexie or Supabase row is
  created for ghosts.
- **Ghost detachment:** The `RecurrenceChoiceDialog` portal allows a user to
  detach a ghost into a real independent row, or inject an `EXDATE` token into
  the mother template to skip one occurrence.
- **Calendar integration:** `useCalendarAggregator.ts` expands ghosts within the
  active week/month boundaries. `useTracker.ts` expands within a strict +30-day
  Event Horizon.
- **Time inheritance:** The expansion utility strips `byhour`, `byminute`, and
  `bysecond` tokens from RRULE options and propagates the original `dtstart`
  time to each ghost, preventing UTC midnight bleed.

---

## 8. Calendar Aggregation Architecture

### `useCalendarAggregator.ts`

The single `useLiveQuery` hook that materializes all calendar items for
`CalendarHub.tsx`. It operates within a strict month+grid window
(`startOfWeek(monthStart)` → `endOfWeek(monthEnd)`).

**Data Sources:** `time_entries`, `notes`, `deals`, `projects`, `clients`,
`suppliers`, `externalResources`, `contacts` — all fetched in a single
`Promise.all`.

**Entity Classification:** Notes are classified by `archetype` and
`behavior_class` into `isEvent`, `isExpense`, or `isActionable`. Expense notes
are processed **exclusively** by the `isExpense` branch regardless of their
`behavior_class` value. The `isActionable` gate enforces `!isExpense` to prevent
a dual-push / Map-deduplication collision that would strip `financial_amount`
from the resulting item. The authoritative class mapping for expenses is
`FINANCIAL` (defined in `NoteConstants.ts`).

**Cashflow Strict Model (Expenses):** Only expense notes with
`metadata.status === 'done'` are aggregated into daily totals. Non-done expenses
appear in lists but do NOT contribute to the calendar daily pulse.

**Workspace Inheritance (is_personal):** For Notes, `is_personal` is resolved
via an explicit inheritance chain: `note.is_personal` →
`projectMap[note.project_id]?.is_personal` →
`clientMap[note.client_id]?.is_personal` → `false`. This prevents personal
project notes from leaking into the Work workspace filter.

**Daily Pulse Aggregation (`dailyTotals`):** The hook maintains a
`Record<string, { totalExpenses: number }>` keyed by `YYYY-MM-DD`. The
`recordPulse()` inner function accumulates `financial_amount` for expense notes
only, respecting the `showWork` / `showPersonal` filter state. The `dailyTotals`
map is attached directly to the returned `uniqueItems` array as a
non-enumerable-compatible property (`uniqueItems.dailyTotals = dailyTotals`) and
extracted in `CalendarHub.tsx` using a typed `unknown` cast.

**`financial_amount` Coercion:** Values are read from
`note.metadata.financial_amount` and explicitly coerced via `Number()` with an
empty-string guard, since the `NoteModalFooter` input may persist strings rather
than numbers.

### `CalendarHub.tsx`

Extracts `dailyTotals` from the aggregator result and passes a per-day
`dailyPulse` prop to each `<CalendarDay>` instance for all three view modes
(month, week, day).

### `CalendarDay.tsx`

The day header renders a `<Wallet>` icon badge with the total daily expense sum
when `dailyPulse?.totalExpenses > 0`, positioned alongside the existing
billable/cost track duration pills.

### `CalendarBlock.tsx`

Expense cards render `financial_amount` via the pre-existing `FINANCIAL METRICS`
block (`!isCompact && entity_type === 'expense'`) using `formatCurrency()`
(Intl.NumberFormat). Project and Client contextual badges render unconditionally
based on data presence, not entity type.

---

## 9. Integrity Protocols (Active Enforcement)

### Zero-Spread Payload Policy

Network payloads to Supabase are **never** constructed via `{...dexieObject}`
spread. Each field is explicitly mapped by name inside sync handlers. An
`ALLOWED_KEYS` whitelist pattern strips local-only metadata (`syncStatus`,
`lastUpdated`, React framework keys) before The primary goal of the application
is **zero-latency operations** with a "Ghost Mode" approach. All database saves,
modifications, and deletions occur in IndexedDB _instantly_ with a state mapping
(`syncStatus: 'pending_update'`). Wait times are non-existent.

**Type/Hydration Shielding:** The database layer enforces architectural
Push/Pull symmetry. Cold-boot cache hydrations and Realtime WebSocket payloads
mathematically strip property prefixes (e.g. `RRULE:`) and coerce `undefined`
fields to strict `null` to protect Dexie schema compatibility and IndexedDB
index viability. After the orchestrator confirms the soft-delete `upsert` with
Supabase, the handler executes a hard local `db.notes.delete(note.id)` to
destroy the Dexie record, preventing resurrection on page refresh.

### Anti-Ghosting Filter

All `useLiveQuery` hooks fetching entities in the UI **must** append
`.filter(n => !n.is_deleted)` manually to the Dexie result, since Dexie does not
enforce server-side `is_deleted` constraints. This prevents soft-deleted records
from rendering in the UI between the local write and the confirmed remote sync.

### Auto-Archive Dual-Check Filter

To prevent state leakage between 'Active' and 'Archived' task lists—particularly
for legacy notes or records modified outside the standard `NoteModal`
pipeline—all task rendering layers (e.g., `useThoughts.tsx`,
`ProjectTasksTab.tsx`) enforce a **dual-check UI filter**. The logic verifies
`!n.is_archived && !ARCHIVE_TRIGGER_STATUSES.includes(n.metadata.status)`. This
ensures that tasks displaying terminal statuses (like `solved`, `wont_fix`,
`done`) are mathematically ported to the Archived views instantly, independent
of underlying `is_archived` database boolean synchronization drift.

### LWW Timestamp Bump

Every `db.put()` or `db.update()` call that creates a mutation appends
`updated_at: new Date().toISOString()` explicitly. This guarantees the LWW
shield in the Realtime listener correctly identifies the local write as newer
than any stale incoming WebSocket broadcast.

### UUID Sanitization Guard (`secureUUID`)

All foreign key values passed into Supabase payloads are passed through a
`secureUUID()` function in `syncNotes.ts`. This regex-validates the value as a
PostgreSQL-compliant UUID (`/^[0-9a-fA-F]{8}-...-[0-9a-fA-F]{12}$/`).
Non-compliant strings (e.g., `'null'`, `'undefined'`, or malformed legacy IDs)
are coerced to `null` before the payload is sent, preventing `22P02` PostgREST
cast errors.

### PWA Service Worker Isolation

Vite PWA Workbox enforces a strict `NetworkOnly` strategy for all requests
matching `.*\.supabase\.co/.*`. Supabase API and WebSocket traffic is **never**
intercepted, cached, or served from the Service Worker cache.

### Debounce Shield (15-second cooldown)

`syncPendingData()` in `syncManager.ts` tracks `lastSyncExecution`. Calls within
15 seconds of the last cycle are silently blocked unless the
`forceBypassShield: true` flag is explicitly passed. This prevents UI
interaction storms from hammering the Supabase API.

### Project and Phase Boundary Anchor Protocol (Bidirectional)

To prevent temporal orphaning of data, the UI strictly validates parent-child
date modifications via **reverse boundary checks**.

1. **Phase Expansion**: Triggers a prompt to extend parent Project dates,
   pushing a structurally immutable System Audit Log (`⚡`-prefixed) on
   acceptance.
2. **Project/Phase Shrinkage**: First checks for child `project_phases`
   exceeding new limits (prompting auto-truncation). Then performs a **Hard
   Track Blockade**: If legacy `time_entries` reside outside the new tighter
   dates, the shrink command is **hard blocked**. The UI immediately renders the
   isolated anomalous tracks inline and provides automatic
   `/projects/{id}?mode=inconsistency_check` zero-friction routing to the Zen
   Mode tracking scope to ensure the user manually realigns or deletes their
   tracked historical data before adjusting the architectural timeline layer.

---

## 10. Timer State Machine Architecture

### 10.1 TimerContext (`src/context/TimerContext.tsx`)

The global timer is managed by a single `TimerProvider` that wraps the entire
app. It exposes a `TimerContext` consumed via the `useTimer()` hook (thin
wrapper in `src/hooks/useTimer.ts`).

**Exported interface:**

| Action             | Signature                                                             | Purpose                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `start`            | `(projectId?, description?, clientId?, isPersonal?) => Promise<void>` | Creates a new live timer. Guards: GUARD 0 (React state), GUARD 1 (cooldown), GUARD 2 (in-flight lock), GUARD 3 (Dexie-level uniqueness). |
| `stop`             | `() => Promise<void>`                                                 | Stops all running entries atomically. Clears localStorage and React state before the Dexie transaction.                                  |
| `startFromPlanned` | `(entryId: string) => Promise<void>`                                  | Atomically transitions a PLANNED track to a live timer. See §10.2.                                                                       |
| `updateEntry`      | `(id, updates) => Promise<void>`                                      | Surgical Dexie update for inline edits (drag/drop, etc).                                                                                 |
| `activeEntry`      | `TimeEntry \| undefined`                                              | The currently running track, hydrated by `useLiveQuery`.                                                                                 |
| `elapsedSeconds`   | `number`                                                              | Tick counter, 1-second interval, read-only.                                                                                              |

**Active entry detection:** `useLiveQuery` runs
`db.timeEntries.where('is_running').equals(1)`. Fallback:
`db.timeEntries.toArray()` filtered by `is_running === true || !end_time`.

**SYNC REVERSE effect:** A `useEffect([activeEntry, runningEntryKey])` keeps
`localStorage` aligned with the live Dexie state. When `activeEntry` exists, it
re-pins `runningEntryKey` to `activeEntry.id`. When `activeEntry` is undefined
and `runningEntryKey` is set, it clears localStorage.

### 10.2 `startFromPlanned` — Atomic PLANNED Track Activation

**Problem it solves:** The standard `stop() → start()` sequence has a React
stale-closure race. After `stop()` resolves and commits to Dexie, `useLiveQuery`
has not yet re-rendered. `start()`'s GUARD 0 (`if (activeEntry)`) reads the
stale closed-over value (old running timer) and aborts with "Timer already
running in state. Start aborted."

**Solution:** A single Dexie `'rw'` transaction performs both mutations
atomically — no React re-render boundary between stop and start.

**Execution sequence:**

1. GUARD 1 (cooldown) and GUARD 2 (in-flight lock) are checked.
2. `localStorage` and `setRunningEntryKey(entryId)` are set **before** the
   transaction (optimistic, matching `start()` pattern) to prevent the SYNC
   REVERSE effect from resetting the key mid-flight.
3. Inside the transaction:
   - All genuinely running entries are stopped (explicit
     `is_running: false, end_time: nowISO`). The target planned entry is
     **excluded** from this loop via `String(e.id) !== entryId` to prevent a
     double-write that collapses Dexie's `liveQuery` change detection.
   - The planned entry is read from Dexie and activated via an explicit
     Zero-Spread `put()`: `is_running: true`, `is_done: true`,
     `start_time: nowISO`, `end_time: null`, `duration: 0`, `rrule: null`,
     `syncStatus: 'pending_update'`.
4. `syncPendingData()` fires after the transaction.

**Semantic contract:** When a PLANNED track (`is_done: false`) is played, its
`start_time` is reset to the moment of activation (the task is starting _now_).
The original planned forecast time is discarded. `rrule` is cleared — actuals
cannot be recurring templates.

### 10.3 Modal Decoupling — `TimeEntryModal` & `SupplierTimeEntryModal`

Both tracker modals enforce a strict bifurcation of the `handleSave` function:

| Entry State                                         | Save Path                                                                                       | Timer Mutation                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **New entry** (`!entry.id` or `id === 'new-draft'`) | Full creation flow: `shouldBeRunning = !finalEnd`, cascade-stop, `syncStatus: 'pending_create'` | YES — timer state derived from end_time presence                    |
| **Existing entry** (`entry.id` present)             | Metadata-only update: description, project, rrule, billable, etc.                               | **NEVER** — `is_running` copied verbatim from existing Dexie record |

**`isExistingEntry` sentinel:** Derived at render scope
(`!!(entry?.id && entry.id !== 'new-draft')`). Gates the footer button: existing
entries always show **Save Changes** (indigo, Save icon). New entries show
**Start Timer** (emerald, Play icon) or **Save** based on whether an end time is
set.

**Date/time picker change detection:** In the EDIT branch,
`pickerStartMs !== originalStartMs` and `pickerEndMs !== originalEndMs`
determine whether the user explicitly moved the date pickers. Only if changed
are `start_time`, `end_time`, and `duration` overwritten. Otherwise, the
existing Dexie values are preserved byte-for-byte.

**Zero-Spread enforcement:** The EDIT branch `db.timeEntries.put()` call uses
explicit field-by-field mapping across all columns — no JS spread is used to
prevent UI-only or local-only properties from contaminating the payload.

---

## 11. E2E Testing Infrastructure (`src/tests/e2e/`)

### 11.1 Architecture Overview

All E2E tests run sequentially (`--workers=1`) via Playwright. The test suite
covers 10 core scenarios (WOLF TEST 1–10) executing on an automated CI/CD
pipeline via **GitHub Actions**. This establishes a bulletproof quality
assurance barrier before production merges.

### 11.2 `nukeTestState` — The REST API Cascade Cleanup (`src/tests/utils/wolf-cleanup.ts`)

The WOLF NUKE performs a full server-side teardown after each multi-device test
to prevent test state from leaking across sequential runs. It executes in 3
phases:

**Phase 1 — ID Resolution (parallel GET):** Fetches IDs of all test-prefixed
clients and projects from Supabase using PostgREST `or=(name.ilike.WOLF_%,...)`.
Case-insensitive `ilike` is mandatory — test data uses mixed case (`Wolf Corp`,
`Wolf Project`) while filters use uppercase prefixes.

**Phase 2a — FK Cascade (sequential DELETE, leaf-to-root):**

```
time_entries (description ilike)
time_entries (client_id IN [...])
time_entries (project_id IN [...])
notes (client_id)
tasks (client_id)
deals (client_id)
contact_roles (related_client_id)
notes (project_id)
tasks (project_id)
project_phases (project_id)
project_contacts (project_id)
project_suppliers (project_id)
```

**Phase 2b — Client-linked project cascade:** GETs additional project IDs where
`client_id IN (test_client_ids)`. These projects may not match the name filter
(e.g., a project named generically but linked to a Wolf Corp client). Their FK
children are cascaded and the projects deleted by `id=in.(...)` before the root
tables.

**Phase 3 — Root deletes:**

```
projects (name ilike filter)
clients (name ilike filter)
```

**Critical rules:**

- `404` responses are treated as `OK` (nothing to delete).
- `409` indicates a missing FK child — expand Phase 2 to cover the leaking FK
  path.
- All steps use `Prefer: return=minimal` for zero-payload responses.
- Subquery syntax (`project_id.in.(select ...)`) is NOT supported by the
  PostgREST REST API. Always use two-step ID resolution.

**Test prefixes monitored:** `WOLF_%`, `TARGET_%`, `E2E_%`, `OFFLINE_%`,
`PERSIST_%`.

### 11.3 Key E2E Resilience Patterns

**Deterministic Network Waits:** All arbitrary `waitForTimeout()` calls that
waited for Supabase hydration have been replaced with `page.waitForResponse()`
interceptors targeting `time_entries` API calls (`GET`, `POST`, `PATCH`).

```typescript
const syncReq = page.waitForResponse(
  (res) =>
    res.url().includes("time_entries") &&
    ["POST", "PATCH"].includes(res.request().method()),
  { timeout: 10000 },
).catch(() => null); // .catch() prevents crash on ServiceWorker cache hits
await action();
await syncReq;
```

**Stale Locator Prevention:** After a `page.reload()`, any previously defined
`const btnX = page.getByTestId(...)` is stale. All assertions after a reload
MUST re-query the locator inline:
`await expect(page.getByTestId('timer-toggle-button')).toContainText(...)`.

**Debounce Shield Reset (Test 9):** The `syncPendingData` 15-second debounce
(`lastSyncExecution`) is a module-level variable reset only on page reload. In
Test 9, when a dirty state reset (stop of a previous zombie timer) fires, Device
A MUST be reloaded before starting the next shared timer. Without this, the new
timer create is silently blocked by the debounce shield, Device B hydrates stale
data from Supabase, and the STOP assertion fails.

```typescript
// After dirty state reset:
await pageA.reload({ waitUntil: "domcontentloaded" });
await waitForHydration(pageA); // Clear debounce clock
```

**Zombie Timer Guard (Tests 4 & 5):** Pre-flight zombie timer cleanup uses
`getByTestId('timer-toggle-button')` (deterministic testid) instead of
`getByRole('button', name: /stop/i)` (fragile, matches other UI). The guard
checks the button's text content and waits for network confirmation before
proceeding offline:

```typescript
const timerToggle = page.getByTestId('timer-toggle-button');
if ((await timerToggle.textContent())?.toUpperCase().includes('STOP')) {
  const zombieSync = page.waitForResponse(...);
  await timerToggle.click();
  await expect(timerToggle).toContainText(/START/i);
  await zombieSync;
}
```

---

## 12. Smart Navigation & Anti-Flicker Architecture

The application employs a ubiquitous mapping pattern where UI entities (like
badged Project names, Phase labels, or External Resources in lists) function as
direct routing triggers.

### 12.1 The See It. Click It. Route It. Pattern

- Elements rendering entities use a strict double-shield event pattern within
  Sortable contexts (`@dnd-kit`): `onPointerDown={(e) => e.stopPropagation()}` +
  `onClick={(e) => handleEntityRouting(e, '/path')}`.
- True Deep Linking: Badges for Resources/Vendors use parameter-based deep links
  (e.g., `?contactId=123`), intercepted by the receiving page (`ContactsPage`)
  which auto-triggers the modal state and immediately scrubs the URL parameter
  to prevent sticky reload triggers.

### 12.2 The Smart Return Journey (Passport & Receiver)

- Origin Passport: Routing events inject `location.pathname + location.search`
  into `state: { from }` using `useNavigate`. This guarantees that active search
  filters or timeline tabs are preserved.
- Smart Receiver: Detail pages (`ProjectDetailsPage`, `ClientDetailsPage`,
  `SupplierDetailsPage`) read this `origin` state.
- Hard Bypass Fallback: If `origin` is completely absent, the receiver utilizes
  `window.history.back()` to escape polluted React Router histories visually.
- To prevent Flash-on-Match (where navigating to an exact URL creates an
  intermediate flicker), the receiving `handleBack` strictly sanitizes the
  returning URL by systematically removing trailing slashes from the target root
  before injecting `replace: true`.

### 12.3 The Dexie Cache Anti-Flicker Singleton (`trackerCache.ts`)

When navigating deeply into a detail view and returning to `TimeTrackerPage`,
the host component natively unmounts. Dexie yields `undefined` for ~50ms during
asynchronous querying upon remount, generating a flash of an empty array (`[]`)
before the list repopulates. To eradicate this, a lightweight, module-level
singleton (`getTrackerCache`, `setTrackerCache`) lives physically outside the
React DOM lifecycle. The `useLiveQuery` inside `useTracker` directly proxies
this getter when returning `"undefined"`. Upon resolution, Dexie writes its
payload to the singleton before mapping the React `useMemo`, ensuring a visually
bulletproof 0-millisecond DOM render during heavy routing cascades.

---

## 13. Advanced Business Integrity & "God Transformer" Pipelines

The application deploys several high-level business logic pipelines that
autonomously bridge entities (The "God Transformers") and aggregate complex
financial data, preventing the user from performing manual double-entry.

### 13.1 Context Isolation (The WORK vs PERSONAL Paradigm)

The entire architectural space is physically bifurcated into two mutually
exclusive environments: **WORK** and **PERSONAL**. This is not merely a UI
filter, but a deep mathematical segregation enforced across nearly every Dexie
query (`is_personal: boolean` cascading inheritance). Entities, projects, notes,
and tracks created in the WORK domain are strictly isolated from the PERSONAL
view, granting users two completely discrete CRM spaces running seamlessly in
parallel within the same database instance.

### 13.2 The "God Transformers" (Automated Entity Bridging)

To eradicate administrative friction, the system employs reactive
state-transformers that elevate records across the business lifecycle:

- **Deals ➜ Projects (The Sales Bridge):** When a Deal is dragged to the
  terminal `WON` stage in the Kanban board, the system invokes a
  `ProjectCreated` interceptor. It instantly bridges the financial value
  (`amount`), the `client_id`, and the title into a fully-fledged pre-compiled
  `Project`, automatically archiving the source Deal.
- **Meetings ➜ Tracks (The Operational Bridge):** As detailed in Section 4.4,
  transitioning a scheduled `Meeting` note to `DONE` autonomously generates a
  billable `TimeEntry`, applying the correct duration, linking the original
  attendees, and archiving the meeting artifact.

### 13.3 Global Alert Intelligence & Auto-Resolution

The CRM doesn't just display anomalies; it engineers their resolution. The
Anomaly Engine flags `budgetOverruns`, `overdue` items, and `inconsistent`
temporal tracks (e.g., hours logged outside a Project's legal date bounds).

- **Auto-Fix/Manual-Fix Engine:** Both the `ActionCenterModal` and the
  `TimelinePage` expose one-click resolution vectors. Safe anomalies offer an
  instant "Auto-Fix" (e.g., mathematically snapping a stray track back into the
  legal project boundaries). Complex anomalies offer a direct "Manual Fix"
  deep-link, routing the user to the exact modal in Zen Mode to resolve the
  conflict instantly.

### 13.4 The Dynamic Segmented Timeline

The `TimelinePage` is not a flat Gantt chart. It is deeply relational:

- **Phase-Linked Tracking:** `time_entries` and `notes` hold strict foreign keys
  linking them to specific `project_phases`.
- **Dynamic Rendering:** The timeline horizontally segments actual execution
  (tracks) strictly against their assigned phases, producing a live, modular
  visualization of estimated vs. actual execution per phase, not just per
  project.

### 13.5 Vendor & Resource Management

A robust 3rd-party supplier architecture (`suppliers` / `external_resources`)
allows the agency to profile external consultants and link them directly to
tracks and expenses. This enables real-time tracking of outsourced costs against
the global project budget and exposes deep analytical insights into contractor
ROI.

### 13.6 Aggregated Lists & Calendars (Time & Money)

All List views and the Calendar Hub utilize a unified ingestion protocol capable
of simultaneously parsing both execution time (tracked hours/minutes) and
financial flow (cashflow IN from billables vs. cashflow OUT from expenses). The
engine yields totalized summaries per day, week, and project, continuously
calculating the pure margin without requiring manual spreadsheet exports.

### 13.7 Omnivorous Global Search (Command Palette)

The system features an Omnivorous Global Search Command Palette (accessible via `Cmd+K` or the UI), providing instant, cross-entity discovery.
- **Deep Content Indexing:** Searches not just titles, but parses the serialized JSON structures of Tiptap notes, deals, clients, and projects, ensuring that no metric or internal text escapes discovery.
- **Native Contextual Highlight:** Selecting a search result routes the user directly to the deep-linked modal entity. Upon render, a Fast-Polling Engine (100ms interval) intercepts the DOM via native `window.find()`, explicitly highlighting the matched text and autonomously centering the user's viewport on the exact occurrence, bypassing heavy Tiptap extensions for maximum performance.

### 13.8 Tiptap In-Editor Find & Replace

- **Architecture:** Native ProseMirror Extension (`SearchAndReplace.ts`), bypassing paid Tiptap Pro tiers.
- **State Isolation:** Search UI state (`searchTerm`, `currentIndex`) is maintained strictly within an independent `SearchToolbar` sub-component. It hooks into the ProseMirror `transaction` event loop to synchronize the match count without triggering devastating re-renders of the heavy `<TiptapEditor/>` parent component.
- **The Mermaid Shield:** To prevent AST corruption during "Replace All" routines, the node-traversal algorithm strictly resolves the `pos` depth. Text nodes wrapped inside a `codeBlock` where `language === 'mermaid'` are mathematically bypassed and ignored by the Regex scanner.
- **Scroll Engine:** Employs a robust imperative DOM `.scrollIntoView` listener targeting the active `.search-result-current` decoration, overcoming ProseMirror's native viewport limitations within custom flexbox containers.
- **Interception:** Captures `Cmd+F` exclusively when the editor or its `.tiptap-wolf-wrapper` is actively focused, deferring to the browser's native search otherwise.

---

## 14. Enterprise-Grade Security & Data Vault Architecture

### 14.1 Row-Level Security (RLS) Perimeter

Data privacy and multi-tenant isolation are fundamentally enforced at the
database layer, not just the UI layer. Every table in the remote Supabase
PostgreSQL schema is fortified with absolute Row-Level Security (RLS) policies.
Queries and remote mutations are cryptographically gated by the authenticated
`auth.uid()`. This provides a mathematical guarantee that no user can intercept,
read, or alter another account's data, regardless of API manipulation attempts.

### 14.2 TLS Payload Encryption

All remote operations—including the background network syncs dispatched by the
`SyncOrchestrator` and the high-frequency Realtime WebSocket broadcasts—are
strictly transmitted over end-to-end TLS encryption. The application connects
exclusively via secure `HTTPS` and `WSS` protocols, protecting payloads against
transit interception.

### 14.3 Defense in Depth (Contextual Containment)

The system's data isolation operates on a "defense in depth" matrix:

1. **Server Horizon:** Absolute RLS policies (impenetrable cross-tenant
   boundary).
2. **Network Horizon:** TLS Payload Encryption (protecting data in transit).
3. **Local Architecture:** The offline-first IndexedDB (`db.ts`) mathematically
   enforces the `is_personal` context separation. This Local Vault mechanism
   strictly segregates "Work" enterprise data from "Personal" private logs
   within the same authenticated session, guaranteeing total NDAs compliance
   even when working completely offline.

---

## 15. Serverless Kiosk Ingestion Architecture

### 15.1 The Freemium Door (Isolating the DOM)

The Kiosk system (`/kiosk-demo` and `/kiosk/:logId`) is a dedicated
touch-friendly React route specifically engineered to bypass the top-level
`<AuthProvider>` completely. It operates directly under `BrowserRouter` on a
pristine Full Screen canvas, explicitly allowing public-facing metric data
collection without triggering session hydration or authentication loops.

### 15.2 The Edge Function Payload Bridge (`ingest-log`)

Metrics captured locally by the Kiosk are transmitted directly to a standalone
Supabase Edge Function (`ingest-log`) using Deno.

- **Deno 2 Runtime:** Both Edge Functions (`ingest-log`, `get-kiosk-config`) use
  `Deno.serve()` (the Deno 2 built-in entry point). The legacy `serve()` from
  `std/http/server.ts` is explicitly absent — importing it causes a hard boot
  crash on the Deno 2.1+ runtime Supabase enforces. The `std/` entry in
  `deno.json` has been removed accordingly.
- **JWT Bypass:** The Edge Function runs with `verify_jwt = false` (declared in
  `config.toml`) to serve unauthenticated Kiosk terminal clients without
  requiring a session token.
- **Dynamic Ownership Lookup (Agnostic Architecture):** Upon receiving a
  payload, the function uses `parent_log_id` as a cryptographic anchor to
  perform a DB lookup against the `notes` table (`archetype = 'log'`,
  `is_deleted = false`). The `user_id` and `organization_id` of the matching
  parent log are derived dynamically. This eliminates all hardcoded environment
  secret dependencies (`KIOSK_USER_ID`, `KIOSK_ORG_ID`) and makes the system
  fully multi-tenant agnostic.
- **Security Gates:** The `archetype = 'log'` filter prevents cross-entity
  injection attacks. The `is_deleted = false` filter blocks tombstoned parent
  reuse. UUIDv4 entropy (2¹²²) makes the `parent_log_id` statistically
  unguessable.
- **Service Role Escalation:** The Deno script instantiates a Supabase client
  using the `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS for both the ownership
  lookup and the final `INSERT` into `notes`.
- **Dynamic Polymorphism:** The injected payload uses `archetype: 'log'`,
  `behavior_class: 'METRIC'`. The entire `metrics` data structure is passed
  verbatim into `metadata.log_metrics` JSONB, keeping the backend agnostic to
  any future metric schema changes.

### 15.3 The QR Telemetry Portal

To eliminate mobile navigation friction and immediately bridge desktop instances
to mobile collectors, `LogMetricsEditor.tsx` encapsulates a `KioskQR` portal
component. Using a lightweight integration with `api.qrserver.com`, it
dynamically paints the active target URL into a dense QR grid on-demand. This
zero-dependency architecture prevents any upstream NPM bloat onto the primary
application bundle. The `KioskQR` modal also exposes two last-mile distribution
actions:

- **Copy Link:** One-click `navigator.clipboard` copy of the Kiosk URL with a
  2-second `"Copied!"` transient confirmation state.
- **WhatsApp Share:** A `https://wa.me/?text=` deep-link pre-populating the
  Kiosk URL — the primary sharing channel for field teams and sub-contractors on
  mobile.

### 15.4 Metric Rendering Parity

The Kiosk dynamic UI explicitly sorts the iterated metric objects according to
the parent CRM's positional index mapped in `metadata.kiosk.fields`. This
strictly ensures 1:1 visual parity with the drag-and-drop structural layout
defined in the `LogMetricsEditor`, regardless of the underlying JSON object
iteration sequence.

### 15.5 Legacy Execution Environments

To prevent critical parsing failures (JS crashes and blank screens) on older
mobile browser engines (e.g., legacy iOS 12 WebKit on older iPads/iPhones), the
Vite Bundler explicitly configures a strict `target: 'es2015'` build output
boundary.

### 4.8 The Dynamic Log Tracker (Macro/Micro Architecture)

The Log Tracker (`LogTrackerView.tsx`) introduces a high-density measurement
capture layer for custom metrics defined through a JSON `kiosk` payload.

1. **Child-Log Inheritance:** Measurement values are saved as independent `note`
   entities with `archetype: 'log'`. They are relationship-bound to the parent
   tracker template via `metadata.parent_log_id`.
2. **Multi-Tier Visualization Engine:**
   - **Macro View:** A unified global `<ComposedChart>` overlays all active
     metrics simultaneously. Numeric metrics render as `<Line yAxisId="left">`.
     To prevent unreadable text overlap on dense mobile graphs, numeric labels
     employ a "Start & End" strategy via a custom `<LabelList>` SVG text
     renderer, rendering metric abbreviations ONLY on the first and last data
     points (`index === 0 || index === chartData.length - 1`). Boolean metrics
     render as semi-transparent
     `<Bar yAxisId="bool" fillOpacity={0.25} barSize={14}>` on a hidden
     secondary Y-axis with `domain={[0, 4]}`, capping boolean bars at 25% of
     chart height as non-obtrusive "state marker" bands.
   - **Micro View:** An independent grid of KPI cards (1 per metric). Each card
     features a localized chart. Boolean micro-cards always render as a
     `<BarChart domain={[0, 1.33]}>` which positions `TRUE=1` at ~75% of card
     height with `fillOpacity={0.35}`. The KPI summary value for boolean metrics
     displays a `trueCount/totalCount` ratio (e.g., `"3/5"`) computed by
     iterating all `childLogs` — transforming the card into a habit adherence
     tracker.
3. **Boolean Smart Coercer:** All boolean metric values are coerced in the
   `chartData` payload loop: `true / "yes" / "si / yes" / "si" → 1`,
   `false / "no" → 0`, missing → `null`. Raw DB values are never mutated.
4. **Boolean Color Isolation:** Boolean metrics are assigned a fixed `#38bdf8`
   (Sky-400) color. A dedicated `numericIndex` counter prevents booleans from
   consuming numeric palette slots, ensuring consistent color assignment for
   numeric metrics regardless of field ordering.
5. **True Logical DOM Unmounts:** To prevent SVG dimension calculation anomalies
   (`0x0` dimensions on mobile), the component implements strict contextual
   unmounting. A structural `isDesktop` sensor paired with the mobile Accordion
   state dynamically detaches the Recharts instances from the Virtual DOM
   entirely when collapsed, bypassing CSS `display: none` layout bugs
   completely.
6. **Immediate Sync Bypass:** `syncPendingData()` is executed synchronously
   following any database `put/update` resolving the 11-second debounce queue
   lock and immediately transmitting the created telemetry to the network.
7. **Measurement Interpolation:** During chart rendering, missing metric values
   within a timeline are explicitly mapped to `null` instead of coercive `0`
   drops. This enables the Recharts engine (`connectNulls={true}`) to
   interpolate and draw continuous trend lines bridging across days with
   incomplete telemetry, preserving accurate visual trend analysis.

## 16. Financial ROI & Tracker Architecture

The system employs a strict 4-tier ROI evaluation hierarchy in `useTracker` to
map logged time into analytical buckets:

1. **Vendor (OUT):** Top priority. If an entry has a linked `supplier_id`, it is
   an outsourced cost. Excluded from internal productivity metrics, but tracked
   in global totals to visualize gray space in progress bars.
2. **Internal (INTERNAL):** If an entry is linked to an internal company client
   (e.g. "Internal / R&D"), it is classified as internal investment, regardless
   of project state.
3. **Personal (PERSONAL):** Derived from `is_personal` flags on the entry,
   project, or client.
4. **Value (IN):** Default fallback. Linked to an external client/project,
   representing billable value. Dashboard global KPIs (`GlobalTrackingKPI`)
   strictly rely on this 4-tier logic to populate the "Value" (green),
   "Internal" (purple), and "Noise" metrics without overlap.

### 10.4 Atomic A->B Transitions (React-Bypass Protocol)

When performing A->B transitions (e.g. stopping an active timer and immediately
starting a new one via "Resume" or in `TimeEntryModal`), the application
mathematically bypasses the React-bound `TimerContext` methods (`start()`,
`stop()`) to avoid stale state closures and triggering `GUARD 0` false
positives. Instead, the transition is executed as a single, synchronous Dexie
transaction (`db.transaction('rw', db.timeEntries, async () => { ... })`).
Within this transaction, active timers are natively queried and stopped, and the
new clone is inserted simultaneously. A final `syncPendingData()` and query
cache invalidation then trigger a clean, race-condition-free UI update.

## 17. Thoughts Domain: Dynamic Currency Normalization

All hierarchical aggregations (`useListTree`) and localized rollups
(`NoteGroup`) implement on-the-fly currency conversion via `useExchangeRates`.
When summarizing notes of the `expense` archetype, the engine reads the
individual `financial_currency` of each note, converts it in real-time to the
user's global `currency` setting (e.g., from `USD` to `EUR`), and then
mathematically aggregates the normalized values. This ensures that
cross-currency totals inside the nested `note_lists` tree remain financially
accurate and are always displayed in the user's base currency.

## 18. Thoughts Domain: 1:1 UI-State Parity Injection

The `useListTree` aggregation engine relies on a strictly decoupled database
fetch architecture to build the hierarchical node tree and calculate rollups
(financial amounts, note counts, task counts). However, to prevent mathematical
discrepancies between the rollups displayed on the folder badges and the actual
notes rendered inside those folders (which are subjected to complex,
context-specific UI filters like "Tasks Only", "Urgent Only", or "Exclude
Projects"), the architecture implements a **1:1 UI-State Parity Injection**.
Instead of running a standalone Dexie query, the parent UI components
(`ThoughtsPage` and `TasksPage`) dynamically inject their own already-filtered,
localized arrays (`customNotes` and `customLists`) directly into `useListTree`.
This completely overrides the hook's internal database query mechanism,
guaranteeing that the mathematical rollups are perfectly synchronized with the
exact visible state of the UI at any given frame.

## 19. Financial Cashflow Mathematical Engine (The Tri-State Paradigm)

The synchronization between UI input (`is_billable` toggle) and aggregate math (`expenseIn`, `expenseOut`, `recordPulse`) enforces a strict, context-aware directionality protocol for financial notes (expenses) to accurately map to the user's macro business model:

1. **B2C / Personal Finance (`is_personal = true`):**
   - **Math:** Bypasses the "Client" requirement. Cashflow direction is strictly determined by the toggle.
   - **UI:** The toggle dynamically renders as "Income / In" (Entrata). Active = Positive Cashflow (Revenue/Salary). Inactive = Negative Cashflow (Expense).
2. **B2B Client Projects (`is_personal = false` AND `client_id` exists):**
   - **Math:** Cashflow direction is controlled by the toggle.
   - **UI:** The toggle renders as "Billable / Revenue". Active = Positive Cashflow (Revenue/Advance/Invoiced). Inactive = Negative Cashflow (Internal Cost incurred on the project).
3. **B2B Vendor/Internal Projects (`is_personal = false` AND `client_id` IS NULL):**
   - **Math:** HARD-LOCKED to Negative Cashflow. The toggle state is mathematically ignored (`hasClient = false`), forcing a strict `-absAmount` to prevent accidental revenue generation on cost-centers.
   - **UI:** The toggle renders as "Vendor Advance / Paid" to accurately reflect tracking state, without altering the rigid OUT math.

## 20. Transformer Domain: Entity Migration Targeting

The `TransformerModal` implements strict type-targeting during entity migration (e.g., `moveToProject`). It explicitly differentiates between moving an entity to a `phase` versus a `list`, ensuring that the correct database foreign key (`phase_id` or `list_id`) is updated while mutually clearing the other. To accurately reflect project structures, the modal constructs a flat recursive tree (`buildFlatTree`) based on `parent_list_id`, injecting a mathematical `depth` property that allows the UI to render nested lists with proportional visual indentation (`marginLeft`) while remaining functionally flat.

## 21. Global Rename Propagation (JSON AST)
To maintain data integrity without forcing costly schema migrations, the system implements an AST-based `PropagationService`. When core entities (Projects, Clients, Suppliers, Contacts) are renamed, the service utilizes a fast "Pre-filter Pattern" (`JSON.stringify(content).includes(id)`) to isolate affected `time_entries` and `notes`. It then recursively traverses the Tiptap JSON AST, updating the `attrs.label` property of embedded entity mentions. All modified records are flagged with `syncStatus: 'pending_update'` for asynchronous dispatch via the Orchestrator, guaranteeing that denormalized rich-text documents instantly reflect architectural entity changes.

## 22. Smart Scroll Anchoring & Navigation
To prevent UX context loss when returning from modal editors, the UI implements a dual-layer preservation strategy:
1. **Query State Preservation**: When clearing transient URL parameters (e.g., `?contactId=123`), the `setSearchParams` hook strictly inherits and preserves the existing `location.state`, preventing the loss of the original origin route.
2. **Hash Anchoring**: Routing commands triggered from deeply nested lists (like `TimeEntryItem`) append the item's exact ID as a hash fragment (`#entry-{id}`). Upon return, an intercepting `useEffect` detects the hash, delays 300ms for DOM rendering, and automatically triggers `scrollIntoView` while temporarily highlighting the item with an indigo ring, instantly returning the user to their exact previous viewport context.

## 23. Cross-Page Archetype Routing Bridge

The filter panels on the Thoughts and Tasks pages implement a dual-behavior routing system. Primary-context archetypes (Thoughts in `NoteFilterPanel`, Tasks in `TaskFilterPanel`) apply local state filters. Secondary-context archetypes trigger React Router navigation to the opposing page, passing the selected archetype as a `?archetype=<value>` query parameter.

**Receiver initialization (`useThoughts` hook):** Upon mount, `useSearchParams` reads the `archetype` parameter and initializes `selectedArchetypes` state with that value. A secondary `useEffect` keeps the state synchronized if the parameter changes while the component is mounted.

**Project Hub cross-tab navigation:** Inside a Project detail view, `ProjectTasksTab.tsx` and `ProjectNotes.tsx` accept an `onTabChange: (tabId: ProjectTab) => void` callback from `ProjectDetailsPage.tsx`. When the user clicks a secondary-context archetype badge, this callback fires `handleTabChange('notes')` or `handleTabChange('tasks')`, switching the internal project tab without a full page reload. The callback propagates through `NotesManager.tsx` (via `onNavigateToTasks` prop) to `NoteFilterPanel`.

**NotesManager Archetype Filter Fixes (v0.7.157):**

1. **Frozen-Snapshot Bug Fix:** The archetype filter was previously applied inside the `useLiveQuery` callback (DB layer). Because `liveNotes` flows into `frozenNotes` via `useEffect` hooks that block updates during modal-open or drag states, filter changes were silently swallowed. The fix moves `selectedArchetypes` filtering into the `activeNotesForRender` `useMemo`, which reads state directly and recomputes synchronously.
2. **Recursive Subtree Visibility:** When a filter is active, a `countNotesInSubtree` recursive function checks if a root folder (or any of its descendants) contains at least one matching note before rendering the folder row. Empty folder hierarchies are hidden completely.
3. **Auto-Expand Ancestor Chain:** A dedicated `useEffect` watches `selectedArchetypes` and `activeNotesForRender`. For every note that matches the filter, it traverses the `parent_list_id` chain using a pre-built lookup map, collecting both the direct list ID and all ancestor list IDs. The entire ancestor chain is then set to `true` in `expandedLists`, ensuring child folders are rendered and visible even when their parents were previously collapsed. When the filter is cleared, `setExpandedLists({})` resets all folders to their default collapsed state.
