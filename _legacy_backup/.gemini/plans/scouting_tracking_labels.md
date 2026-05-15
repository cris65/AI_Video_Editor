# 🔍 Scouting Report: Missing Vendor/Resource Labels in Project Tracker

## 1. The Components Involved

- **Project Data Fetcher**: `frontend/src/hooks/useProjectDetails.ts` relies on Dexter (`db.timeEntries`) to fetch the list of time entries linked to the specific project.
- **Tracker Component List**: `frontend/src/components/projects/ProjectTracking.tsx` receives the data and renders the list using the `TimeEntryItem` component.
- **Micro-Component**: `frontend/src/components/tracker/TimeEntryItem.tsx` handles the display of each individual time block, verifying the presence of relational fields (`entry.suppliers`, `entry.external_resources`, `entry.clients`, `entry.projects`) to mount the colored badges.

## 2. Root Cause of the Discrepancy

Both the Calendar Hub, Timeline, and Global Tracker correctly join external metadata before serving the arrays, meaning `useCalendarAggregator.ts` and `useTracker.ts` both query peripheral tables (e.g., `db.suppliers`, `db.contacts`) and manually append these properties to a `TimeEntryWithData` type payload.

However, the local-first fetch loop inside `useProjectDetails.ts` (specifically the `liveEntries` query) is acting as a raw data pipe:

```typescript
// Current Implementation in useProjectDetails.ts
const liveEntries = useLiveQuery(async () => {
    if (!normalizedId) return [];

    const entries = await db.timeEntries
        .where('project_id')
        .equals(normalizedId)
        .filter(e => !e.is_deleted)
        .toArray();
    
    // MISSING: Relationship Object Mapping (Suppliers, Resources, Clients)

    return entries.sort(...);
}, [normalizedId]);
```

Because `TimeEntryItem` receives naked database clones, `entry.suppliers` and `entry.external_resources` are inherently `undefined`. As a result, the JSX responsible for rendering the Chip Vendor and Chip Resource naturally collapses.

## 3. How to Patch (The Implementation Plan)

To fix this discrepancy, we need to port the exact `Mapped Deduplication` logic from `useTracker.ts` down into `useProjectDetails.ts`'s `liveEntries` hook.

### Step-by-Step Execution:

**Step 1: Pull Secondary Tables**
Inside `liveEntries` in `useProjectDetails.ts`, we must load the required relational arrays globally before iterating (this is very fast in Dexie due to memory caching).

```typescript
const projects = await db.projects.toArray();
const clients = await db.clients.toArray();
const suppliers = await db.suppliers.toArray();
const externalResources = await db.externalResources.toArray();
const contacts = await db.contacts.toArray();
```

**Step 2: Hydrate Individual Records via Mapped Objects**
We map the raw Dexie entries exactly as `useTracker` does:
```typescript
const mappedEntries = entries.map(e => {
    // 1. Resolve Hierarchy
    const p = projects.find(proj => String(proj.id) === String(e.project_id));
    const c = clients.find(cl => String(cl.id) === String(e.client_id || p?.client_id));
    
    // 2. Resolve Vendors (Cascade via Local Record -> Project Fallback)
    const resolvedSupplierId = e.supplier_id || (p?.project_suppliers && p.project_suppliers.length > 0 ? p.project_suppliers[0].supplier_id : (p?.supplier_id || null));
    const s = resolvedSupplierId ? suppliers.find(sup => String(sup.id) === String(resolvedSupplierId)) : null;
    
    // 3. Resolve Resources (Legacy External vs New Contacts Structure)
    const er = e.external_resource_id ? externalResources.find(res => String(res.id) === String(e.external_resource_id)) : null;
    const ct = e.external_resource_id ? contacts.find(con => String(con.id) === String(e.external_resource_id)) : null;
    
    let resourceName = undefined;
    if (er) resourceName = er.name;
    else if (ct) {
        const localCt = ct as any;
        resourceName = localCt.name || `${localCt.first_name || ''} ${localCt.last_name || ''}`.trim();
    }

    // 4. Mount and return enriched DTO
    return {
        ...e,
        projects: p ? { id: p.id, name: p.name, color: p.color || undefined, client_id: p.client_id } : null,
        clients: c ? { name: c.name, color: c.color || undefined } : null,
        suppliers: s ? { name: s.name, color: s.color || undefined } : null,
        external_resources: resourceName ? { name: resourceName } : null,
    };
});
```

**Step 3: Preserve Sorting**
Instead of sorting the raw Array and returning it, sort the `mappedEntries` array to maintain UI chronological accuracy.

By ensuring `useProjectDetails.ts` mirrors this hydration step natively, `TimeEntryItem` will parse `entry.suppliers` correctly and conditionally render the `@ COOP LUCE` vendor and resource badges seamlessly inside the Tracking Tab.
