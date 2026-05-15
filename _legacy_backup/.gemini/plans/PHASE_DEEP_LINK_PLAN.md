# 🐺 PHASE DEEP LINK PLAN (True Navigation Architecture)

**Objective:** Upgrade the Ubiquitous Routing for Phase Badges. Instead of just jumping to the Project Hub and landing blindly, a Phase Badge click must pass `phaseId` via the URL to trigger an auto-scroll and visual spotlight directly on the specific phase within the Gantt/Timeline view.

---

## 1. The Trigger: URL Composition
Whenever a User clicks a **Phase Badge** in `TimeEntryItem` or `NoteGroup`, we format the React Router Path precisely:
```tsx
const path = `/projects/${project_id}?tab=timeline&phaseId=${phase_id}`;
handleEntityRouting(e, path);
```
*This ensures the target application state is explicitly defined in the URL, making the link shareable and durable.*

---

## 2. The Interceptor: `useProjectDetails` (Hook)
The `useProjectDetails.ts` hook acts as the brain for the Project Hub. We will enhance its `searchParams` effect to intercept and digest `phaseId`.

- Add a new state: `const [phaseToHighlight, setPhaseToHighlight] = useState<string | null>(null);`
- In the existing routing `useEffect`, extract the parameter:
  ```tsx
  const phaseIdFromUrl = searchParams.get('phaseId');
  if (phaseIdFromUrl) {
      setPhaseToHighlight(phaseIdFromUrl);
      if (activeTab !== 'timeline') setActiveTab('timeline');
      
      // Clean the URL to avoid recurring triggers on remounts
      setSearchParams(params => {
          params.delete('phaseId');
          return params;
      }, { replace: true });
  }
  ```
- Expose this state to `ProjectDetailsPage.tsx` via the hook's return object.

---

## 3. The Dispatch: `ProjectDetailsPage.tsx`
Pass the new `phaseToHighlight` into `<ProjectTimeline />`:
```tsx
<ProjectTimeline 
    projectId={project.id} 
    readOnly={false} 
    phaseIdToHighlight={phaseToHighlight} 
    onHighlightComplete={() => setPhaseToHighlight(null)} 
    /* existing autoEdit props... */
/>
```

---

## 4. The Arrival: `ProjectTimeline.tsx` (Auto-Scroll & Flash)
We will augment the Timeline Component so it physically reacts when it's targeted:

1. **DOM Addressing:** Assign a dynamic ID to each phase's rendered row.
   ```tsx
   <div key={item.id} id={`phase-row-${item.id}`} className="...">
   ```
2. **Telemetry Effect:** Implement a `useEffect` that catches `phaseIdToHighlight`, scrolls the DOM smoothly, and applies a CSS ring.
   ```tsx
   useEffect(() => {
       if (phaseIdToHighlight && phases.length > 0) {
           const el = document.getElementById(`phase-row-${phaseIdToHighlight}`);
           if (el) {
               el.scrollIntoView({ behavior: 'smooth', block: 'center' });
               
               // WOLF-UX: Flash effect using Tailwind classes
               el.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-500/10', 'scale-[1.02]');
               
               setTimeout(() => {
                   el.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-500/10', 'scale-[1.02]');
               }, 2000); // 2 second flash
               
               if (onHighlightComplete) onHighlightComplete();
           }
       }
   }, [phaseIdToHighlight, phases, onHighlightComplete]);
   ```

*This strategy provides TRUE deep linking, avoids hijacking the Edit Modal automatically (which is invasive for a simple click-through), and visually spotlights the entity for a high-end UX feel.*
