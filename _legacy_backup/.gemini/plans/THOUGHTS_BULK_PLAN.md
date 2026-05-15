# 🐺 WOLF-PLAN: Bulk Selection Engine for Thoughts/Notes

## 1. Architectural Objective
Port the `BulkSelectionEngine` (developed for `TimeTrackerPage`) to the Note rendering ecosystem (`ThoughtsPage.tsx`, `TasksPage.tsx`, and `NoteItem`). This will enable batch operations (Soft Delete, Project/Phase Linking, List Linking) on notes and tasks without breaking the existing `@dnd-kit` drag-and-drop hierarchy or the click-to-edit interactions.

## 2. State Drilling Path
The state is managed at the top-level Page components to power the `BulkSelectionFAB` portal, safely drilling down through the architectural layers.

1. **Page Level (`ThoughtsPage.tsx` / `TasksPage.tsx`):**
   - Implement `useState<Set<string>>(new Set())` to hold `selectedIds`.
   - Render the `<BulkSelectionFAB />` if `selectedIds.size > 0`.
   - Implement `onToggleSelection` to manage the Set exactly like `TimeTrackerPage`.
   - Pass both into the `NoteGroup` mapping.

2. **Group Level (`NoteGroup.tsx` - `NoteGroup` Component):**
   - Add `selectedIds?: Set<string>` and `onToggleSelection?: (id: string) => void` to `NoteGroupProps`.
   - Pass them verbatim to the `SortableNoteItem` instance during the `currentVisualList.map(...)` iteration.

3. **Decorator Level (`NoteGroup.tsx` - `SortableNoteItem` Component):**
   - Extract and pass the properties down to the bare `<NoteItem />`.
   - *Shield Constraint:* `SortableNoteItem` captures `onPointerDownCapture` to prevent drag loops during menu clicks. The Checkbox must be placed explicitly within a container shielded from this drag capture.

4. **Leaf Level (`NoteGroup.tsx` - `NoteItem` Component):**
   - Consume the state (`const isSelected = selectedIds?.has(String(note.id));`).

## 3. UI Placement & Event Shielding (The Checkbox)
The Checkbox must be natively injected into the inline `NoteItem` component (lines 235-245 mapping) without compromising the `@dnd-kit` hitboxes or the root click-to-edit listener.

**Placement:** Inside the primary `flex justify-between items-start gap-3` block, immediately before the flex-1 content block.

**Crucial Propagation Shielding:**
Because the parent `<div>` has an `onClick={() => onEdit(note)}`, the checkbox wrapper MUST execute both `stopPropagation` and `preventDefault` correctly:
```tsx
<div 
   onPointerDown={(e) => { 
       e.stopPropagation(); // Blocks @dnd-kit sensor capture
       onToggleSelection?.(String(note.id)); 
   }}
   onClick={(e) => e.stopPropagation()} // Blocks onEdit trigger
   className="shrink-0 flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors cursor-pointer mr-2 mt-0.5 z-10"
>
    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 bg-slate-900'}`}>
        {isSelected && <Check size={12} className="text-white" />}
    </div>
</div>
```

## 4. Database Mutation Strategies (Bulk Actions)
All mutations must occur inside explicit Dexie transactions wrapped with `try/finally` blocks ensuring UI clearance.

### A. Bulk Soft Delete
- Target: `db.notes`
- Strategy: Identify the notes to delete via `.where('id').anyOf([...selectedIds])`.
- Mutation: `modify({ is_deleted: true, syncStatus: 'pending_update', updated_at: nowISO() })`
- *Architectural Notice:* As patched in `syncNotes.ts` during a prior update, the Orchestrator respects `is_deleted: true` explicitly when `pending_update` is flagged.

### B. Bulk Project/Phase Link
- Target: `ProjectPickerModal`
- Strategy: Smart context extraction. If `selectedIds` share the same `project_id`, pass it to the Modal to prepopulate the scope. Wait for the `onBulkAssign(projectId, phaseId)` callback.
- Mutation: `modify({ project_id: projectId, phase_id: phaseId || null, syncStatus: 'pending_update', updated_at: nowISO() })`

### C. Bulk List Assignment
- Target: `<ListPicker />` or an action sheet.
- Mutation: `modify({ list_id: targetListId, syncStatus: 'pending_update', updated_at: nowISO() })`

## 5. Verification Plan
- [ ] No ghost drags triggered when clicking the checkboxes.
- [ ] UI accurately clears the FAB when operations complete.
- [ ] Zero ESLint typescript warnings using proper generic sets (`Set<string>`). 
