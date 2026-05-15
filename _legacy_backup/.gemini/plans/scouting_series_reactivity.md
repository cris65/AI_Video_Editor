# Scouting Report: Series Reactivity & Card Display Bug

## Executive Summary

Two separate architectural failures were identified. Neither requires a schema change. Both are precision-layer fixes.

---

## Bug 1: Card Display (Minor — Confirmed Non-Issue)

**Finding:** After the `/wolf_flow` v0.7.57 math fix, the `formatDuration(entry.duration)` rendering in `TimeEntryItem.tsx` (Line 286) is now **correct**. The duration is sourced from `entry.duration` (seconds stored in Dexie), and the rounding fix in `useSettings.ts` resolves the display problem.

**Caveat:** If the card is still showing a truncated display after v0.7.57 deploys, clear the local Dexie cache. Old entries that were saved *before* the math fix still carry their raw `3590`s value — the display will now show `1h 0m` once the formatter rounds.

---

## Bug 2: Series Reactivity Failure (Critical — UI Desync)

### The Architecture

Editing a recurring entry takes this path:

1. `TimeEntryItem.tsx` detects a ghost → calls `onGhostAction(ghost, 'edit')`
2. `TimeTrackerPage.tsx` → `handleGhostAction()` → loads template from Dexie → opens `RecurrenceChoiceDialog`
3. User selects **"The entire series"** → `onEntireSeries()` is called
4. `TimeTrackerPage.tsx` calls `actions.handleEditEntry(template)` → navigates to `/tracker/<templateId>`
5. `TimeEntryModal` opens with the template. User edits and saves.
6. `handleSave()` calls `backgroundRefresh()` (Line 637 in `TimeEntryModal.tsx`).

### The Missing Invalidation: `backgroundRefresh` only targets `['tracker']` and `['dashboard']`

**File:** `frontend/src/components/tracker/TimeEntryModal.tsx` | Lines 260–264
```tsx
const backgroundRefresh = () => {
  queryClient.invalidateQueries({ queryKey: ['tracker'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  syncPendingData();
};
```

**The Architecture Mismatch:**
The `useTracker.ts` hook (`liveEntriesFromDb` at Line 171) is powered by **`useLiveQuery` from Dexie-react-hooks**, NOT by a React Query `['tracker']` key.

`useLiveQuery` listens directly to Dexie's internal change events. When `db.timeEntries.put()` mutates a record, `useLiveQuery` **should** trigger reactivity automatically.

### The Real Root Cause: The Rubber-Band Anti-Echo Shield blocks the Series Update

**File:** `frontend/src/hooks/useTracker.ts` | Lines 119–124
```typescript
// SE C'È UNA MODIFICA LOCALE IN ATTESA, IL SERVER DEVE ASPETTARE! 
if (existing.syncStatus === 'pending_update' || existing.syncStatus === 'pending_create') {
    console.log(`🛡️ [SYNC-SKIP] Eco di rete bloccato. Il record locale ha priorità: ${idStr}`);
    continue;
}
```

When the Tech Lead saves the template series:
1. `handleSave()` sets `syncStatus: 'pending_update'` on the template entry in Dexie. ✅ `useLiveQuery` triggers immediately — the local Tracker List **does** reactively update.
2. `syncPendingData()` fires in the background, pushing the change to Supabase.
3. On success, the Sync Engine returns the updated record from the server.
4. The `syncLocal()` effect in `useTracker.ts` skips the remote record because its `syncStatus` is still `'pending_update'` at the time of the server echo.

**This is actually CORRECT behavior for the local list.** The UI _should_ be updating from Dexie reactivity.

### Re-scoped Hypothesis: Calendar Desync is the Real Bug

The **Calendar** (`CalendarHub.tsx`) uses a completely separate data hook: `useCalendarAggregator`. It may NOT be subscribed to the same `useLiveQuery` pipeline as `useTracker`.

**File:** `frontend/src/components/CalendarHub.tsx` | Line 33
```tsx
import { RecurrenceChoiceDialog } from './tracker/RecurrenceChoiceDialog';
```

The `onEntireSeries` handler in `CalendarHub.tsx` appears around line 943. If it calls `handleEditEntry` but doesn't force a re-query of calendar entries after the modal closes, the Calendar view stays stale.

**Predicted flaw in CalendarHub:** The `onSuccess` prop is not being passed to `TimeEntryModal` when editing a series template from the Calendar, so after the save, the Calendar's `useCalendarAggregator` or equivalent hook is NOT invalidated.

---

## Proposed Fixes

### Fix 1: Ensure `backgroundRefresh` in TimeEntryModal also invalidates the calendar query

If `CalendarHub.tsx` uses a named React Query key (e.g., `['calendar']`), add it to `backgroundRefresh`:
```tsx
const backgroundRefresh = () => {
  queryClient.invalidateQueries({ queryKey: ['tracker'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  queryClient.invalidateQueries({ queryKey: ['calendar'] });  // ADD THIS
  syncPendingData();
};
```

### Fix 2: Audit CalendarHub's `onEntireSeries` callback

In `CalendarHub.tsx` around line 943, verify that the `RecurrenceChoiceDialog`'s `onEntireSeries` path triggers a full data invalidation of the calendar query after the modal saves. If `onSuccess` is not wired, the Calendar never re-renders.

---

## Action Items

1. **(READ-ONLY NEEDED):** View `CalendarHub.tsx` lines 490–960 to confirm the exact query key name used for calendar data and verify `onSuccess` is passed to `TimeEntryModal`.
2. Once confirmed, apply `queryClient.invalidateQueries({ queryKey: ['calendar'] })` inside `backgroundRefresh()` in `TimeEntryModal.tsx`.
