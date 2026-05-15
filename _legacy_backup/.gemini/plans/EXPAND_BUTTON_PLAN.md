# Unified Expand Button Plan

## Goal Description
The current implementation of the "Expand" (Zen Mode) button is inconsistent across different project tabs and overlaps with internal component controls (like the "+ New" button). This plan will unify the visual style to a premium "Pill" design and correctly position the button within the internal toolbars of the child components, eliminating overlap conflicts entirely.

## User Review Required
> [!IMPORTANT]
> The Expand button will be moved *inside* the child components (`ProjectTasksTab`, `ProjectNotes`, `ProjectTimeline`, `ProjectTracking`) to sit neatly next to their respective internal action buttons (like "+ New" or filters). Do you approve of modifying the signatures of these 4 components to accept an `onZenMode` prop?

## Proposed Changes

### Component Signatures & UI Integration
We will update the 4 child components to accept an optional `onZenMode?: () => void` prop.

#### [MODIFY] [ProjectTasksTab.tsx](file:///Users/macbookm4cdv/Development/TimeTrackCrm/frontend/src/components/projects/tabs/ProjectTasksTab.tsx)
- Add `onZenMode` to props.
- Add the unified `<Maximize2>` button to the top-right toolbar, immediately to the left of the "+ New" button.

#### [MODIFY] [ProjectNotes.tsx](file:///Users/macbookm4cdv/Development/TimeTrackCrm/frontend/src/components/projects/ProjectNotes.tsx)
- Add `onZenMode` to props.
- Insert the unified button into the `<div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">` action bar next to the purple "+ New" button.

#### [MODIFY] [ProjectTimeline.tsx](file:///Users/macbookm4cdv/Development/TimeTrackCrm/frontend/src/components/projects/ProjectTimeline.tsx)
- Add `onZenMode` to props.
- Insert the button into the top action bar next to the "ALL" / "PLANNED" filters.

#### [MODIFY] [ProjectTracking.tsx](file:///Users/macbookm4cdv/Development/TimeTrackCrm/frontend/src/components/projects/ProjectTracking.tsx)
- Add `onZenMode` to props.
- Insert the button into the Total Hours header row for a clean layout.

---

### Central Hub Refactoring

#### [MODIFY] [ProjectDetailsPage.tsx](file:///Users/macbookm4cdv/Development/TimeTrackCrm/frontend/src/components/ProjectDetailsPage.tsx)
- Remove all `absolute` positioned `Maximize2` buttons from the `activeTab` rendering blocks.
- Pass the `onZenMode` prop down to the respective child components:
  - `<ProjectTasksTab project={project} onZenMode={() => zen.setTasks(true)} />`
  - `<ProjectNotes projectId={project.id} onZenMode={() => zen.setNotes(true)} />`
  - `<ProjectTimeline ... onZenMode={() => zen.setTimeline(true)} />`
  - `<ProjectTracking ... onZenMode={() => zen.setTracking(true)} />`

## Unified Button Style
The standard button will consistently use:
```tsx
<button 
  onClick={(e) => { e.stopPropagation(); onZenMode(); }} 
  className="p-2 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg border border-slate-700 hover:border-indigo-500 shadow-sm transition-all active:scale-95" 
  title={t('common.expand', 'Expand')}
>
    <Maximize2 size={18} />
</button>
```

## Verification Plan
### Automated Tests
- Run `npm run wolf:audit` to ensure strict TypeScript types are maintained across the 4 modified child components.
### Manual Verification
- Verify that the overlap in the Tasks, Notes, Timeline, and Tracking tabs is completely resolved.
- Verify that clicking the Expand button correctly triggers Zen Mode.
