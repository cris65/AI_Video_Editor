# 🚨 DEEP SYSTEM AUDIT: CATEGORIES STATE
*Target Objective: Architecture analysis prior to introducing a dedicated `categories` table.*

This document details the exact current architecture for Expense (and generic) Categories within the TimeTrack CRM, to ensure that any proposed database migration relies on the existing factual structure.

---

## 1. TYPESCRIPT MODELS (`types/crm.ts`)
Currently, Expense Categories are primarily hardcoded as literal string unions, with an escape hatch mapped inside the generic `NoteMetadata`:

*   **Explicit Union Type:**
    ```typescript
    export type ExpenseCategory = 'Software' | 'Travel' | 'Meals' | 'Office' | 'Marketing' | 'Consulting' | 'Other';
    ```
*   **Metadata Integration:**
    ```typescript
    export interface NoteMetadata {
        ...
        category?: ExpenseCategory | string; // ⚠️ The `| string` escape hatch allows arbitrary values
        ...
    }
    ```

**Conclusion:** There is no `Category` entity or interface in the data model. Categories only exist as strings within the `NoteMetadata` dictionary.

---

## 2. DATABASE ARCHITECTURE (`lib/db.ts`)
The IndexedDB (Dexie) schema confirms the lack of a dedicated relational store for categories.

*   **Dexie Version:** `DB_VERSION = 68`
*   **Existing Core Stores:** `clients`, `suppliers`, `externalResources`, `projects`, `timeEntries`, `tasks`, `project_phases`, `notes`, `note_lists`, `deals`, `deal_stages`, `user_settings`, `contacts`, `contactRoles`, `projectSuppliers`, `supplierContacts`, `projectContacts`.
*   **Missing Relational Elements:** There is no `categories` or `expense_categories` store.
*   **Storage Mechanism:** Categories are stored purely as freeform text strings inside the `metadata` JSONB-like column of the `notes` table (where `archetype === 'expense'`).

---

## 3. UI IMPLEMENTATION (`NoteModalFooter.tsx`)
The UI handles categories dynamically through a "tag extraction" approach rather than fetching from a dedicated relational table.

*   **Hardcoded Fallback:** The file defines a `PREDEFINED_CATEGORIES` constant containing baseline options with corresponding hex colors.
*   **Dynamic Extraction (The "Ghost" Categories):** The app runs a Dexie `useLiveQuery` to scan **all** existing expenses (`db.notes.filter(n => !n.is_deleted && n.archetype === 'expense')`). It builds a `Set<string>` of any `metadata.category` value that isn't in the predefined list. This makes old custom categories reappear as long as one expense still uses them.
*   **The Merging/Renaming System:** The `handleRenameCategory` callback handles editing custom categories. It does this by performing a **bulk update** on the `notes` table, searching for all notes where `metadata.category === oldStr` and writing the new string.
*   **The "CUSTOM" Input Pipeline:** When a user selects "Other (New)...", the UI switches to a free-text `<input>` and saves that exact string verbatim into `metadata.category`.

---

## 🛑 ARCHITECTURAL VULNERABILITIES IDENTIFIED
1.  **Orphaned Data:** If the last expense using a custom category is deleted, that custom category is permanently lost from the UI dropdown choices.
2.  **Lack of Centralization:** Categories do not have global settings, attributes (e.g. `is_taxable`, `custom_color`, `linked_gl_code`), or active/inactive statuses.
3.  **High Payload:** Building the category list requires fetching and scanning the entire `notes` database, which could cause a bottleneck as the dataset grows dynamically.

## NEXT STEPS
To migrate to a true relational architecture, a new `categories` table (e.g., `id`, `name`, `color`, `type`, `organization_id`) must be introduced in Dexie. We would then need to transition the UI to fetch from this table, while migrating any "Ghost" string categories existing in `notes.metadata.category` into real database rows upon startup.
