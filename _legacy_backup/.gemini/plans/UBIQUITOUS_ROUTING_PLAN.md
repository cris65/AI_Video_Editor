# 🐺 UBIQUITOUS ROUTING PLAN (See it. Click it. Route it.)

**Objective:** Transform all static entity representation badges and labels scattered throughout the CRM (in list items, notes, time entries, deals) into clickable hyper-links that provide deep navigation directly to their respective detail pages, without breaking any Drag-and-Drop functionality or triggering parent modal clicks.

---

## 1. Architectural Strategy

We will utilize `react-router-dom`'s `useNavigate` hook injected into the presentation components.
Every actionable badge will implement a **Strict Propagation Shield**:
```tsx
const navigate = useNavigate();

const handleEntityRouting = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(path);
};
```
Styling rules for "Routeable Badges": Add `cursor-pointer hover:ring-1 hover:ring-indigo-500 hover:opacity-100 transition-all` to signal interactivity without destructively mutating the existing UI layouts.

---

## 2. Target Component Surface Area

### A. `TimeEntryItem.tsx` (`frontend/src/components/tracker/TimeEntryItem.tsx`)
- **Project Badge (`entry.projects`)**: 
  - Wrap the `div` that renders the Project name. 
  - Add `onClick={(e) => handleEntityRouting(e, '/projects/' + entry.project_id)}`.
- **Client Badge (`entry.clients`)**: 
  - Wrap the `div` that renders the Client name.
  - Target Path: `/clients/${entry.client_id}` or derived from `entry.projects.client_id`.

### B. `NoteItem` inside `NoteGroup.tsx` (`frontend/src/components/notes/NoteGroup.tsx`)
- **Project Link (`linkedProject`)**: 
  - Convert `span` to actionable inline item.
  - Target Path: `/projects/${note.project_id}`
- **Phase Link (`linkedPhase`)**: 
  - Convert `span` into actionable item.
  - Target Path: `/projects/${note.project_id}` (Since Phase management happens inside the Project Hub).

### C. `SortableDealCard.tsx` (`frontend/src/components/deals/SortableDealCard.tsx`)
- **Client Badge (`clientName`)**:
  - Requires the presence of `deal.client_id`. 
  - Target Path: `/clients/${deal.client_id}` 
- **Project Link Badge (`isLinked`)**:
  - Requires the presence of `deal.project_id`.
  - Target Path: `/projects/${deal.project_id}`

---

## 3. Propagation Shielding Checks (CRITICAL)
- **Drag & Drop Collisions**: `SortableDealCard`, `NoteItem`, and `TimeEntryItem` are draggable. `@dnd-kit`'s pointer sensors interpret clicks on children as drag initiation unless explicitly shielded.
- The `onPointerDown` synthetic event might need shielding alongside standard `onClick` and `onMouseDown`.
```tsx
onPointerDown={(e) => e.stopPropagation()}
onClick={(e) => handleEntityRouting(e, `/path`)}
```
*Applying this pointer-event separation ensures a user clicking a badge navigates immediately, instead of lifting the item as a draggable ghost.*

---

## 4. Execution Steps
1. Insert `import { useNavigate } from 'react-router-dom';` in target components.
2. Initialize `const navigate = useNavigate();`.
3. Locate all `span` and `div` elements rendering entity names.
4. Inject the routing handler with strict `e.stopPropagation()` and `e.preventDefault()`.
5. Enhance CSS with `cursor-pointer` and subtle `hover:ring-1 hover:brightness-110`.

*Waiting for Tech Lead approval to proceed with UI modification on the specified surface area.*
