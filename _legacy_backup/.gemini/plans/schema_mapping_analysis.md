# Schema Mapping Analysis: Agnostic Graph Architecture

## Context
Following a deep scan of `frontend/src/types/database.types.ts` and the physical Supabase migration history (specifically `20260407123202_rrole_tracker_upgrade.sql`), this document outlines the exact, exhaustive blueprint of the database relationships concerning the RROLE architecture.

### SECTION 1: AS-IS MAPPING (Current State)

*   **`projects`**
    *   has FK `supplier_id` pointing to `suppliers`. (Legacy 1:N lock-in)
    *   has FK `client_id` pointing to `clients`.
    *   has FK `organization_id` pointing to `organizations`.
*   **`suppliers`**
    *   No relational lock-ins targeting projects or contacts.
    *   has FK `organization_id` pointing to `organizations`.
*   **`contacts`** (The neutral human entity)
    *   No relational lock-ins targeting suppliers or projects natively in the physical table.
    *   has FK `organization_id` pointing to `organizations`.
*   **`external_resources`** (Legacy human payload)
    *   has FK `supplier_id` pointing to `suppliers`. (Legacy 1:N lock-in)
    *   has FK `organization_id` pointing to `organizations`.
*   **`project_suppliers`** (Junction Table - **ALREADY EXISTS**)
    *   *(Created via migration `20260407123202_rrole_tracker_upgrade.sql`)*
    *   has FK `project_id` pointing to `projects`.
    *   has FK `supplier_id` pointing to `suppliers`.
    *   has FK `organization_id` pointing to `organizations`.

*(Note: `contact_roles` also exists as an interim bridge mapping `contacts` to legacy `external_resources`/`suppliers`, but is structurally distinct from the Agnostic Graph phase).*

---

### SECTION 2: TO-BE MAPPING (Agnostic Graph Structure)

The new architecture enforces a strict N:N relationship topology where nodes are entirely independent, mapping contexts strictly via junction tables.

#### The Nodes (Global Entities)
*   **`projects`**:
    *   **ACTION REQUIRED**: Must REMOVE FK `supplier_id` to sever the 1:N vendor lock.
*   **`suppliers`**:
    *   Remains an independent business entity node. No structural changes needed.
*   **`contacts`**:
    *   Remains an independent human entity node. No structural changes needed.
*   **`external_resources`**:
    *   **ACTION REQUIRED**: Must REMOVE FK `supplier_id` to decouple resources from strict, single-agency boundaries.

#### The Edges (Junction Tables)
*   **`project_suppliers` (Project ↔ Supplier)**
    *   **STATUS: ALREADY EXISTS.** We do *not* need to create this table. (We only need to ensure data continuity if it's already in use).
*   **`supplier_contacts` (Supplier ↔ Resource/Contact)**
    *   **STATUS: TO BE CREATED.** Will connect `supplier_id` with `contact_id` to map cross-vendor freelance collaborations.
*   **`project_contacts` (Project ↔ Direct Resource/Contact)**
    *   **STATUS: TO BE CREATED.** Will connect `project_id` with `contact_id` for direct labor bypassing vendor invoicing.
