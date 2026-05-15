# 🚨 INLINE EDITING MASTER PLAN (SCOUTING MISSION 3)

## 1. Goal and Objectives
The objective is to allow users to contextually edit an entity (Client, Project, Stakeholder) directly from within a selector modal (Picker) without losing their current workflow context. This requires intercepting the user's focus, opening an isolated editor overlay, capturing the mutated data, and seamlessly updating the underlying picker list upon return.

## 2. Recommended Architectural Approach
**Chosen Approach: Option A - Stacking Modals (Z-Index Teleportation)**

### Why Option A?
After analyzing `ClientPickerModal.tsx` and `ProjectPickerModal.tsx`, it is clear that the "Stacking Modals" paradigm is already natively supported and successfully utilized for the **creation** flows (e.g., `isCreateOpen` triggering `<ClientModal>`). 
- **View Swapping (Option B)** would require heavily refactoring the internal rendering logic of the mature Pickers and stripping the standalone modals of their backdrops.
- **URL-Routing (Option C)** would destroy the ephemeral state of the parent form where the user triggered the picker, violating the requirement of "no data lost during the interruption."

By using Stacking Modals via `createPortal`, Option A allows the `ClientModal` (or `ProjectModal`) to physically render outside the Picker's DOM hierarchy but stack visually above it using the global semantic z-index scale (e.g., `z-system-modal` for the Picker and `z-app-modal` or `z-[14000]` for the Editor).

## 3. UI State Management
To guarantee that no data or context is lost during the interruption, the state will be managed entirely within the Picker component:

1. **State Hook:** Introduce a nullable state variable to track the item being edited:
   ```tsx
   const [itemToEdit, setItemToEdit] = useState<Entity | null>(null);
   ```
2. **Component Lifecycle:** When `itemToEdit` is set, conditionally render the target modal (e.g., `<ClientModal>`) exactly as we do for creation, but passing the `itemToEdit` via the established props (e.g., `clientToEdit={itemToEdit}`).
3. **Data Hydration:** The underlying Picker's items are hydrated via Dexie `useLiveQuery` streams. When the inner Editor Modal calls its `onSave` equivalent or directly commits to the database/Orchestrator, closing the Modals will instantly reveal the Picker underneath, which will have already auto-refreshed via the Dexie local-first subscription.
4. **Resiliency:** The parent form that launched the Picker remains completely isolated safely beneath the Picker. 

## 4. UI Placement & UX Flow
The Edit button will be seamlessly injected into the existing mapping of the list items inside the Pickers:

- **Location:** A discreet pencil icon (`<Pencil size={16} />`) mapped to the far right of each list item row, replacing or sitting adjacent to the `<Check />` icon used for active selection.
- **Interaction Hijacking:** The Edit button MUST implement `e.stopPropagation()` on its `onClick` event. This is critical to prevent the event from bubbling up to the `button` container, which would incorrectly trigger the `onSelect()` callback and prematurely close the Picker without editing.
- **Aesthetic:** It will use subtle styling (`text-slate-400 hover:text-white transition-colors p-2 rounded-md hover:bg-slate-700/50`) to remain unobtrusive until hovered.

## 5. Execution Target Audit
This strategy will be sequentially applied to:
1. `ClientPickerModal.tsx`
2. `ProjectPickerModal.tsx`
3. `ContactPickerModal.tsx`
4. `StakeholderPickerModal.tsx`
5. `InlineResourcePicker.tsx` (If applicable)

### 🛑 STOP FOR TECH LEAD REVIEW
Awaiting approval of `INLINE_EDITING_PLAN.md` before executing any codebase mutations.
