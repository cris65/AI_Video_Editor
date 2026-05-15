# 🚨 Z_INDEX_MASTER_PLAN (SCOUTING MISSION 1)

## 1. Goal and Objectives
The codebase currently relies on arbitrary `z-[X]` utilities like `z-[11000]`, `z-[99999]`, and `z-40`, creating a brittle and unpredictable UI hierarchy (the "z-index arms race"). This plan outlines to permanently replace all rogue absolute `z-indexes` with the strictly controlled Semantic Scale defined in `tailwind.config.ts` (`z-base`, `z-ui`, `z-floating`, `z-dropdown`, `z-tooltip`, `z-app-modal`, `z-system-modal`, `z-notification`, `z-god`).

## 2. Risk Mitigation & Hierarchy Traps
**The Core Risk:** 
If a base element like `z-dropdown` (1000) is rendered *outside* of an active modal via a global portal (`document.body`), it will render **BEHIND** `z-app-modal` (5000) or `z-system-modal` (10000). 
To mitigate nested context breakage:
1. **Modals Spawning Modals:** Primary feature modals (`NoteModal`, `TasksPage` fullscreen overlays) will map to `z-app-modal` (5000). Nested configurations (like `ExportModal`, `ContactPickerModal`, `PhaseModal`) will step up to `z-system-modal` (10000) to safely overlap.
2. **Context-bound Dropdowns:** Tooltips and Select Dropdowns used inside Modals will either inherit the parent's `z-app-modal` stacking context naturally (if inline), or must be mounted to a target portal *inside* the modal component rather than jumping entirely out to `body`.
3. **The "Arms Race" Reset:** Elements like drag-and-drop ghost layers will no longer use `z-[99999]` but will securely map to `z-god` (100000) or `z-floating` (500) based on their necessary visibility across layouts.

## 3. Transformation Strategy (File-by-File Mapping)

### Primary Modals & Overlays
| File | Component Context | Current Rogue Class | Target Semantic Class |
| :--- | :--- | :--- | :--- |
| `NoteModal.tsx` | Main content / container | `z-[11000]` (Base) | `z-app-modal` (5000) |
| `NoteModal.tsx` | Mobile action drawer | `z-[11005]` / `z-[90]` | Relative inheritance (No raw `z-`) |
| `TasksPage.tsx` | Modal Backdrop | `z-[11000]` | `z-app-modal` (5000) |
| `ProjectDetailsPage.tsx` | Fullscreen Overlays (Zen) | `z-[10000]` | `z-app-modal` (5000) |

### Nested Modals (Must layer above `z-app-modal`)
| File | Component Context | Current Rogue Class | Target Semantic Class |
| :--- | :--- | :--- | :--- |
| `ExportModal.tsx` | Export Configuration | `z-[12000]` | `z-system-modal` (10000) |
| `TransformerModal.tsx` | AI Transform Modal | `z-[14000]` | `z-system-modal` (10000) |
| `PhaseModal.tsx` | Nested Phase Editor | `z-[12000]` | `z-system-modal` (10000) |
| `RecurrenceChoiceDialog.tsx` | Deletion/Edit Prompt | `z-[11000]` | `z-system-modal` (10000) |

### Pickers & Utilities
*(Pickers operate as temporary modals or fullscreen lists over app layers)*
| File | Component Context | Current Rogue Class | Target Semantic Class |
| :--- | :--- | :--- | :--- |
| `ContactPickerModal.tsx` | Contact Picker | `z-[99999]` (or similar) | `z-system-modal` (10000) |
| `ProjectPickerModal.tsx` | Project Select Modal | `z-[99999]` (or similar) | `z-system-modal` (10000) |
| `TasksPage.tsx` | Mobile Drag Ghost | `z-[99999]` | `z-god` (100000) |
| `ThoughtsPage.tsx`| Drag Ghost | `z-[99999]` | `z-god` (100000) |

### Structural UI Elements
| File | Component Context | Current Rogue Class | Target Semantic Class |
| :--- | :--- | :--- | :--- |
| `ProjectDetailsPage.tsx` | Sticky Headers | `z-10` / `z-20` / `z-30` / `z-40` | `z-ui` (100) |
| `NoteModalTitle.tsx` | Header container | `z-20` | `z-ui` (100) or Inherit |
| `NoteModalFooter.tsx` | Footer Actions | `z-40` | `z-ui` (100) or Inherit |
| `ResourceCard.tsx` | Inner Header | `z-10` | Relative inheritance |

## 4. Execution Directives
- **Zero Arbitrary Values**: All `.replace(/z-\[?\d+\]?/g, 'z-{semantic}')` will be strictly executed according to the mappings.
- **Linter Enforcements**: Post-refactor, verify via local dev server to ensure `z-app-modal` strictly contains inner interactions without truncating dropdowns.
- **Portals Audit**: If tests reveal UI layer issues (like a dropdown hidden inside `NoteModal`), we will dynamically correct the portal target `document.getElementById('modal-root')` instead of breaking the z-index scale.

### 🛑 STOP FOR TECH LEAD REVIEW
Awaiting approval of `Z_INDEX_MASTER_PLAN.md` before executing any codebase mutations.
