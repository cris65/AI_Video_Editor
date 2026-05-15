# 🚨 READ-ONLY SCOUTING: Global vs Project Resource Mapping

## 1. Mapping Function Analysis
The component rendering the Vendor/Resource list is located in `frontend/src/components/projects/ProjectModal.tsx` (around lines 638-724), specifically within the `resources` mapping logic.

Currently, the `groupedContacts` reducer **ONLY iterates over `contactsSelected`** (the array of explicitly assigned resources from `project_contacts`). It **fails to merge** with the global state of `allContacts` or `allSupplierContacts`. Ergo, if a vendor is assigned to a project, unassigned resources of that vendor are mathematically invisible because the loop never touches them.

## 2. Why Tamara is "Escaping" (Double-Mapping Failure)
When Tamara is added as a Freelance and under her Vendor, she "escapes" or conflict-deletes because the UI state and removal logic rely exclusively on a singular key: `r.entity_id` and `r.type`:

```typescript
onRemoveBlock={(entityId, rType) => {
    markDirty();
    setResources(resources.filter(r => !(r.type === rType && String(r.entity_id) === entityId)));
}}
```

Because `entityId` is strictly the `contact_id`, adding Tamara twice just pushes two identical `entity_id`s. Clicking "Remove" on one will purge **both** from the project. Furthermore, hydration from `db.projectContacts` does not inject a `force_standalone` flag, making the `isSupplierInProject` check resolve to `true`, forcibly funneling all her instances into the vendor group and leaving the standalone group empty. She needs a composite key approach (e.g., `link: supplier_id | 'standalone'`) natively tracked in the state.

## 3. Where COOP LUCE's Missing Resources are Blocked
They are blocked right at the genesis of the `groupedContacts` reducer. The logic starts with `contactsSelected.reduce(...)`. If COOP LUCE has 4 global resources, but only 2 of them were explicitly assigned to this project (thus hydrated into the `resources` state), the remaining 2 are simply ignored.

---

### ⚠️ Exact Code Snippet Needing Refactor (`ProjectModal.tsx`)

```tsx
// 1. Preserve true mutated indices
const indexedResources = resources.map((r, i) => ({ ...r, originalIndex: i }));
const suppliersSelected = indexedResources.filter(r => r.type === 'supplier');
const contactsSelected = indexedResources.filter(r => r.type === 'contact');

// 2. Group Contacts
// 🚨 BUG: This only maps ALREADY SELECTED contacts. It drops global unassigned vendor contacts.
// 🚨 BUG: No composite key (supplier_id + contact_id) to allow "Double Mapping"
const groupedContacts = contactsSelected.reduce((acc, contactRes) => {
    const coreContact = allContacts.find(c => c.id === contactRes.entity_id);
    const link = coreContact?.linked_supplier_id;
    // Phase 5 Override Bypass
    const isSupplierInProject = !contactRes.force_standalone && link && suppliersSelected.some(s => s.entity_id === link);
    
    const key = isSupplierInProject ? link : 'standalone';
    if (!acc[key]) acc[key] = [];
    acc[key].push(contactRes);
    return acc;
}, {} as Record<string, typeof contactsSelected>);

// LAYER 1: Accordion Suppliers
{suppliersSelected.map(supplierRes => {
    const sId = supplierRes.entity_id;
    const entity = allSuppliers.find(s => s.id === sId);
    
    // 🚨 BUG: nestedChildren only receives already selected contacts.
    // Must be refactored to:
    // 1. Find all global contacts where `linked_supplier_id === sId`
    // 2. Determine which ones are in `contactsSelected` vs unassigned
    const nestedChildren = groupedContacts[sId] || [];
    // ...
```
