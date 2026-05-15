# 🐺 RESOURCE & VENDOR ROUTING PLAN

**Objective:** Complete the "See it. Click it. Route it." directive by making Resource and Vendor badges fully navigable across the application, with strict adherence to event shielding.

---

## 1. Components Audited & Targets Identified

Following an exhaustive audit, I identified the following components where Vendor and Resource badges are rendered within drag-and-drop or interactive lists:

1. **`TimeEntryItem.tsx`**
   - **Vendor Pill:** Maps to `entry.suppliers` (requires `entry.supplier_id`).
   - **Resource Pill:** Maps to `entry.external_resources` (requires `entry.external_resource_id`).

2. **`CalendarBlock.tsx`**
   - **Vendor Pill:** Maps to `item.supplier_name`.
   - **Resource Pill:** Maps to `item.resource_name`.
   *(Note: This component uses `@dnd-kit/sortable`, so strict event shielding is mandatory).*

*(Note: `NoteItem` inside `NoteGroup.tsx` and `SortableDealCard.tsx` were audited and currently do not render Vendor/Resource badges).*

---

## 2. Router Configuration Audit (The Exact URLs)

I analyzed the core router configuration in `App.tsx` and the respective page components. Here are the exact URLs discovered:

### A. VENDORS (Suppliers)
The B2B directory structure correctly maps individual Suppliers (Vendors) to a dedicated details page.
- **Path:** `/suppliers/:id`
- **Destination:** `<SupplierDetailsPage />`
- **Execution Strategy:** Directly route to `/suppliers/${id}` using the standard shield.

### B. RESOURCES (Contacts / External Resources)
**🚨 WOLF-ALERT: ARCHITECTURAL GAP IDENTIFIED**
There is **NO** dedicated route for individual resources in `App.tsx`. 
- There is no `/resources/:id` path.
- There is no `/contacts/:id` path.
- The `ContactsPage` (`/contacts`) handles contacts via a localized modal (`ContactModal`), and currently does not parse `useSearchParams` to auto-open a specific contact via deep linking (like we did for Phases).
- **Execution Strategy:** 
  1. We can route users generally to the `/contacts` directory page: `/contacts`.
  2. *Or*, if the Tech Lead authorizes it, we can implement a deep link interceptor in `ContactsPage.tsx` using `?action=edit&contactId=${id}` to auto-open the `ContactModal`, achieving true deep navigation for Resources.

---

## 3. The Implementation Pattern

For every targeted badge, we will inject the interactive UX and event shield:

```tsx
// Example for Vendor (Supplier)
<div 
    onClick={(e) => handleEntityRouting(e, `/suppliers/${supplier_id}`)}
    onPointerDown={(e) => e.stopPropagation()}
    className="... cursor-pointer hover:ring-1 hover:ring-indigo-500 hover:opacity-100 transition-all hover:bg-slate-800"
>
    <Package size={10} className="shrink-0 text-slate-500" />
    <span className="...">{supplier_name}</span>
</div>
```

---

## 4. Next Steps & Tech Lead Approval
Before executing, please confirm:
1. Should Resources simply route to the main `/contacts` directory?
2. Or should we build the interceptor in `ContactsPage.tsx` to handle `?contactId=${id}` for true deep linking before modifying the badges?
