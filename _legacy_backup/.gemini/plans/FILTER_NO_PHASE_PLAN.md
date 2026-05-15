# 🐺 NO PHASE FILTER PLAN

**Objective**: Implement a "No Phase" filter to the existing Time Tracker UI to isolate entries without a phase, aiding in bulk-link operations.

## 1. Data Layer Hook (`frontend/src/hooks/useTracker.ts`)
The filtering logic occurs in `useTracker.ts`. The `orphanFilters` array is used to filter out entries.

**File:** `frontend/src/hooks/useTracker.ts`

- Add `no-phase` support to `hasOrphanFilters`:
  ```typescript
  const hasOrphanFilters = orphanFilters.includes('no-project') || orphanFilters.includes('no-client') || orphanFilters.includes('no-phase');
  ```
- Identify the missing phase filter:
  ```typescript
  const missingProject = orphanFilters.includes('no-project') && !e.project_id;
  const missingClient = orphanFilters.includes('no-client') && !trackClientId;
  const missingPhase = orphanFilters.includes('no-phase') && !e.phase_id;
  ```
- Change the fallback exit check to include `missingPhase`:
  ```typescript
  if (!(missingProject || missingClient || missingPhase)) {
      return false;
  }
  ```

## 2. Presentation Layer (`frontend/src/components/TimeTrackerPage.tsx`)
In `TimeTrackerPage.tsx` the `orphanFilters` options are presented via an `<option>`-like div layout inside the dropdown menu (around line ~310-340).

**File:** `frontend/src/components/TimeTrackerPage.tsx`

- Inject a new `no-phase` filter toggle item matching the custom UI style underneath the `no-client` block, reusing the same strict propagation shield `e.stopPropagation()` and `e.preventDefault()`.

```tsx
<div 
    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors group"
    onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOrphanFilters(prev => 
            prev.includes('no-phase') ? prev.filter(f => f !== 'no-phase') : [...prev, 'no-phase']
        );
    }}
>
    <span className="text-sm font-medium text-slate-200 group-hover:text-white">No Phase</span>
    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
        orphanFilters.includes('no-phase') 
            ? 'bg-indigo-500 border-indigo-500' 
            : 'bg-slate-950 border-slate-700'
    }`}>
        {orphanFilters.includes('no-phase') && <Check size={14} className="text-white" />}
    </div>
</div>
```

## 3. Deployment constraints
- It is a purely read/filter modification and does not mutate any `TimeEntry` states.
- Follows the Atomic File Protocol. Execute `useTracker.ts` and `TimeTrackerPage.tsx` adjustments exactly as laid out.
