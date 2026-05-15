# 🚨 FULL DB AUDIT REPORT (v0.7.100 Architecture)

*Tech Lead ordered explicit halt prior to relational schema expansion.*

---

## 1. DEXIE ENGINE STATE (`frontend/src/lib/db.ts`)

**Current Engine Version:** `DB_VERSION = 68`

**Schema Stores and Indexes:**
- **clients**: `id, organization_id, status, is_personal, syncStatus, is_deleted, updated_at`
- **suppliers**: `id, organization_id, status, is_personal, temp_local_id, syncStatus, is_deleted, updated_at`
- **externalResources**: `id, organization_id, supplier_id, type, status, is_personal, temp_local_id, syncStatus, is_deleted, updated_at`
- **projects**: `id, supplier_id, organization_id, client_id, status, is_personal, is_billable, syncStatus, is_deleted, updated_at`
- **timeEntries**: `id, supplier_id, contact_id, project_id, organization_id, client_id, note_id, external_resource_id, start_time, is_running, is_personal, syncStatus, is_deleted, updated_at, [note_id]`
- **tasks** (Legacy): `id, supplier_id, project_id, phase_id, deal_id, client_id, parent_task_id, status, is_archived, syncStatus, is_deleted, updated_at, [project_id+phase_id]`
- **project_phases**: `id, project_id, is_milestone, syncStatus, is_deleted, updated_at`
- **notes (FAST Model)**: `id, supplier_id, project_id, client_id, deal_id, list_id, organization_id, type, status, due_date, sort_order, phase_id, assigned_to, is_pinned, is_archived, is_deleted, syncStatus, updated_at, behavior_class, [project_id+type], [syncStatus+list_id], [client_id], [deal_id], [phase_id], [assigned_to]`
- **note_lists**: `id, organization_id, project_id, type, is_deleted, syncStatus`
- **deals**: `id, name, stage_id, sort_order, client_id, syncStatus, lastUpdated, is_deleted, organization_id, project_id`
- **deal_stages**: `id, organization_id, sort_order, archetype, syncStatus, lastUpdated, is_deleted`
- **user_settings**: `user_id, syncStatus, updated_at`
- **contacts**: `id, organization_id, status, type, is_personal, syncStatus, is_deleted, updated_at`
- **contactRoles**: `id, contact_id, role_type, is_personal, organization_id, related_supplier_id, related_client_id, related_resource_id, syncStatus, is_deleted, updated_at`
- **projectSuppliers**: `id, project_id, supplier_id, organization_id, syncStatus`
- **supplierContacts**: `id, supplier_id, contact_id, organization_id, syncStatus, updated_at, [supplier_id+contact_id]`
- **projectContacts**: `id, project_id, contact_id, organization_id, syncStatus, updated_at, [project_id+contact_id]`

**Finding on Categorization Engine:**
- There is **NO** `categories` table.
- There is **NO** `tags` table.
- The standard user preferences are routed through a generic `user_settings` table, but there is no explicitly relational dimension for tags/labels/categories anywhere in the database schema.

---

## 2. TYPE ARCHITECTURE (`frontend/src/types/crm.ts`)

**Core Entities Mapped:**
- Project, Client, Contact, Supplier, ExternalResource, Task (Legacy), TimeEntry, Note (FAST format), ProjectPhase, Deal.

**Categorization & Tagging Implementation:**
- Only the `Note` entity (handling thoughts, expenses, logs, and bugs) explicitly supports `tags` and `category` within its interface.
- **Tags Type:** Strictly `tags?: string[] | null` within local `LocalNote` signature, and inside `NoteMetadata`.
- **Category Type:** Explicitly defined as `ExpenseCategory = 'Software' | 'Travel' | '...'` natively, but extended broadly as `category?: ExpenseCategory | string` within `NoteMetadata`.
- **Projects, Clients, and TimeEntries:** These entities DO NOT have any type definitions for categories natively attached to them in `types/crm.ts`. There are completely absent of standard taxonomy.

---

## 3. SYNC ARCHITECTURE (`lib/syncManager.ts` & `database.types.ts`)

- **Payload Mechanism:** Supabase expects `metadata` as a strict `Json` or `Jsonb` column (seen in `database.types.ts` `public.notes.metadata: Json`).
- **Dexie Interception:** The `syncManager` reads local objects and blindly uploads the structured JavaScript object. Tags (`string[]`) and Categories (`string`) are automatically serialized.
- **Relational Integrity:** Because Supabase explicitly maps `notes.metadata` to a JSON bucket, there are no relational `REFERENCES` checks performed on category strings. It is purely unstructured payload storage.

---

## 4. ARCHITECTURAL ASSESSMENT

If a new `categories` table is introduced natively into the database:
1. **Impact on Dexie:** We must jump `DB_VERSION` to `69` and declare `categories: 'id, organization_id, type, name, syncStatus, is_deleted, updated_at'`.
2. **Impact on Core Types:** We will need to map `category_id?: string | null` onto `Project`, `Client`, `TimeEntry`, and inside `NoteMetadata` to form actual relations, rather than strings.
3. **Ghost String Migration:** Since Expense categories currently live inside the `notes.metadata` JSONB as pure text strings, introducing a real `categories` table will require an application-level migration script (likely looping on boot or via a `wolf_migration` utility map) to scan old strings, insert them as real Category entities locally, and re-map the notes to use the new `category_id`. This is entirely feasible and highly recommended for data density/referential safety.
