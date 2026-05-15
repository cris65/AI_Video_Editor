# 🐺 tAImetrack — Codebase Structure & Logistics Map (STRUCTURE.md)
**Version:** v0.7.156 - 2026-04-29
**Status:** Present-Only Spatial Map. Describes only what is physically present today.

---

## 1. 🌳 Visual Source Tree (`frontend/src`)

```
src/
├── App.tsx                         # Root: provider stack + router
├── App.css                         # Global animation keyframes
├── main.tsx                        # Vite entry point (ReactDOM.render)
├── index.css                       # Tailwind base + custom scrollbar
├── i18n.ts                         # i18next bootstrap (12 locales)
├── vite-env.d.ts                   # Vite ambient type declarations
│
├── auth/                           # Authentication boundary
│   ├── AuthProvider.tsx
│   ├── LoginComponent.tsx
│   ├── LogoutButton.tsx
│   ├── authContext.ts
│   └── useAuth.ts
│
├── context/                        # Long-lived ambient state (React Context)
│   └── TimerContext.tsx            # Global active-timer state machine
│
├── store/                          # Zustand global state slices
│   ├── useCalendarFilterStore.ts   # Calendar layer toggles + project context
│   ├── useGlobalFilters.ts         # Work/Personal visibility toggles
│   └── useUIStore.ts               # Spawn date + transient UI flags
│
├── types/                          # TypeScript type contracts (THE BIBLE)
│   ├── crm.ts                      # Domain entity interfaces (Client, Project, Note…)
│   └── database.types.ts           # Auto-generated Supabase Postgres schema types
│
├── supabase/                       # Thin Supabase REST API wrappers (read-only)
│   ├── supabaseClient.ts           # Singleton Supabase JS client
│   ├── userSettingsApi.ts          # User preferences CRUD
│   ├── clientsApi.ts
│   ├── projectsApi.ts
│   ├── projectPhasesApi.ts
│   ├── notesApi.ts
│   ├── tasksApi.ts
│   ├── timeEntriesApi.ts
│   └── dashboardApi.ts
│
├── lib/                            # Core infrastructure (non-UI)
│   ├── db.ts                       # Dexie v68 schema definition + LocalEntity interfaces
│   ├── syncManager.ts              # useSync() hook: starts WebSocket + Orchestrator loop
│   ├── hydrationManager.ts         # Initial data pull from Supabase into Dexie
│   ├── rruleUtils.ts               # iCalendar RRULE expansion (ghost occurrence engine)
│   ├── noteUtils.ts                # Note archetype classification helpers
│   ├── orgHelper.ts                # Organization ID resolution utility
│   ├── projectSorting.ts           # Project sort comparator functions
│   ├── locales/                    # i18n JSON locale files (12 languages)
│   ├── migrations/                 # One-off DB migration scripts (run once on boot)
│   ├── services/                   # Stateless business-logic services
│   │   ├── clientService.ts
│   │   ├── contactRoleService.ts   # RROLE graph builder
│   │   ├── noteService.ts
│   │   ├── projectService.ts
│   │   └── shadowResourceService.ts
│   └── sync/                       # Trinity Sync Layer
│       ├── utils/
│       │   ├── syncOrchestrator.ts # 14-step topological push order
│       │   ├── syncHelpers.ts      # Shared retry / error helpers
│       │   └── payloadSanitizer.ts # Zero-Spread whitelist mapper
│       └── handlers/               # One handler file per Dexie table
│           ├── syncClients.ts
│           ├── syncProjects.ts
│           ├── syncPhases.ts
│           ├── syncNotes.ts        # Largest handler (Meeting-to-Track transmutation)
│           ├── syncTasks.ts
│           ├── syncTimeEntries.ts
│           ├── syncDeals.ts
│           ├── syncDealStages.ts
│           ├── syncSuppliers.ts
│           ├── syncExternalResources.ts
│           ├── syncContacts.ts
│           ├── syncContactRoles.ts
│           ├── syncProjectSuppliers.ts
│           ├── syncProjectContacts.ts
│           ├── syncSupplierContacts.ts
│           └── syncUserSettings.ts
│
├── hooks/                          # Business-logic hooks (decoupled from UI)
│   ├── useCalendarAggregator.ts    # Multi-entity calendar data pipeline + RRULE ghosts
│   ├── useThoughts.tsx             # Full CRUD + automation router for notes/tasks
│   ├── useThoughtRouter.ts         # Note→Project/Client promotion logic
│   ├── useTracker.ts               # Time entry CRUD + live timer management
│   ├── useProjectDetails.ts        # Full project detail data aggregation
│   ├── useProjectTasks.ts          # Phase-based task management
│   ├── useGeneralTasks.ts          # Cross-project task list
│   ├── usePickerResources.ts       # Stakeholder picker data (contacts, suppliers…)
│   ├── useDashboard.ts             # KPI aggregation for Dashboard
│   ├── useHydration.ts             # Tracks initial hydration completion state
│   ├── useWakeHydration.ts         # Re-hydrates on device wake / window focus
│   ├── useRealtime.ts              # Supabase WebSocket channel subscription
│   ├── useEdgeScrollPagination.tsx # DnD auto-pagination on calendar edge scroll
│   ├── useContactRoles.ts          # RROLE contact-role query helper
│   ├── useExchangeRates.ts         # Currency exchange rate fetcher
│   ├── useInbox.ts                 # Unlinked notes inbox query
│   ├── useProjects.ts              # Lightweight project list query
│   ├── useSettings.ts              # User preference reader (Zustand + Dexie)
│   └── useTimer.ts                 # Thin active-timer state accessor
│
├── assets/                         # Static assets (images, icons)
│
└── components/                     # All React UI components
    ├── App-level pages (root of components/)
    │   ├── CalendarHub.tsx         # /calendar — full DnD multi-view calendar
    │   ├── Dashboard.tsx           # / — KPI overview, activity feed
    │   ├── InboxPage.tsx           # Standalone inbox browser
    │   ├── ThoughtsPage.tsx        # /thoughts — Thoughts (notes) command center
    │   ├── TasksPage.tsx           # /tasks — Tasks command center
    │   ├── TimeTrackerPage.tsx     # /tracker — Live timer + track list
    │   ├── TimerWidget.tsx         # Floating persistent timer widget
    │   ├── ProjectsPage.tsx        # /projects — Project board
    │   ├── ProjectDetailsPage.tsx  # /projects/:id — Full project view
    │   └── ClientDetailsPage.tsx   # /clients/:id — Client CRM view
    │
    ├── layout/                     # App shell
    │   ├── MainLayout.tsx          # Sidebar nav + content area shell
    │   ├── ThemeProvider.tsx       # Dark/Light mode applier
    │   ├── SettingsModal.tsx       # User preferences modal
    │   ├── UpdateManager.tsx       # PWA SW update prompt
    │   ├── RotateWarning.tsx       # Mobile landscape guard
    │   └── themeContext.ts
    │
    ├── calendar/                   # CalendarHub sub-components
    │   ├── CalendarDay.tsx         # Single day column (header + DnD droppable)
    │   └── CalendarBlock.tsx       # Individual event/task/expense card
    │
    ├── tracker/                    # Time tracking sub-components
    │   ├── TimeEntryModal.tsx      # Create/edit time entry modal
    │   ├── TimeEntryItem.tsx       # Single row in tracker list
    │   ├── StakeholderPickerModal.tsx # Resource/contact picker
    │   ├── RRulePicker.tsx         # iCalendar recurrence rule builder
    │   ├── RecurrenceChoiceDialog.tsx # Edit-one vs edit-all series prompt
    │   └── PulseActivityItem.tsx   # Mini activity indicator
    │
    ├── notes/                      # Notes/Thoughts sub-components
    │   ├── NoteModal.tsx           # Full note create/edit modal
    │   ├── NoteGroup.tsx           # List group renderer (by archetype/list)
    │   ├── NotesManager.tsx        # Full embedded notes panel
    │   ├── TransformerModal.tsx    # Note→Project/Client/Deal promotion modal
    │   ├── NoteRow.tsx             # Single note row
    │   ├── NoteFilterPanel.tsx     # Filter bar for note lists
    │   ├── NoteSerializers.ts      # TipTap JSON ↔ markdown conversion
    │   ├── ExportModal.tsx         # Note export (PDF/MD)
    │   ├── JumpPortal.tsx          # Deep-link jump target portal
    │   └── modal/                  # NoteModal sub-panels
    │
    ├── deals/                      # Kanban pipeline
    │   ├── DealsPage.tsx           # /deals — full Kanban board
    │   ├── DealColumn.tsx          # Single Kanban column (stage)
    │   ├── SortableDealCard.tsx    # DnD deal card
    │   ├── DealModal.tsx           # Deal create/edit modal
    │   ├── ConvertDealModal.tsx    # Deal→Project conversion prompt
    │   ├── DivorceModal.tsx        # Unlink deal from project modal
    │   └── StageModal.tsx          # Deal stage create/edit modal
    │
    ├── projects/                   # Project sub-components
    │   ├── ProjectModal.tsx        # Full project create/edit modal (tabs)
    │   ├── ProjectCalendar.tsx     # Project-scoped DnD calendar
    │   ├── ProjectTimeline.tsx     # Gantt-style phase timeline
    │   ├── TimelinePage.tsx        # /timeline — global cross-project timeline
    │   ├── ProjectTracking.tsx     # Time tracking panel inside project
    │   ├── ProjectNotes.tsx        # Notes panel inside project
    │   ├── ProjectList.tsx         # Project list renderer
    │   ├── ActiveProjectCard.tsx   # Project card with live metrics
    │   ├── ProjectPickerModal.tsx  # Project picker popover
    │   ├── ProjectDateFixModal.tsx # Date validation repair modal
    │   ├── ProjectOverrunModal.tsx # Budget overrun alert modal
    │   ├── TabButton.tsx           # Reusable tab button primitive
    │   ├── analytics/              # Project analytics charts
    │   ├── tasks/                  # Phase/task views inside project
    │   ├── tabs/                   # Tab panel components
    │   └── notes/                  # Notes sub-panel inside project
    │
    ├── companies/                  # CRM Directory entry point
    │   └── DirectoryPage.tsx       # /companies — routes to clients + suppliers tabs
    │
    ├── clients/                    # Client-specific sub-components
    │
    ├── contacts/                   # RROLE Contact management
    │   ├── ContactsPage.tsx        # /contacts — contacts list
    │   ├── ContactList.tsx
    │   └── ContactPickerModal.tsx
    │
    ├── suppliers/                  # Supplier (B2B vendor) management
    │   ├── SupplierDetailsPage.tsx # /suppliers/:id
    │   ├── SupplierModal.tsx
    │   ├── SupplierList.tsx
    │   ├── SupplierListTab.tsx
    │   ├── SupplierTimeEntryModal.tsx
    │   ├── SupplierMetrics.tsx
    │   ├── ContactModal.tsx        # Shared contact create/edit inside Supplier
    │   └── tabs/
    │
    ├── dashboard/                  # Dashboard sub-widgets
    │   ├── ActionCenterModal.tsx
    │   ├── GlobalTrackingKPI.tsx
    │   └── UpcomingTasksWidget.tsx
    │
    ├── shared/                     # Reusable cross-domain components
    │   ├── GlobalFilterBar.tsx     # Work/Personal + context filter bar
    │   ├── B2BOverviewTab.tsx      # Shared client+supplier overview panel
    │   ├── InlineResourcePicker.tsx
    │   ├── ResourceCard.tsx        # Stakeholder card (contact/supplier)
    │   └── AnalyticsDashboardShell.tsx
    │
    ├── analytics/                  # Top-level analytics views
    │
    ├── modals/                     # Shared modal primitives
    │   
    ├── tasks/                      # Task-specific sub-components
    │
    └── ui/                         # Primitive UI atoms
        ├── ConfirmModal.tsx
        ├── TiptapEditor.tsx        # Rich-text editor wrapper
        ├── CustomDatePicker.tsx
        ├── CustomTimePicker.tsx
        ├── CustomSelect.tsx
        ├── ColorPicker.tsx
        ├── ColorSwatchPicker.tsx
        ├── MiniKPICard.tsx
        └── NukeButton.tsx          # Dangerous destructive action button
```

---

## 2. 📂 Directory Responsibilities

| Directory | Role |
|---|---|
| `auth/` | Supabase session management. `AuthProvider` wraps the app, exposes session via `authContext`. All auth guards live here. |
| `context/` | Long-lived ambient state that crosses component tree boundaries and survives re-renders (e.g., the active live timer). Uses React Context directly — not Zustand — because it needs to run a side-effect loop. |
| `store/` | Zustand ephemeral UI state slices. Three stores govern: global Work/Personal visibility, calendar layer toggles, and transient UI flags (e.g., note spawn date). No async logic. |
| `types/` | The absolute TypeScript Bible. `crm.ts` is the domain model. `database.types.ts` is the auto-generated Postgres schema. Both are read-only contracts that everything else must conform to. |
| `supabase/` | Thin, stateless REST wrappers for the Supabase JS client. Used by `hydrationManager.ts` for initial data pull. **Never used directly from UI components.** |
| `lib/db.ts` | Dexie v68 database definition. Contains the `TimeTrackDB` class with all table definitions, indices, and `LocalEntity` interfaces (the offline union of domain types + sync metadata). |
| `lib/syncManager.ts` | The `useSync()` hook. Boots the Supabase Realtime WebSocket subscription and the async Orchestrator push loop. Runs once on `AuthenticatedApp` mount. |
| `lib/hydrationManager.ts` | One-time (and wake-triggered) pull of all Supabase data into Dexie. Executed in strict dependency order to avoid FK 23503 violations. |
| `lib/rruleUtils.ts` | Expands RRULE template strings into in-memory ghost `CalendarItem` occurrences, without creating real DB rows. |
| `lib/sync/utils/syncOrchestrator.ts` | The 14-step topological push engine. Enforces correct entity push order (clients must precede projects, which must precede notes, etc.). |
| `lib/sync/utils/payloadSanitizer.ts` | Implements the Zero-Spread Policy. Strips all LocalEntity-only fields (`syncStatus`, `lastUpdated`, etc.) before any Supabase REST call. |
| `lib/sync/handlers/` | One file per Dexie table. Each handler queries Dexie for `pending_*` rows, maps them to strict Postgres payloads (whitelist, no spread), and upserts to Supabase. |
| `lib/services/` | Pure stateless business-logic. Independent from React. Used by hooks and sync handlers alike. `contactRoleService.ts` builds the RROLE graph; `noteService.ts` handles archetype classification. |
| `lib/migrations/` | One-shot migration scripts that run on `AuthenticatedApp` mount (guarded by a `localStorage` flag). Non-destructive by design. |
| `hooks/` | The application's brain. Each hook owns the business logic for one domain area. They read from Dexie (via `useLiveQuery`) and write back to it (optimistic mutations). They never call Supabase directly. |
| `store/` | Zustand atoms. Holds only UI-coordination state, not domain data. |
| `components/layout/` | The application shell. `MainLayout.tsx` renders the sidebar navigation, the main content area, and the floating `TimerWidget`. All page routes render inside this shell. |
| `components/ui/` | Headless UI primitives. Pure display atoms with no business logic. |
| `components/shared/` | Cross-domain reusable panels that combine multiple entities (e.g., `B2BOverviewTab` renders both clients and suppliers). |
| `components/calendar/` | Sub-components of `CalendarHub`. `CalendarDay` handles the per-day container and DnD droppable. `CalendarBlock` renders the visual card for any `CalendarItem`. |
| `components/notes/` | The full Note editing, grouping, and display stack. `NoteModal` is the primary CRUD surface. `TransformerModal` handles the Note→CRM entity promotion automation. |
| `components/tracker/` | Time-entry management. `TimeEntryModal` is the primary CRUD surface. `RRulePicker` and `RecurrenceChoiceDialog` handle the RRULE ghost detachment flow. |
| `components/deals/` | The Kanban pipeline. `DealsPage` owns the full DnD board. `ConvertDealModal` handles the Deal→Project WON conversion automation. |

---

## 3. 🔤 Naming Conventions

| Pattern | Convention | Examples |
|---|---|---|
| **React Components** | `PascalCase.tsx` | `CalendarHub.tsx`, `NoteModal.tsx`, `ProjectDetailsPage.tsx` |
| **React Hooks** | `use[Name].ts` / `use[Name].tsx` | `useCalendarAggregator.ts`, `useThoughts.tsx` |
| **Sync Handlers** | `sync[EntityName].ts` | `syncNotes.ts`, `syncTimeEntries.ts` |
| **Utility Files** | `[name]Utils.ts` or `[name]Helper.ts` | `rruleUtils.ts`, `syncHelpers.ts`, `orgHelper.ts` |
| **Payload Sanitizers** | `payload[Name].ts` | `payloadSanitizer.ts` |
| **Services** | `[entity]Service.ts` | `projectService.ts`, `contactRoleService.ts` |
| **Zustand Stores** | `use[Name]Store.ts` | `useCalendarFilterStore.ts`, `useUIStore.ts` |
| **Context Files** | `[Name]Context.ts` + `[Name]Provider.tsx` | `authContext.ts` + `AuthProvider.tsx` |
| **API Wrappers** | `[entity]Api.ts` | `projectsApi.ts`, `userSettingsApi.ts` |
| **Type Files** | `[name].ts` (lowercase) in `types/` | `crm.ts`, `database.types.ts` |
| **Styling** | Tailwind utility classes inline | No external CSS modules. `index.css` for Tailwind base only. |

---

## 4. 🗺️ Core Component Flow (Hierarchy Map)

```
main.tsx
└── App.tsx
    ├── QueryClientProvider (React Query)
    ├── BrowserRouter (React Router v6)
    ├── AuthProvider  ──────────────────── auth/AuthProvider.tsx
    ├── TimerProvider ──────────────────── context/TimerContext.tsx
    ├── ThemeProvider ──────────────────── components/layout/ThemeProvider.tsx
    ├── Toaster        (react-hot-toast)
    ├── UpdateManager  (PWA update notifier)
    ├── RotateWarning  (mobile landscape guard)
    └── AppRoutes
        └── AuthenticatedApp  [boots: useSync, useWakeHydration, useHydration]
            └── MainLayout  ──────────────── components/layout/MainLayout.tsx
                ├── [Sidebar Navigation]
                ├── TimerWidget  ─────────── components/TimerWidget.tsx
                └── <Routes>
                    ├── /             → Dashboard.tsx
                    ├── /thoughts     → ThoughtsPage.tsx
                    │                    └── hooks/useThoughts.tsx (CRUD engine)
                    ├── /tasks        → TasksPage.tsx
                    ├── /tracker      → TimeTrackerPage.tsx
                    │                    └── hooks/useTracker.ts (timer engine)
                    ├── /calendar     → CalendarHub.tsx
                    │                    ├── hooks/useCalendarAggregator.ts
                    │                    ├── components/calendar/CalendarDay.tsx
                    │                    └── components/calendar/CalendarBlock.tsx
                    ├── /deals        → deals/DealsPage.tsx
                    ├── /projects     → ProjectsPage.tsx
                    ├── /projects/:id → ProjectDetailsPage.tsx
                    │                    └── hooks/useProjectDetails.ts
                    ├── /timeline     → projects/TimelinePage.tsx
                    ├── /companies    → companies/DirectoryPage.tsx
                    │                    ├── clients/  (tabs)
                    │                    └── suppliers/ (tabs)
                    ├── /clients/:id  → ClientDetailsPage.tsx
                    ├── /suppliers/:id→ suppliers/SupplierDetailsPage.tsx
                    └── /contacts     → contacts/ContactsPage.tsx
```

---

## 5. 🛡️ Development Protocols

### 5.1 Atomic File Protocol
The mandatory rule for all code modifications:
1. **Target:** Open and modify **exactly ONE file at a time**.
2. **Validate:** Immediately run `npm run wolf:audit` (ESLint + TSC `--noEmit`).
3. **Resolve:** Fix all errors in that file before touching any other file.
4. **Advance:** Only move to the next file after the current file achieves **0 errors**.

**Rationale:** Prevents cascading TypeScript errors that span multiple files and become impossible to trace. Every commit reaches the branch in a verified, compilable state.

### 5.2 Wolf Flow (Iterative Dev-Sync Cycle)
The standard release pipeline invoked via `/wolf_flow`:
1. **KB Audit:** Read all `.gemini/*.md` files. Update any stale documentation to match the current code reality.
2. **Validation Gate:** Run `npm run wolf:audit`. Must return **0 errors**. Attempt up to 3 auto-heal loops before halting.
3. **Seed Snapshot:** Run `npm run sb:snapshot` to capture current local DB state in `seed.sql`.
4. **Commit:** `git add -A && git commit -m "[vX.X.X] type(scope): message"` — version prefix is mandatory.
5. **Push:** `git push origin develop --no-verify` (Husky pre-push hooks are bypassed for UI-intensive dev phases, with CI/CD acting as the remote gate).

### 5.3 Zero-Spread Policy (Sync Payload Integrity)
All Dexie-to-Supabase payload construction **must** use explicit field whitelisting via `payloadSanitizer.ts`. The JavaScript spread operator (`...entity`) is permanently banned on network payloads to prevent local-only fields (`syncStatus`, `lastUpdated`, `is_deleted`, etc.) from reaching the PostgreSQL API and triggering `400 Bad Request` errors.

### 5.4 Topological Sync Order (14-Step Orchestrator)
The `syncOrchestrator.ts` enforces the following push dependency order to prevent `23503` Foreign Key violation errors:
1. `user_settings` → 2. `clients` → 3. `suppliers` → 4. `contacts` → 5. `contact_roles` → 6. `external_resources` → 7. `projects` → 8. `project_phases` → 9. `project_suppliers` → 10. `project_contacts` → 11. `supplier_contacts` → 12. `deals` → 13. `notes` → 14. `time_entries`