# 🐺 tAImetrack — Functional Specifications (FEATURES.md)
**Version:** v0.7.167 - 2026-05-02
**Status:** Present-Only Functional Specification. Describes only what is compiled and active today.

---

## 0. 🌐 The Core Paradigm: Context Isolation

The entire platform is built upon a mathematically enforced boundary: **WORK vs PERSONAL**. 
Every single entity—notes, lists, projects, time entries, clients, and suppliers—belongs to one of these two operational contexts. This is not merely a UI visual filter, but a deep database separation. Users essentially possess two fully discrete CRMs operating in parallel within the same interface, ensuring that private life tasks and personal financial data never bleed into enterprise tracking, or vice versa.

---

## 1. 🧠 The Note-Centric Engine (Thoughts & Tasks)

Every piece of work, idea, or event in tAImetrack originates as a **note** in the database. This single engine powers two distinct user-facing experiences: **Thoughts** (informational entries, `/thoughts`) and **Tasks** (actionable entries, `/tasks`). The technical `notes` table is never exposed to the user.

### 1.1 The 8 Archetypes (The FAST Model)

Each note is assigned one of 8 archetypes at creation. The archetype determines which UI surface it appears in, how it is styled, and what metadata fields are available.

| Archetype | UI Surface | Behavior Class | Description |
|---|---|---|---|
| `note` | Thoughts | DESCRIPTIVE | A freeform written observation or memo |
| `idea` | Thoughts | DESCRIPTIVE | A brainstorm or concept to be developed |
| `meeting` | Thoughts | EVENT | A scheduled event with start/end times and duration |
| `journal` | Thoughts | DESCRIPTIVE | A personal, date-stamped diary entry |
| `expense` | Thoughts & Tasks | FINANCIAL | A financial cost record with amount, category, and payment method |
| `todo` | Tasks | ACTIONABLE | A discrete, completable action item |
| `reminder` | Tasks | REMINDER | A time-sensitive prompt with a due date |
| `bug` | Tasks | ISSUE | A technical defect or system problem to be resolved |

> **Future Evolution:** The taxonomy of these 8 archetypes is engineered parametrically. While formally established today, the underlying FAST model is explicitly structured to allow users to create entirely custom archetypes and define their distinct behavior classes natively in the future.

### 1.2 Infinite Nested Lists (The Fluid Hierarchy)

Notes can be organized into **Custom Lists** (backed by the `note_lists` table), which act as structural folders. A list belongs to either the Work or Personal workspace (`type: 'personal' | 'team'`). Moving an entire list to a different workspace migrates all its contained notes simultaneously.

The architecture features a **Fluid Nested Hierarchy**:
- **Infinite Nesting & Drag-and-Drop:** Lists can be dragged inside other lists to create a multi-level tree hierarchy. Thoughts and Tasks can be freely dragged across different lists and different nesting depths.
- **Dynamic Financial Aggregation:** The tree architecture features a bottom-up rollup engine (`useListTree`). If child lists contain financial expenses (e.g., in USD or GBP), the hierarchy automatically extracts those values, converts them on the fly to the user's global base currency using live exchange rates (`useExchangeRates`), and bubbles the mathematically accurate total up to the parent folders.
- **Contextual Path Resolution:** Moving items via modal dropdowns displays a clear, indented visual tree (e.g., `in Parent List`) preventing ambiguity among identically named child lists.
- **Smart Deletion Modal:** Deleting a list counts its internal tasks. If empty, it bypasses warnings for a clean deletion. If populated, it offers two choices: discard the list but keep its notes (unlinked), or delete the list and all its contents permanently.
### 1.3 🤖 Automation: Meeting-to-Track Transmutation

This is the primary automated workflow of the engine.

**Trigger:** The user opens a `meeting` archetype note and sets its status to `done` for the first time.

**What happens automatically:**

1. The system checks whether a time track already exists linked to this meeting (`db.timeEntries.where('note_id').equals(id)`). If one exists, the process is skipped (idempotent).
2. The duration is calculated from `metadata.event_start` and `metadata.event_end`. If these fields are absent, it defaults to 60 minutes.
3. A new **Time Track** record is created with:
   - The meeting's title as the description.
   - The meeting's linked project, client, and supplier carried over.
   - `note_id` set to the source meeting (permanent relational link).
   - `is_done: true` and `is_running: false`.
   - `syncStatus: 'pending_create'` — queued for background sync to Supabase.
4. The meeting note is simultaneously **auto-archived** (`is_archived: true`), removing it from the active view.
5. Both records sync to the server asynchronously, without blocking the UI.

**Result:** The meeting appears as a billable time track in the tracker and calendar, creating an audit trail from event to invoice.

### 1.4 Transformation Lifecycle (The Transformer)

From any note or thought, the **Transformer** modal allows one-click promotion:

- **Promote to Project:** Uses the note's title and content as seeds for a new project record.
- **Promote to Client:** Bootstraps a new client entity from the note's title.
- **Move to Project:** Routes a thought into a specific project (and optionally into a phase or list within that project).
- **Promote to Phase:** Converts a note into a new project phase directly.
- **Archetype Switching:** Change the archetype of any entry (e.g., convert an `idea` into a `todo`) while preserving all content and relational links.

### 1.5 Universal Search & Filtering

- **Omnivorous Command Palette (`Cmd+K`):** A globally accessible search engine that provides instant, cross-entity discovery across Thoughts, Tasks, Deals, Projects, and Clients. It parses deeply into the serialized JSON structures of Tiptap notes, ensuring even hidden texts and nested metrics are discoverable.
- **Native Contextual Highlight:** Selecting a search result deep-links the user to the entity modal, utilizing a fast-polling engine to intercept the native DOM `window.find()` API. This explicitly highlights the matched text and autonomously centers the viewport on the exact occurrence.
- **Filters:** Archetype filter buttons to isolate specific note types, and Active / Archived view toggles.
- **Pinning & Sorting:** Any note can be pinned to the top of its list. Sort order respects pin status → manual `sort_order` → creation date.

### 1.6 Rich Formatting & Export

- The TipTap editor supports bold, italic, headings, bullet lists, numbered lists, checklists (task lists), blockquotes, and text alignment.
- **In-Editor Find & Replace (`Cmd+F`):** A fully isolated, high-performance search and replace engine natively integrated into the editor. It supports "Replace" and "Replace All" routines, dynamically scrolling the viewport to the active match while mathematically bypassing and protecting Mermaid AST code blocks from syntax corruption.
- **Pro Export Engine:** Any note can be exported as `.md` (Markdown), `.txt` (Plain Text), `.rtf` (Rich Text), or `.html` with relational sub-notes and tasks included.

---

## 2. 📈 Deals & Sales Pipeline

### 2.1 Kanban Pipeline Board

The Deals pipeline (`/deals`) presents all active sales opportunities as a **drag-and-drop Kanban board**. Each column represents a custom Deal Stage (e.g., Lead, Proposal, Negotiation, Won, Lost).

- Stages are user-created and color-coded with three structural archetypes: `open`, `won`, `lost`.
- Cards display the deal name, value (formatted in the user's currency), associated client, close date, and pipeline stage.
- Cards can be dragged between columns. Position within a column is preserved via `sort_order` integers.
- All reorders and stage changes are written to Dexie instantly and sync to Supabase in the background.

### 2.2 Deal Cards & Editing

- Clicking a card opens an inline editor for title, value, close date, linked client, linked project, description, and custom notes.
- Deals can be filtered by workspace context (Work / Personal).

### 2.3 🤖 Automation: Deal-to-Project Conversion

**Trigger:** A deal is moved to a stage with the `won` archetype.

**What happens:**

1. A new **Project** is automatically created, carrying over the deal's name, linked client (`client_id`), and deal value as the project's fixed price.
2. A `ConvertDealModal` appears, presenting three choices:
   - **Accept & Close:** Keep the auto-created project as-is and close the dialog.
   - **Edit Project:** Jump directly into the project editor to refine name, billing model, dates, and team.
   - **Discard:** Remove the auto-created project and keep the deal in its current state.
3. The deal and project are permanently linked via `deal.project_id`, creating a bidirectional contextual reference.

**Inverse (Divorce):** If a project linked to a deal needs to be unlinked, a "Divorce" action severs the `project_id` reference from the deal without deleting either entity.

---

## 3. ⏱️ Advanced Time Tracking & Forecasting

### 3.1 Offline-First Persistent Timer

- A **global timer widget** is mounted at the application shell level. It persists across all page navigations without resetting.
- Starting a timer creates a `time_entry` record in Dexie locally with `is_running: true`. The timer UI reads directly from the local record — it never depends on a server round-trip.
- Only one timer can run at a time for the primary user. The system enforces this by querying `is_running` before starting a new track.
- **Relational Depth:** A time track is not an isolated timestamp. It can be deeply linked simultaneously to a Client, a Project, a specific Project Phase, a Supplier (Vendor), or a third-party External Resource, bridging execution metrics precisely to the correct business node.
- **Hot-Edit while running:** The description, current project, and active phase of the running timer can be changed in real time without stopping the clock.

### 3.2 Billability Classification (ROI Engine)

Every time track is automatically classified into one of three business intelligence categories:

| Category | Rule | Color Signal |
|---|---|---|
| **Value** (Billable) | Has project and client, project `is_billable: true` | Emerald |
| **Investment** (Internal R&D) | Has project but no client, or `billing_type: 'internal'` | Indigo/Violet |
| **Noise** (Orphan) | No project and no client | Slate/Amber |

This drives the Dashboard ROI analytics and burn-rate calculations without any manual tagging.

### 3.3 Planned Tracks (Forecasting)

The platform distinguishes between **Actual Tracks** (historical records, `is_done: true` or `null`) and **Planned Tracks** (forecast records, `is_done: false`).

- Users can create a future-dated time entry in the Calendar and set it as "Planned" to represent scheduled or budgeted work.
- The Calendar filter bar exposes two independent toggle buttons — a clock icon for **Actuals** and an hourglass icon for **Forecasts** — mapping to their respective `is_done` states.
- Both buckets are strictly separated in `useCalendarAggregator.ts`, preventing filtering leakage between historical data and future projections.

### 3.4 🔁 RRULE Recurring Tracks (Recurrence Engine)

A time track can be assigned an iCalendar RRULE string (e.g., `FREQ=WEEKLY;BYDAY=MO,WE`) to represent predictable repeating work.

**How it works:**

- The **template row** is a real database record with the `rrule` column set.
- The calendar and tracker views expand this template into **ghost occurrences** — in-memory, virtualized copies for each recurrence within the visible date range. Ghosts have no database row.
- Ghost IDs follow the pattern `${templateId}-ghost-${N}` and are visually indicated in the UI.
- Clicking a ghost opens the original template for editing. Deleting a ghost is blocked (a guard prevents menu actions on ghost items).
- **Ghost Detachment (Exception Fork):** From the `RecurrenceChoiceDialog`, users can branch a single ghost occurrence into an independent real track (full detachment) or inject an `EXDATE` directive into the template to skip that specific occurrence permanently — without altering the rest of the series.

### 3.5 Overlap Validator & Smart Deduplication

The tracker validates time boundaries on each save:

- Overlaps between entries for the **same** actor are flagged visually.
- Overlaps are explicitly **permitted** between entries assigned to different actors (e.g., a Vendor time entry overlapping the user's own timer), reflecting real-world parallel delegation.
- Only one `is_running: true` timer per actor is allowed at any moment.

### 3.6 Time Tracker Page (`/tracker`)

- All time entries are displayed grouped by day in descending chronological order.
- The running timer card shows a live `HH:mm:ss` clock synchronized with the global widget.
- **Quick Actions per entry:** Resume (restart with same description/project), Duplicate (clone the entry), Delete.
- **Bulk Selection Engine:** Multi-select checkboxes trigger a context-aware Floating Action Portal. Enables atomic, transaction-wrapped Dexie batch operations (Smart Project/Phase Linking, Soft Delete) protected by propagation shields.
- **Multi-Select Filter:** Filter the log by workspace context (Work / Personal) and by anomaly type (No Project, No Stakeholder) simultaneously.
- **Stakeholder Picker:** When creating or editing a track, a unified `StakeholderPickerModal` merges Clients and Suppliers/Vendors into one mutually exclusive selection surface to prevent FK collision.

---

## 4. 📂 CRM & Directory Hub

### 4.1 Unified Directory (`/companies`)

The CRM entry point presents **Clients** and **Suppliers (Vendors)** as two tabs within a single tabbed directory hub. Both share a unified visual language but maintain fully separate database queries and CRUD pipelines.

**Omni-Search** across both directories matches against: name, contact person, email, VAT number, and city — using a multi-term AND matrix (entering multiple words narrows results across all fields simultaneously).

### 4.2 Client Profiles & Hub

Each client has a dedicated **Client Hub** at `/clients/:id` with tabbed navigation:

- **Overview:** ROI/Tracking KPI dashboard (Billable vs Noise math), mini-cards, and interactive charts (Activity, Team Pulse, Project Distribution).
- **Projects:** List of all projects linked to this client with status and hours burned.
- **Tracking:** Full time log filtered to this client's work across all projects.
- **Notes:** The client's contextual notes engine (meetings, ideas, documents), persisted via `client_id` on the `notes` table.

**Financial Identity:** Clients with a VAT number are badged as "Business"; those without are badged "No VAT". The `is_personal` flag separates private contacts from organizational clients, enforced throughout all filters.

### 4.3 Vendor (Supplier) Profiles

Each vendor/supplier entry represents a **company** in the B2B supply chain. Vendors can have:
- Their own contact persons (linked via `supplier_contacts` pivot).
- Hourly rates and currency configurations at the company level.
- Notes, tracking logs, and project assignments.

### 4.4 The Neutral Human Paradigm (RROLE Architecture)

The `contacts` table stores neutral human profiles decoupled from any business role. A single human record can simultaneously act as:

- A **client contact** (linked via `contact_roles.related_client_id`)
- A **vendor employee** (linked via `supplier_contacts.supplier_id`)
- A **direct project resource** (linked via `project_contacts.project_id`)

No duplication of the human's core data (name, email, phone, color) is required across these roles. Rate overrides (`hourly_rate`, `currency`) are stored on the specific bridge record, not on the contact itself.

### 4.5 Project Resource Assignment

Inside the Project modal, a unified **Resource Picker** assembles a single pool combining Suppliers (companies) and Contacts (humans). Resources are assigned with:

- An optional per-project `hourly_rate` override.
- A `currency` override.
- The ability for the same contact to appear simultaneously as a Vendor block member **and** as a standalone Freelance assignment on the same project (Double Mapping Architecture), controlled by the `force_standalone` flag.

### 4.6 Semantic Archiving

Both clients and vendors support two distinct removal states:

- **Soft-Delete** (`is_deleted: true`): The record is permanently hidden from all UI queries and marked for remote deletion. Locally hard-deleted from Dexie after Supabase confirmation (Zombie Kill Protocol).
- **Archive** (`status: 'archived'`): The record is hidden from the active directory but remains queryable, accessible via a dedicated "Archived" tab for historical reference or restoration.

---

## 5. 📅 Calendar Hub & Global Timeline

### 5.1 Calendar Hub (`CalendarHub.tsx`)

The Calendar Hub is the central aggregation point for all temporal data across the workspace. It natively unifies five entity types into a single visual stream:

| Entity Type | Source | Calendar Representation |
|---|---|---|
| Time Tracks | `time_entries` (is_done = true/null) | Colored blocks with project/client color |
| Planned Tracks | `time_entries` (is_done = false) | Hourglass-tagged forecast blocks |
| Events (Meetings) | `notes` (archetype: 'meeting') | Event cards with time reference |
| To-Dos | `notes` (archetype: 'todo') | Compact task cards with due date |
| Expenses | `notes` (archetype: 'expense') | Financial cards with amount and category |
| Deals | `deals` (close_date) | Deal cards with value |

### 5.2 Three View Modes

**Month View:**
- Dense grid overview. Each day cell renders compact colored blocks.
- In heavy days, items collapse to ultra-dense colored dots to prevent vertical overflow.
- On mobile (< 768px), the app automatically falls back to Week View to preserve touch usability.

**Week View (Kanban-Style):**
- Seven side-by-side columns auto-sizing to fit their content, no internal scrollbars.
- **Dynamic Edge-Scrolling:** Dragging a card to the left or right boundary of the container triggers automatic week pagination — the calendar advances to the adjacent week without dropping the item.
- Empty columns collapse to save vertical space on mobile.

**Day View:**
- Single-day deep-drill, showing all entities for one specific date in full detail.

### 5.3 Filter Control Bar

The Calendar filter bar is stored in `useCalendarFilterStore` (volatile Zustand state, resets on navigation). Users control:

| Toggle | Filters |
|---|---|
| ✅ ToDos | Shows/hides ACTIONABLE notes with due dates |
| 📅 Events | Shows/hides EVENT archetype notes (meetings) |
| ⏱ Tracks | Shows/hides actual time entries |
| ⌛ Planned | Shows/hides forecast tracks (is_done: false) |
| 💸 Expenses | Shows/hides FINANCIAL archetype notes |
| 🗂 Ribbons | Shows/hides Active Project ribbon under date headers |
| 👁 Noise | Hides completed/archived tasks |
| Work / Personal | Domain context toggles (simultaneous multi-select) |

All toggles are fully independent boolean switches — enabling one does not disable another.

### 5.4 Active Projects Ribbon

Below each day's date header, the calendar renders a dense horizontal ribbon of color-coded slivers representing projects that are **currently active** (their `start_date ≤ day ≤ due_date`). Each sliver is clickable and navigates directly to the **Global Timeline** page for that project.

### 5.5 Calendar Quick Spawn

Clicking any empty day cell opens an action sheet pre-populated with that date as the `spawnDate`. Selecting "New Track," "New Thought," or "New Deal" opens the corresponding creation modal with the clicked date pre-filled. The date is passed via the `useUIStore.spawnDate` Zustand field, which `MainLayout` intercepts and pipes down via `initialDate` props.

### 5.6 Drag & Drop in Calendar

Calendar items (time tracks, tasks, deals, notes) are draggable between day columns:

- Dropping a card on a new date **updates the underlying date field** of that entity in Dexie immediately (optimistic UI), then syncs to Supabase.
- For time entries, the drag mutation preserves the original `HH:mm:ss` time of day; only the date portion shifts.
- A `DragOverlay` with `dropAnimation={null}` is used to prevent elastic rubber-band return animations.
- Duplication: A "Duplicate" quick action clones any calendar item directly into Dexie (including time entries), ready for immediate edit.

### 5.7 Project-Level Calendar

Each Project Hub (`/projects/:id`) includes its own embedded calendar, scoped to that project's tasks, events, tracks, and phases. It uses the same `CalendarHub` logic with a `selectedProjectId` context filter applied. A mobile-exclusive "Expand" button renders the calendar in a fullscreen portal (`z-[10500]`) to break out of the nested Project page shell.

### 5.8 Global Segmented Timeline (`/timeline`)

A dedicated full-width, deeply relational timeline visualizing all active projects and their constituent phases visually.

- **Phase-Linked Dynamic Rendering:** The timeline horizontally segments actual execution (tracks) stringently against their assigned phases, producing a live, modular visualization of estimated vs. actual execution per-phase rather than just per-project.
- Each bar represents a project's lifespan (`start_date` → `due_date`).
- Overdue projects (`status: 'in_progress'` and `due_date` in the past) are dynamically flagged.
- The **GlobalFilterBar** controls the temporal window, workspace context (Work / Personal), and multi-select Client/Project filters.
- Clicking any project bar navigates to that project's detail page (`/projects/:id`).
- Projects missing a unified `start_date` and `due_date` pair are excluded from rendering.

---

## 6. 📊 Business Intelligence Dashboard

### 6.1 Main Dashboard (`/`)

A 70/30 split layout presenting:

- **Top KPI Strip:** Total hours tracked, billable hours, total revenue, and active project count — dynamically recalculating pure margin (Cashflow IN vs Vendor Cashflow OUT) from Dexie based on active global BI filters.
- **ROI Analytics Board:** A donut or line chart classifying tracked execution purely by Value / Investment / Noise.
- **Team Pulse:** Distribution of hours and external expenditure across linked vendors and resources.
- **Project Distribution:** Hours breakdown by project.

### 6.2 Global Filter Bar (Persistent BI Filters)

The `GlobalFilterBar` component is rendered at the top of all major analytical views. Its state is persisted to `localStorage` via the `useGlobalFilters` Zustand store with the key `wolf-global-filters`, surviving browser reloads.

- **Time Range:** Today / This Week / This Month / Year-to-Date / All Time / Custom Range.
- **Custom Range:** Explicit start and end date pickers.
- **Client Multi-Select:** Filter all KPIs by one or more clients (empty = All Clients).
- **Project Multi-Select:** Filter all KPIs by one or more projects (empty = All Projects).
- **Workspace Toggle:** Work / Personal / Internal independent boolean switches.
- **Reset:** One-click restore to default state (Month, Work only, no selections).

### 6.3 Universal Alert Engine

Three anomaly types are tracked reactively across **all non-deleted projects** (regardless of pipeline status):

- **Overrun:** Tracked hours has exceeded the project's `estimated_hours` budget.
- **Overdue:** The project's `due_date` has passed.
- **Inconsistency:** Time entries exist outside the project's declared start/end boundaries.

Alerts are surfaced via the **Dashboard KPI row (`ExecutiveKpiRow`)**: A full-width inline alert banner providing a budget/date anomaly breakdown. Clicking the banner opens the **`ActionCenterModal`**.

The Action Center integrates an **Auto-Fix / Manual-Fix Engine**:
- **Auto-Fix (Safe Heuristics):** One-click resolution for mathematical anomalies (e.g., dynamically snapping isolated tracks back into project boundaries).
- **Manual-Fix (Complex Resolution):** Deep-links routing the user directly into the offending entity's modal (Zen Mode) for architectural correction.

The alert scope is strictly tethered to active projects (`status` implicitly excluding `done` and `archived`), completely respecting the active `useGlobalFilters` workspace domains (`showWork`, `showPersonal`, client matrices).

### 6.3.1 Phase Estimation Engine

Project phases support an `estimated_hours` (numeric, nullable) budget field. The `ProjectTimeline` component renders a dynamic progress bar per phase:
- **Width:** `(trackedHours / estimatedHours) * 100`, capped at `100%`.
- **Overrun visual:** When `trackedHours >= estimatedHours`, the phase derives a 'Done' rendering state (green bar, ✅ icon, strikethrough name) regardless of its stored status.
- **Budget label:** A monospace `"Xh / Yh est."` label is rendered below the bar. Overrun labels render bold red.
- **Data source:** Phase-scoped time entries are pre-fetched once per project (O(N)), not per-phase (no N+1 queries).
- **Time entry phase linking:** `TimeEntryModal` exposes a phase selector (shown when a project with phases is selected). `phase_id` is explicitly mapped in both create and edit payloads and in the sync engine (`syncTimeEntries.ts`).

### 6.4 Activity Chart

A telemetry line chart rendering total tracked duration across the active time range. Multi-colored project dots cluster on the master line, allowing at-a-glance identification of which projects contributed to each time period. On YTD views, the aggregation switches automatically to weekly buckets for readability.

---

## 7. 🌍 Platform & Infrastructure

### 7.1 Offline-First Resilience (Trinity Stack)

The app is built on a three-layer architecture that guarantees zero data loss regardless of network availability:

1. **Local Dexie.js:** Every user action writes to IndexedDB immediately. The UI renders from the local cache — it never waits for the server.
2. **Sync Orchestrator:** A 15-second background metronome queues and dispatches pending records to Supabase in strict topological FK order.
3. **Supabase Realtime:** WebSocket broadcasts propagate server updates to all online devices instantly, applying Last-Write-Wins conflict resolution on the `updated_at` timestamp.

### 7.2 PWA (Progressive Web App)

The application is installable as a PWA on any device. The Workbox service worker handles offline caching of the application shell. All Supabase API traffic bypasses the service worker cache entirely (NetworkOnly strategy), preventing stale API responses.

### 7.3 Multi-Language Support

The entire UI is internationalized via `i18next`. 12 locale files are active. All user-facing strings are keyed (no hardcoded text in components). The user's language preference is stored in `user_settings` and synced across devices.

### 7.4 User Settings (Persisted & Synced)

Via the Settings modal, users configure:
- **Theme:** Light / Dark / System.
- **Language:** Any of the 12 supported locales.
- **Currency:** Default display currency.
- **Week Start Day:** Sunday (0), Monday (1), or Saturday (6) — applied across all calendar calculations.
- **Sidebar state:** Expanded or collapsed.
- **Navigation favorites:** Pinned sidebar shortcuts.

Settings are stored in the `user_settings` Dexie table and synced to Supabase as any other entity, with full offline support and LWW conflict resolution.

### 7.5 Nuclear Reset (NukeButton)

A fail-safe component accessible from the Settings modal named "Reset" provides absolute local state wipe:

1. Deletes the entire Dexie IndexedDB instance.
2. Unregisters all active Service Workers.
3. Clears `localStorage`.
4. Reloads the application DOM context.

This resolves catastrophic states (cache corruption, 409 key collisions, IDB lock hangs) without requiring a browser reinstall.

### 7.6 Global Multi-Currency Engine

The core financial architecture supports native multi-currency definition at granular layers, ensuring enterprise mobility across global borders:
- **Base Default:** The user defines a master workspace currency via Settings.
- **Resource/Vendor Level:** External contractors and suppliers can dictate their specific local currency for their precise hourly rates.
- **Project Level:** A discrete currency override allows tracking and billing the entire project lifecycle matching the client's localized financial domain.
- **Expense Level:** One-off travel or operational expenses can log discrete monetary amounts in the exact purchasing currency.

### 7.7 Enterprise-Grade Security & RLS

Data privacy and multi-tenant isolation are strictly enforced via the PostgreSQL architecture:
- **Row-Level Security (RLS):** Every table in the Supabase schema is fortified with absolute RLS policies. Queries are cryptographically gated by the authenticated `auth.uid()`, mathematically guaranteeing that no user can intercept, read, or mutate another account's data.
- **Payload Encryption:** All remote operations, including Trinity Stack orchestrations and Realtime WebSocket broadcasts, are protected by end-to-end TLS encryption.
- **Contextual Containment:** The local IndexedDB enforces strict `is_personal` context separation, functioning seamlessly alongside the impenetrable server-side RLS perimeter.

---

## 8. 📱 Kiosk Public Ingestion System

### 8.1 The Freemium Collection Door
The CRM includes a public-facing, isolated routing endpoint (`/kiosk-demo`) designed for rapid, unauthenticated data ingestion from shared mobile devices (e.g., entering health metrics, time logs, or expenses on the go). 
- **DOM Isolation:** This route operates completely outside the `AuthenticatedApp` tree, removing the `MainLayout` shell and immediately booting into a touch-friendly, high-contrast PWA interface.

### 8.2 Security & Transmutation Pipeline
- **Zero-Friction Ingestion:** Instead of traditional session logins or PIN barriers, the Kiosk is optimized for rapid, frictionless data capture.
- **Dynamic Serverless Pipeline:** Operations are strictly delegated to Deno-based Supabase Edge Functions. `get-kiosk-config` dynamically fetches the UI template (title, schema variables) from the parent Log metadata using the requested `logId`.
- **Relational Resilience:** The `ingest-log` Edge Function elevates to Service Role to bypass RLS, packing incoming Kiosk telemetry into a CRM-compliant `notes` record (`archetype: 'log'`). To prevent rigid schema violations, relational anchors (like `parent_log_id`) are injected directly into the JSONB metadata rather than physical foreign key columns.
- **Seamless CRM Arrival:** The logged data emerges instantaneously across all active CRM sessions via Realtime WebSocket syncs, rendering natively within the Project Timeline and Thoughts flow.

### 8.3 On-Demand Deployment
To deploy a Kiosk instance instantaneously, any authenticated desktop user can trigger the **[KIOSK]** beacon located in the `LogMetricsEditor`. This generates a native UI Portal rendering an immediate QR Code targeted to their exact domain, allowing any secondary mobile device to immediately snap and become an active collection terminal.

### 8.4 The Dynamic Log Tracker (Visual Analytics Engine)
To visualize the arbitrary telemetry ingested via the Kiosk, the platform provides a dedicated, high-density measurement capture layer:
- **Macro View (Measurement Trends):** A unified global overlay plotting multiple metrics concurrently on a shared Recharts SVG canvas, enabling instant correlation analysis (e.g., comparing differing blood pressure variables against heart rate over time).
- **Micro View (KPI Cards):** Individual metrics are broken down into independent KPI cards, allowing the user to instantly toggle between Line, Bar, and Pie distributions for each specific measurement.
- **Contextual Unmounting:** To prevent standard responsive SVG zero-dimension bugs occurring on mobile devices, the charts dynamically detach from the Virtual DOM entirely when collapsed.