# 🐺 WOLF-ALERT: Global Rename Propagation Plan

## 1. Identify the Rename Trigger
The renaming of entities currently occurs within the Service layer to ensure total encapsulation before interacting with Dexie:
- `ProjectService.update`
- `ClientService.updateClient`
- `ExternalResource` / `Supplier` updates (via their respective services)

**Plan:** Instead of catching updates inside individual UI components (`ProjectModal`, etc.), we will inject the propagation logic directly into the Service layer (or via a dedicated `PropagationService.ts` called immediately after a successful entity `update()`). This guarantees that whether the rename is triggered by a modal, a bulk action, or a sync hook, the propagation always runs.

## 2. Create the Propagation Service (`PropagationService.ts`)
We will create a centralized utility dedicated to traversing and mutating denormalized JSON payloads.

**Flow:**
1. Upon an entity rename, the service receives `(entityType, entityId, newName)`.
2. It fetches the relevant entities (`db.notes` and `db.timeEntries`) that contain Tiptap JSON in their `content` or `notes` fields.
3. We will implement a pure, recursive function `updateMentionLabels(node: TipTapNode, targetId: string, newName: string)`:
   - It will traverse `node.content` and `node.marks`.
   - If it encounters a custom node/mark representing the mention (where `attrs.id === targetId`), it will update `attrs.label = newName`.
   - If the mention's inner `text` also contains the old name, it updates that as well.

## 3. Efficiency Check (Lightning-Fast Lookup)
Parsing every single JSON object for every row in Dexie could be heavy.
**Optimized Approach (The "Includes" Pre-filter):**
Instead of a full schema migration to add `*mentioned_ids` (which would require bumping Dexie to v70 and a massive re-indexing script), we can leverage a blazing-fast string match pre-filter:
```typescript
// Rapidly filter out 99% of notes that don't even contain the UUID string
const relevantNotes = await db.notes.filter(note => {
    if (!note.content) return false;
    return JSON.stringify(note.content).includes(targetId);
}).toArray();
```
Once the subset is isolated, we parse only those JSON objects, apply the recursive update, and push the changes. This avoids schema migrations while remaining extremely fast on the client side.

## 4. Sync Integration
When the JSON is modified, the service will update the records in Dexie by setting:
```typescript
{
    content: mutatedContent,
    syncStatus: existing.syncStatus === 'pending_create' ? 'pending_create' : 'pending_update',
    updated_at: new Date().toISOString(),
    lastUpdated: Date.now()
}
```
By doing this inside a `db.transaction('rw', [db.notes, db.timeEntries])`, we ensure atomic local saves. The `SyncOrchestrator` will automatically detect the `pending_update` flags and push the corrected JSON blobs to Supabase.

---
**Status:** Awaiting PM approval to proceed with execution.
