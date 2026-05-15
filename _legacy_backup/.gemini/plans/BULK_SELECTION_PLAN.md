# WOLF-PROTOCOL: BULK SELECTION ENGINE PLAN 🚨

## 1. State Management Strategy
**Chosen Strategy:** Local Component State (`React.useState`) at the Page level (`ThoughtsPage`, `TasksPage`, `TimeTrackerPage`).

- **Implementation:** `const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());`
- **Why Local State?** Bulk selections are inherently ephemeral. They should not persist across route changes, nor do they require global Sync Engine (Dexie/Supabase) persistence. Injecting this into a global context (like Zustand) could cause unnecessary re-renders across the app.
- **Data Flow:** `selectedIds` and a `toggleSelection(id: string)` callback will be passed down from the Page -> `NoteGroup` -> `NoteItem`/`TimeEntryItem` as props.

## 2. UI Integration & Interaction Architecture
**Component Injection:** Checkboxes will be injected as the very first element (left-most) in the flex-container of `NoteItem`, `NoteRow`, and `TimeEntryItem`.

**The Propagation Shield (Crucial!):**
To ensure Checkboxes do not accidentally trigger Note Editor modals (`onEdit`) or Drag-and-Drop operations (`@dnd-kit`), the checkbox trigger must use specific event stoppers.
Since `@dnd-kit` heavily relies on Pointer Events, using only `onClick` might not be enough.
- **Strategy:** Wrap the checkbox in a container with a complete event-cancellation shield:
  ```tsx
  <div 
     onClick={(e) => { e.stopPropagation(); toggleSelection(note.id); }}
     onPointerDown={(e) => e.stopPropagation()} // Overrides DND-kit sensors 
     onMouseDown={(e) => e.stopPropagation()}
  >
     <Checkbox isChecked={selectedIds.has(String(note.id))} />
  </div>
  ```

## 3. Floating Action Bar (FAB) Layout
**Mounting Strategy:** `createPortal(<BulkSelectionFAB />, document.body)` 
- Portalling ensures the FAB is completely detached from localized CSS overflow restrictions or sticky stacking contexts.

**Semantic Z-Index:** `z-dropdown` (`z-[1000]`)
- *Why?* Based on `tailwind.config.js`, the list view and headers use `z-ui` (100) or `z-floating` (500). `z-dropdown` (1000) keeps the FAB floating clearly over lists and standard UI but specifically keeps it *below* `z-app-modal` (5000) and `z-system-modal` (10000), meaning if a user clicks an action that opens a Confirm Delete Modal, the Modal will physically render above the FAB as required.

**Structural Layout:**
- **Placement:** Bottom-center anchored (`fixed bottom-8 left-1/2 -translate-x-1/2`).
- **Styling:** Pill-shaped, high-contrast. `bg-slate-900 border border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.2)] rounded-full px-6 py-3 flex items-center gap-6`.
- **Actions Included:**
  1. **Selection Counter:** "X Selected"
  2. **Select All List / Deselect** (Optional depending on scope context)
  3. **Bulk Archive** (Amber icon)
  4. **Bulk Transmute/Promote** (Indigo icon)
  5. **Bulk Delete** (Red icon)
  6. **Clear Selection (X)** to close the FAB and empty the Set.

## 4. Specific Component Modification Hitlist
1. **List Views:** (To hold state and map the portal)
   - `frontend/src/components/ThoughtsPage.tsx`
   - `frontend/src/components/TasksPage.tsx`
   - `frontend/src/components/TimeTrackerPage.tsx`
2. **Intermediate Groups:** (To drill props down)
   - `frontend/src/components/notes/NoteGroup.tsx`
3. **Target Row Components:** (To render the checkbox logic)
   - `frontend/src/components/notes/NoteItem.tsx` (Main DND target)
   - `frontend/src/components/notes/NoteRow.tsx` (If used locally)
   - `frontend/src/components/tracker/TimeEntryItem.tsx`
4. **New Core UI Component:**
   - `frontend/src/components/ui/BulkSelectionFAB.tsx` (New file)

---
**HALT:** Awaiting Tech Lead review and execution approval.
