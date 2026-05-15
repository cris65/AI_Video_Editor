# Project Hub Bulk Selection Architecure

This plan details the implementation of the "Bulk Selection" feature (Checkboxes + Floating Action Bar) specifically within the context of the Project Hub, ensuring the `ProjectTasksTab` and `ProjectNotes` achieve feature parity with the global `/tasks` and `/thoughts` views.

## 1. State Management Architecture

> [!TIP]
> **State Locality is Crucial**
> The `selectedIds` state should **NOT** be lifted to the parent `ProjectDetailsPage.tsx`. Instead, the state must be isolated and managed locally within `ProjectTasksTab.tsx` and `NotesManager.tsx`.

*   **Why localized state?** The tabs completely swap content. If a user selects 3 Tasks in the Task tab, then switches to the Timeline or Notes tab, showing an orphaned FAB with "3 Selected" makes no logical sense. Isolating the state ensures the semantic context of the selection is strictly tied to the data structure currently mounted in the DOM.

## 2. Component Adaptations

### 2.1 Modifications in `ProjectTasksTab.tsx`
*   **Init State:** `const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());`
*   **Handlers:** Implement `toggleSelection(id)` and `clearSelection()`.
*   **Props Injection:** Update the mapping iterators for `<SortableNoteItem>` to inject `selectedIds={selectedIds}` and `onToggleSelect={toggleSelection}`.
*   **FAB Injection:** Import and render `<BulkSelectionFAB>` inside the tab container.
*   **FAB Actions:** 
    *   `onDelete`: Triggers a bulk archive/soft-delete prompt.
    *   `onMove`: Triggers a new (or adapted) modal `PhaseSelectionModal` to bulk-move the selected tasks to a specific Phase within the project. It maps cleanly to the existing generic `onMove` prop showing a `FolderOpen` icon.

### 2.2 Modifications in `NotesManager.tsx` (Used by ProjectNotes)
*   **Context:** `ProjectNotes.tsx` delegates the actual thought mapping to `NotesManager.tsx` (using the `embedded={true}` prop). Thus, the bulk-selection architecture can be enabled natively in `NotesManager.tsx`.
*   **Init State:** Initialize `selectedIds` locally inside `NotesManager.tsx` (similar to how `ThoughtsPage` handles it globally).
*   **Props Injection:** Feed `selectedIds` to the existing `<NoteGroup>` abstractions.
*   **FAB Injection:** Render `<BulkSelectionFAB>` natively. Because `BulkSelectionFAB` utilizes `z-dropdown` dynamically positioned `fixed` to the bottom, it will elegantly hover over the UI even if `NotesManager` is technically rendering inside an embedded container block.

## 3. Reusing `BulkSelectionFAB`

The existing `BulkSelectionFAB` interface is highly generic and fits perfectly into this use-case without structural changes:
```tsx
interface BulkSelectionFABProps {
    selectedCount: number;
    onClear: () => void;
    onDelete?: () => void;
    onLinkProject?: () => void; // We simply OMIT this prop since we are already inside a project.
    onMove?: () => void;        // We USE this to represent "Move to Phase" or "Move to List" internally.
}
```

## User Review Required

> [!IMPORTANT]
> **Phase Move UI**
> When clicking `onMove` inside the `ProjectTasksTab`, we need a UI to select the target Phase. We currently have `PhaseModal.tsx` for creating phases, but we might need a simple `BulkPhaseSelectorModal` (similar to `ProjectPickerModal`) to just execute the target selection. Are you okay with me spinning up a lightweight dropdown modal just for this bulk phase reassignment?

> [!NOTE]
> Please review the `Phase Move UI` question above and provide explicit approval (or requested modifications) before I begin code execution.
