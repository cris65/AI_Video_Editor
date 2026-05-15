# 🐺 LOG ARCHETYPE PLAN: The Universal Tracker

**Document Scope:** Architectural and Typescript Blueprint for the implementation of the `type: 'log'` archetype, leveraging the existing `notes` table (FAST Engine) in `tAImetrack`.

## 1. THE TYPES (`frontend/src/types/crm.ts`)

The `notes` table architecture natively supports polymorphic behavior. Introducing the 'log' archetype requires expanding the existing taxonomy without altering fundamental table structures.

### A. Archetype & Class Expansion
1. **`NoteArchetype`**: We will add `'log'` to the union type.
2. **`NoteClass`**: We will introduce a new behavior class, `'METRIC'`, to strictly categorize data-driven tracking entries and separate them from `'DESCRIPTIVE'` thoughts or `'ACTIONABLE'` tasks.
3. **`ALL_ARCHETYPES`**: We will append `'log'` here to ensure it's picked up by generic thought processors, or create a new dedicated array `LOG_ARCHETYPE = ['log']`.

```typescript
export type NoteArchetype = 'note' | 'idea' | 'todo' | 'reminder' | 'meeting' | 'bug' | 'expense' | 'journal' | 'log';

export type NoteClass = 'ACTIONABLE' | 'EVENT' | 'ISSUE' | 'REMINDER' | 'DESCRIPTIVE' | 'FINANCIAL' | 'METRIC';
```

### B. Metadata Structure (`NoteMetadata`)
Currently, `NoteMetadata` implements a loose catch-all `[key: string]: unknown;`. Mixing top-level metadata properties (like `color`, `priority`) with dynamic log keys (like `systolic`, `wind_speed`) runs the risk of collisions and complicates UI iteration. 
The most robust approach is to nest dynamic log data under a specific dictionary key, e.g. `log_data` or `metrics`.

```typescript
export interface NoteMetadata {
  // ... existing fields ...
  
  // --- LOG SPECIFIC FIELDS ---
  /**
   * Container for dynamic key-value tracking pairs.
   * e.g., { systolic: 120, diastolic: 80, o2: 98, unit: 'mmHg' }
   */
  log_metrics?: Record<string, string | number | boolean | null>;
  
  [key: string]: unknown;
}
```

## 2. THE DATABASE (Dexie & Supabase)

### A. Dexie (`frontend/src/lib/db.ts`)
**Zero Migrations Required.**
The `notes` table schema in Dexie v68 stores complex JavaScript objects using IndexedDB's native structural cloning.
```javascript
notes: 'id, supplier_id, project_id, client_id, deal_id, list_id, organization_id, type, status, due_date, sort_order, phase_id, assigned_to, is_pinned, is_archived, is_deleted, syncStatus, updated_at, behavior_class, [project_id+type], ...'
```
Because `metadata` is not an indexed key, and because `behavior_class` and `archetype` are just string fields inside the object (or standard indexed strings), Dexie does not require a version bump to accept `{ archetype: 'log', behavior_class: 'METRIC', metadata: { log_metrics: {...} } }`.

**Universal Archetype Mutation Engine (`db.ts`):** 
The existing payload proxy (`enforcePhaseTaskMutation`) defaults unknown archetypes assigned to phases into `todo`. We will need to whitelist `log` (or `behavior_class === 'METRIC'`) alongside `meeting` and `expense` to ensure logs aren't accidentally mutated into tasks when linked to a project phase!

### B. Supabase (Remote Postgres)
**Zero Migrations Required.**
The `metadata` column on the remote `notes` table is already defined as `JSONB`. Supabase JSONB natively supports inserting nested dictionaries like `log_metrics`.

## 3. COMPONENT ARCHITECTURE (`<LogItem />`)

We will introduce a dedicated UI component to elegantly render the dynamic Key/Value pairs, visually distinct from text-heavy notes or checkbox tasks.

### A. Component Signature
```tsx
import { Note } from '@/types/crm';

interface LogItemProps {
  note: Note;
  onClick?: (note: Note) => void;
  isCompact?: boolean;
}

export function LogItem({ note, onClick, isCompact }: LogItemProps) {
  // Component implementation...
}
```

### B. Internal Structure & Fallback
The `LogItem` will map over the `metadata.log_metrics` object. 

```tsx
// Inside LogItem.tsx
const metrics = note.metadata?.log_metrics || {};
const metricKeys = Object.keys(metrics);

<div 
  onClick={() => onClick?.(note)} 
  className="..." // Base card styling (matches NoteItem)
>
  {/* Header: Title and Time/Date */}
  <div className="flex justify-between">
     <h3>{note.title || 'Log Entry'}</h3>
     <span>{format(new Date(), 'HH:mm')}</span>
  </div>

  {/* Metrics Grid */}
  {metricKeys.length > 0 ? (
     <div className="mt-2 flex flex-wrap gap-2">
       {metricKeys.map(key => (
         <div key={key} className="bg-slate-800 rounded px-2 py-1 text-xs">
           <span className="text-slate-400 capitalize mr-1">{key}:</span>
           <span className="text-white font-mono font-medium">{String(metrics[key])}</span>
         </div>
       ))}
     </div>
  ) : (
    /* Fallback if a log was created but no metrics were provided */
    <div className="text-slate-500 text-sm mt-1">{note.content ? '(Contains text notes)' : 'Empty log'}</div>
  )}
</div>
```

## Summary of Actionable Next Steps (When Execution is Authorized):
1. **Types:** Expand `NoteArchetype`, `NoteClass` and `NoteMetadata` in `crm.ts`.
2. **Utils:** Update `ARCHETYPE_TO_CLASS` mappings in `noteUtils.ts` (if applicable) and explicitly protect `log` from being mutated into a task by the `db.ts` Mutation Engine.
3. **UI:** Build the `<LogItem />` and wire it into the `NoteGroup` rendering pipeline.
