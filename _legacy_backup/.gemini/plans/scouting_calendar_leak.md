# 🔍 Scouting Report: Calendar Workspace Leak & Missing Labels

## Bug 1: Workspace Leak (Inheritance Bug)

### The Root Cause
The `useCalendarAggregator.ts` hook is responsible for fetching all database entities and mapping them into a unified `CalendarItem` interface. However, during the `notes.forEach` block (handling Events, Expenses, and Actionable To-Dos), it entirely omits the `is_personal` property from the resulting objects pushed into the `items` array. 

Because `is_personal` is undefined for all Note-based entities, the filter logic in `CalendarHub.tsx` (`if (!showWork && !isPersonal) return false;`) implicitly treats them all as `WORK` entities. This causes personal tasks and events to leak into the Work workspace view.

Furthermore, unlike Time Tracks, Notes do not have a dedicated `is_personal` column in the database schema. Their workspace context instead natively stems from the project or client they are linked to.

### The Fix Plan
Modify `useCalendarAggregator.ts` to properly resolve and map the `is_personal` boolean for Notes by traversing the relational chain:
1. Lookup the note's intrinsic `is_personal` (if it exists).
2. Fallback to the linked project's `is_personal`.
3. Fallback to the linked client's `is_personal`.
4. Push this resolved boolean explicitly into the `items.push(...)` block for Events, Expenses, and To-Dos.

```typescript
const is_personal = note.is_personal ?? 
                    (note.project_id ? projectMap.get(note.project_id)?.is_personal : 
                    (note.client_id ? clientMap.get(note.client_id)?.is_personal : false));
```

---

## Bug 2: Missing Context Labels

### The Root Cause
The Calendar UI card component, `CalendarBlock.tsx`, relies on the condition `item.entity_type === 'track'` to render the project and client badges. 
While `useCalendarAggregator.ts` *successfully* hydrates `project_name`, `client_name`, and `color` properties for all tasks, events, and expenses, the UI component was artificially suppressing these badges.

### The Fix Plan
In `CalendarBlock.tsx` (around line 385), remove the restrictive `item.entity_type === 'track'` condition from the JSX blocks for the Project and Client chips.

```tsx
// Before (Line ~385):
{item.entity_type === 'track' && item.project_name && (
    <span className="px-1.5 py-0.5 rounded flex items-center...
    
// After:
{item.project_name && (
    <span className="px-1.5 py-0.5 rounded flex items-center...
```

By removing this unneeded gate, all calendar cards (Tasks, Events, Expenses) will correctly adopt the badges they deserve, completing the unified visualization.
