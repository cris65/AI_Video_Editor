# 🚨 SCOUTING REPORT: Project Hours Discrepancy Bug

## 📝 1. The Discrepancy Overview
The Tech Lead reported that the Project List view (and its Project Cards) displays massively incorrect tracked time (e.g., "1689h 47m") compared to the exact same Project's Overview KPI ("TOTAL TRACKED", e.g., "28h 45m"), which correctly displays the true total.

## 🔎 2. Root Cause Analysis
After scanning the architectural data flow, the discrepancy originates in how the `projectStats` dictionary is calculated in parent list views vs how `totalSeconds` is calculated within the individual project data hook.

### The Erroneous Aggregation Pattern
In `frontend/src/components/ProjectsPage.tsx`, `projectStats` is derived globally for all projects:
```typescript
const rawStats = useLiveQuery(async () => {
    const entries = await db.timeEntries.toArray();
    const stats: Record<string, number> = {};
    entries.forEach(e => {
        if (e.project_id) {
            const pid = String(e.project_id);
            stats[pid] = (stats[pid] || 0) + (e.duration || 0);
        }
    });
    return stats;
}, []);
```
**The Flaw:** This blindly maps and sums `e.duration` across *all rows* within `db.timeEntries` without any gating.
It fails to filter out:
1. **Deleted Entries:** `e.is_deleted === true` records are included.
2. **Forecast / RRULE Ghost Entries:** `e.is_done === false` records meant only for calendar forecasts are mathematically injected into the total tracked hours. This is why the totals explode to massive numbers (e.g., decades of future recurring events being summed).

We also confirmed this erroneous pattern repeats in `frontend/src/components/clients/tabs/ClientProjectsTab.tsx` and `frontend/src/components/clients/ClientGlobalMetrics.tsx`.

### The True "Source of Truth" (Correct Pattern)
Inside `frontend/src/hooks/useProjectDetails.ts`, the total is calculated safely:
```typescript
const lifetimeTotalSeconds = allTimeEntries
    .filter(e => e.is_done !== false) // WOLF-FIX: Rejects future forecast ghosts
    .reduce((acc, curr) => acc + (curr.duration || 0), 0);
```
*(Combined with a parent `.filter(e => !e.is_deleted)` on the DB query).*

## 📐 3. Proposed Mathematical Fix
To resolve this, we must enforce the same mathematical gate used in `useProjectDetails.ts` everywhere `projectStats` is aggregated. 

The immediate fix for `ProjectsPage.tsx` must be:
```typescript
const rawStats = useLiveQuery(async () => {
    // 1. Defend against soft deletes at the query layer
    const entries = await db.timeEntries.filter(e => !e.is_deleted).toArray();
    const stats: Record<string, number> = {};
    
    entries.forEach(e => {
        // 2. Defend against Forecasts / RRULE Ghosts at the iteration layer
        if (e.project_id && e.is_done !== false) {
            const pid = String(e.project_id);
            stats[pid] = (stats[pid] || 0) + (e.duration || 0);
        }
    });
    return stats;
}, []);
```

### Affected Files to Patch
The following files must be patched to align to the true Source of Truth:
* `frontend/src/components/ProjectsPage.tsx`
* `frontend/src/components/clients/ClientGlobalMetrics.tsx`
* `frontend/src/components/clients/tabs/ClientProjectsTab.tsx`
* *Anywhere `db.timeEntries.reduce` is performed for global metrics without verifying `is_done !== false` and `!is_deleted`.*
