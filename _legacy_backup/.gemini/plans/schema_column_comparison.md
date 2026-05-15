# Schema Column Verification: `contacts` vs `external_resources`

## Context
Before safely migrating and consolidating `external_resources` into the universal `contacts` table, we must identify all structural differences. Below is the exact schema breakdown extracted from `frontend/src/types/database.types.ts`.

## 1. Column Comparison Table

| Map | Column Name | `contacts` (Data Type) | `external_resources` (Data Type) | Status / Action Required |
| :---: | :--- | :--- | :--- | :--- |
| ✅ | `id` | `string` | `string` | Perfect match |
| ✅ | `name` | `string` | `string` | Perfect match |
| ✅ | `email` | `string \| null` | `string \| null` | Perfect match |
| ✅ | `phone` | `string \| null` | `string \| null` | Perfect match |
| ✅ | `status` | `string \| null` | `string \| null` | Perfect match |
| ✅ | `organization_id` | `string` | `string` | Perfect match |
| ✅ | `is_deleted` | `boolean \| null` | `boolean \| null` | Perfect match |
| ✅ | `temp_local_id` | `string \| null` | `string \| null` | Perfect match |
| ✅ | `created_at` | `string \| null` | `string \| null` | Perfect match |
| ✅ | `updated_at` | `string \| null` | `string \| null` | Perfect match |
| ❌ | **`color`** | **Missing** | `string \| null` | Missing in `contacts` |
| ❌ | **`currency`** | **Missing** | `string \| null` | Missing in `contacts` |
| ❌ | **`hourly_rate`** | **Missing** | `number \| null` | Missing in `contacts` |
| ❌ | **`is_personal`** | **Missing** | `boolean \| null` | Missing in `contacts` |
| ❌ | **`type`** | **Missing** | `string \| null` | Missing in `contacts` |
| ⚠️ | **`supplier_id`** | **Missing** | `string \| null` | Intentional omission in `contacts` per Agnostic Graph. (Requires relocation to junction tables) |

*(Note: The `frontend/src/types/crm.ts` interface mentions `first_name` and `last_name` for the frontend `Contact` type, but these physical columns do **not** exist in the Supabase `database.types.ts` physical schema for the `contacts` table).*

## 2. Identified Mismatches and Risks
If an `external_resource` is cast blindly into the `contacts` table today, the system will irrevocably lose the following operational data:

1.  **Financial Data:** `hourly_rate` and `currency` are absent in `contacts`.
2.  **UI/Context Metadata:** `color`, `type`, and `is_personal` are absent.
3.  **Relational Context:** `supplier_id` must purposefully be dropped and supplanted by the new `supplier_contacts` junction table, but data cannot just be "dropped" without porting it over.

**Conclusion:** We cannot migrate `external_resources` directly into `contacts` without either `ALTER`-ing the `contacts` table to encompass these missing properties (such as financial metrics or types) or moving these properties into a relational/contextual table (like `contact_roles`).
