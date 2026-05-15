# 🐺 tAImetrack — Data Dictionary & Entity-Relationship Guide (SCHEMA.md)
**Version:** v0.7.156 - 2026-04-29
**Status:** Present-Only Data Dictionary. Describes only what is compiled and active today.

---

## 1. 🗄️ Core Entities (Data Dictionary)

The following describes the exact database tables currently active in the Postgres schema and mapped securely in the `crm.ts` TypeScript models.

### 1.1 `clients` (Primary Customers)
*   **`id`** (`string`, UUID PRIMARY KEY)
*   **`organization_id`** (`string`, UUID NOT NULL) - Tenancy isolator.
*   **`name`** (`string`, NOT NULL)
*   **`is_personal`** (`boolean`, nullable) - If true, this is a private contact accessible only to the owner.
*   **`email`** (`string`, nullable)
*   **`phone`** (`string`, nullable)
*   **`vat_number`** (`string`, nullable)
*   **`status`** (`string`, nullable) - e.g., 'active', 'archived'.
*   **`color`** (`string`, nullable) - Hex color for UI consistency.
*   **`currency`** (`string`, nullable)
*   **`default_rate`** (`number`, nullable) - Override rate for billable projects.

### 1.2 `projects` (Work Containers)
*   **`id`** (`string`, UUID PRIMARY KEY)
*   **`organization_id`** (`string`, UUID NOT NULL)
*   **`client_id`** (`string`, UUID nullable) - Links to `clients` (Foreign Key). If null, it's an internal project.
*   **`name`** (`string`, NOT NULL)
*   **`description`** (`string`, nullable)
*   **`status`** (`string`, nullable) - Currently mapped to: `to_do`, `in_progress`, `done`, `on_hold`.
*   **`start_date`** (`string`, nullable, Date string YYYY-MM-DD)
*   **`due_date`** (`string`, nullable, Date string YYYY-MM-DD)
*   **`is_billable`** (`boolean`, nullable) - Determines financial ROI routing.
*   **`billing_type`** (`string`, nullable)
*   **`hourly_rate`** / **`fixed_price`** (`number`, nullable) - Financial overrides.
*   **`is_personal`** (`boolean`, nullable)
*   **`is_pinned`** (`boolean`, nullable)
*   **`notes`** (`Json`, nullable) - TipTap JSON content.
*   **`color`** (`string`, nullable)

### 1.3 `deals` & `deal_stages` (Sales Pipeline)
**`deals`**
*   **`id`** (`string`, UUID PRIMARY KEY)
*   **`name`** (`string`, NOT NULL)
*   **`client_id`** (`string`, UUID nullable)
*   **`stage_id`** (`string`, UUID nullable) - Links to `deal_stages`.
*   **`value`** (`number`, nullable) - Financial value of the deal.
*   **`close_date`** (`string`, nullable) - Target close date.
*   **`probability`** (`number`, nullable)
*   **`sort_order`** (`number`, nullable) - Kanban column intra-position.

**`deal_stages`**
*   **`id`** (`string`, UUID PRIMARY KEY)
*   **`name`** (`string`, NOT NULL)
*   **`archetype`** (`string`, nullable) - See Enums section (open, won, lost).
*   **`sort_order`** (`number`, nullable) - Column lateral position.

### 1.4 `notes` (Unified Thoughts & Tasks)
*   **`id`** (`string`, UUID PRIMARY KEY)
*   **`organization_id`** (`string`, UUID NOT NULL)
*   **`title`** (`string`, nullable)
*   **`content`** (`Json`, nullable) - RichText TipTap JSON.
*   **`archetype`** (`string`, NOT NULL) - Determines UI rendering (todo, meeting, note, etc.).
*   **`behavior_class`** (`string`, nullable) - High-level grouping (`ACTIONABLE`, `EVENT`, etc.).
*   **`metadata`** (`Json`, NOT NULL) - Strict JSONB schema (see below).
*   **`status`** (`string`, nullable)
*   **`due_date`** (`string`, nullable)
*   **`project_id`** (`string`, UUID nullable)
*   **`client_id`** (`string`, UUID nullable)
*   **`deal_id`** (`string`, UUID nullable)
*   **`list_id`** (`string`, UUID nullable) - Links to `note_lists` for folder grouping.
*   **`is_personal`** (`boolean`, NOT NULL)
*   **`is_archived`** (`boolean`, NOT NULL)
*   **`is_pinned`** (`boolean`, nullable)
*   **`sort_order`** (`number`, nullable)

### 1.5 `time_entries` (Tracking & Forecasting)
*   **`id`** (`string`, UUID PRIMARY KEY)
*   **`organization_id`** (`string`, UUID NOT NULL)
*   **`description`** (`string`, nullable)
*   **`start_time`** (`string`, NOT NULL) - ISO8601 string.
*   **`end_time`** (`string`, nullable) - ISO8601 string.
*   **`duration`** (`number`, nullable) - Length in seconds/minutes.
*   **`is_done`** (`boolean`, nullable) - Distinguishes actual records (`true`/`null`) from planned forecasts (`false`).
*   **`is_running`** (`boolean`, nullable) - Indicates an active live timer.
*   **`project_id`** (`string`, UUID nullable)
*   **`client_id`** (`string`, UUID nullable)
*   **`note_id`** (`string`, UUID nullable) - The task or meeting this track represents.
*   **`external_resource_id`** / **`contact_id`** / **`supplier_id`** (`string`, UUID nullable) - The assigned actor.
*   **`rrule`** (`string`, nullable) - iCalendar recurring event template string.

### 1.6 B2B Hierarchy (`suppliers` & `external_resources`)
*   **`suppliers`**: Mapped exactly like `clients` (id, name, vat_number, status) but for outbound entities.
*   **`external_resources`**: Legacy entity for resources. Slowly phasing out in favor of RROLE `contacts`.

### 1.7 `contacts` (The RROLE Architecture)
*   **`id`** (`string`, UUID PRIMARY KEY)
*   **`name`** (`string`, NOT NULL)
*   **`email`** / **`phone`** (`string`, nullable)
*   **`type`** (`string`, nullable)

---

## 2. 🌁 Bridge Tables (M:N Relations)

### 2.1 `project_contacts`
Maps a `contact` directly to a `project`.
*   **`project_id`** (UUID)
*   **`contact_id`** (UUID)
*   **`hourly_rate`** (`number`, nullable) - Project-specific override rate.
*   **`currency`** (`string`, nullable)

### 2.2 `project_suppliers`
Maps a `supplier` (company) to a `project`.
*   **`project_id`** (UUID)
*   **`supplier_id`** (UUID)
*   **`hourly_rate`** (`number`, nullable)
*   **`currency`** (`string`, nullable)

### 2.3 `supplier_contacts`
Maps a `contact` (employee) to a `supplier` (company).
*   **`supplier_id`** (UUID)
*   **`contact_id`** (UUID)
*   **`hourly_rate`** (`number`, nullable)
*   **`currency`** (`string`, nullable)

### 2.4 `contact_roles`
General-purpose bridge defining what a contact "is" within the system.
*   **`contact_id`** (UUID)
*   **`role_type`** (`string`)
*   **`related_client_id`** (UUID, nullable)
*   **`related_supplier_id`** (UUID, nullable)
*   **`related_resource_id`** (UUID, nullable)

---

## 3. 📦 JSONB Structures

### 3.1 `NoteMetadata`
The `metadata` column in `notes` is strongly typed via the `NoteMetadata` interface:

*   **Global Settings**: `pinned` (boolean), `color` (string), `tags` (string[])
*   **Task/Bug Attributes**: `priority` (low|medium|high|urgent), `severity` (low|medium|high|critical), `system` (string), `link` (string)
*   **Event Attributes**: `event_start` (string), `event_end` (string)
*   **Expense Attributes**: `financial_amount` (number), `financial_currency` (string), `expense_date` (string), `category` (string), `payment_method` (string), `is_billable` (boolean), `tax_amount` (number), `receipt_ref` (string)

### 3.2 `UserPreferences` (`user_settings`)
Stored in `user_settings.preferences` (JSONB).
*   **`theme`**: `'light' | 'dark' | 'system'`
*   **`language`**: `'en' | 'it' | 'es' | ...`
*   **`currency`**: `'EUR' | 'USD' | ...`
*   **`weekStartDay`**: `0 | 1 | 6` (Sun/Mon/Sat)
*   **`sidebarCollapsed`**: `boolean`

---

## 4. 🔠 Enums & Archetypes

### 4.1 `NoteArchetype`
The exact UI surface mapping keys:
`'note' | 'idea' | 'todo' | 'reminder' | 'meeting' | 'bug' | 'expense' | 'journal'`

### 4.2 `NoteClass` (FAST Model)
Functional behavior grouping for queries:
`'ACTIONABLE' | 'EVENT' | 'ISSUE' | 'REMINDER' | 'DESCRIPTIVE' | 'FINANCIAL'`

### 4.3 `ProjectStatus`
`'to_do' | 'in_progress' | 'done' | 'on_hold'`

### 4.4 `DealStageArchetype`
`'open' | 'won' | 'lost'`

### 4.5 `SyncStatus` (Local DEXIE Only)
`'synced' | 'pending_create' | 'pending_update' | 'pending_delete' | 'error'`

---

## 5. 🔄 Local (Dexie) vs Remote (Supabase) Mapping

### 5.1 Protocol Differences
The Supabase PostgreSQL schema represents the absolute ground-truth physical storage. The Dexie IndexedDB schema mirrors it exactly, but is decorated with additional offline-first control fields that are **never** synced to Supabase (they are stripped during the payload mapping phase).

### 5.2 Local-Only IndexedDB Fields (`LocalEntityMetadata`)
Every local Dexie table interface extends `LocalEntityMetadata`:
*   **`syncStatus`**: Controls the Orchestrator loop queue state.
*   **`lastUpdated`**: JS Timestamp (`Date.now()`) used internally.
*   **`is_deleted`**: Soft-delete flag (mapped to DB `is_deleted` where applicable, or acts as a local filter before `pending_delete` is verified by the remote DB).

### 5.3 LWW (Last Write Wins) Alignment
Dexie utilizes `updated_at` timestamps heavily to compare against incoming Supabase Realtime broadcast payloads. If a local row is dirty (`syncStatus !== 'synced'`), the Realtime listener checks `updated_at` before blindly overwriting the local optimistic changes.