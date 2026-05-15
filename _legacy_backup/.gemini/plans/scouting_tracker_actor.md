# Scouting Report: Tracker Actor Dropdown Bottleneck

## 🚨 The Missing Prop Flaw

The architecture is explicitly failing due to a missing prop passing when invoking the `<InlineResourcePicker>` inside the Time Tracker Modal.

**File:** `frontend/src/components/tracker/TimeEntryModal.tsx`
**Location:** Line 685 - `<InlineResourcePicker>` initialization.

### The Exact Cause:
The `TimeEntryModal` completely omits passing the `isPersonal` context flag down to the picker:
```tsx
      <InlineResourcePicker 
        isOpen={isResourcePickerOpen}
        onClose={() => setIsResourcePickerOpen(false)}
        anchorPosition={resourcePickerPos}
        allowPrimaryUser={true}
        selectedProjectId={selectedProject?.id || null}
        // ❌ MISSING: isPersonal={!!selectedProject?.is_personal}
```

### The Ripple Effect:
1. Because the `isPersonal` prop is omitted, it falls back to the default `false` (WORK domain) declared in `InlineResourcePicker.tsx` (Line 40).
2. The user has explicitly selected a **Personal** project ("Mamma gestione") which correctly hydrated 8 **Personal** contacts via `usePickerResources.ts` (`selectedProjectId` Axis 1/2).
3. However, the Domain Strictness rendering filter inside `InlineResourcePicker` (Line 61) executes:
   ```tsx
   !!c.is_personal === !!isPersonal
   ```
4. This evaluates to `true === false` for every single one of the 8 contacts.
5. Consequently, all valid actors are mathematically filtered out of the DOM visually, leaving only the un-filtered "Me (Primary User)" shortcut button available to the user.
