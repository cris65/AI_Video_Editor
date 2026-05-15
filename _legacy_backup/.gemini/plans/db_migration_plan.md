# Phase 1 Migration Plan: The Hybrid Strangler Pattern

## Architectural Strategy
Based on the Tech Lead's decision, we are divorcing the Global Traits directly into the `contacts` node while relocating Contractual/Financial traits (`hourly_rate`, `currency`) squarely into the Junction tables (the Edges). Crucially, this plan executes parallel instantiation (Strangler Pattern) without dropping any existing columns or Foreign Keys acting on `external_resources` and `projects`.

## 1. Migration SQL Script

```sql
BEGIN;

-- ==============================================================================
-- 1. ALTER CONTACTS (Global Traits Injection)
-- ==============================================================================
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS color TEXT,
ADD COLUMN IF NOT EXISTS type TEXT,
ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT false;

-- ==============================================================================
-- 2. CREATE JUNCTION TABLES (Edges with Financial Payload)
-- ==============================================================================

-- A. supplier_contacts
CREATE TABLE IF NOT EXISTS public.supplier_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    hourly_rate NUMERIC,
    currency TEXT,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ,
    UNIQUE(supplier_id, contact_id)
);

-- B. project_contacts
CREATE TABLE IF NOT EXISTS public.project_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    hourly_rate NUMERIC,
    currency TEXT,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ,
    UNIQUE(project_id, contact_id)
);

-- ==============================================================================
-- 3. APPLY ROW-LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_contacts ENABLE ROW LEVEL SECURITY;

-- Supplier Contacts RLS
CREATE POLICY "Enable authenticated access based on org" ON public.supplier_contacts
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- Project Contacts RLS
CREATE POLICY "Enable authenticated access based on org" ON public.project_contacts
    FOR ALL TO authenticated
    USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

-- Expose to Realtime WebSockets (assuming parity requirement with prior configurations)
ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_contacts;

-- ==============================================================================
-- 4. DATA MIGRATION (The Zero-Drop Bridge)
-- ==============================================================================

-- A. Promote legacy external_resources into contacts globally.
-- We map the UUID exactly, guaranteeing relational integrity when we populate the Edges in step B.
INSERT INTO public.contacts (
    id, name, email, phone, status, organization_id, is_deleted, created_at, updated_at, color, type, is_personal
)
SELECT 
    id, name, email, phone, status, organization_id, is_deleted, created_at, updated_at, color, type, COALESCE(is_personal, false)
FROM public.external_resources
ON CONFLICT (id) DO UPDATE SET 
    color = EXCLUDED.color,
    type = EXCLUDED.type,
    is_personal = EXCLUDED.is_personal;

-- B. Populate supplier_contacts Edges with legacy relationships & financials.
INSERT INTO public.supplier_contacts (
    supplier_id, contact_id, hourly_rate, currency, organization_id, created_at, updated_at
)
SELECT 
    supplier_id, 
    id AS contact_id, 
    hourly_rate, 
    currency, 
    organization_id, 
    created_at, 
    updated_at
FROM public.external_resources
WHERE supplier_id IS NOT NULL
ON CONFLICT (supplier_id, contact_id) DO NOTHING;

-- C. Populate the project_suppliers legacy lock-ins directly from projects table.
INSERT INTO public.project_suppliers (
    project_id, supplier_id, organization_id, created_at, updated_at
)
SELECT 
    id AS project_id, 
    supplier_id, 
    organization_id,
    created_at,
    updated_at
FROM public.projects
WHERE supplier_id IS NOT NULL
ON CONFLICT (project_id, supplier_id) DO NOTHING;

COMMIT;
```

## 2. Next Execution Sequence
1. Upon your approval, we will create the new Supabase migration.
2. We inject the above SQL snippet.
3. We execute `npm run sb:up` explicitly triggering the local Database push.
4. (No SQL Drop constraints are executed, enforcing total compatibility until we enter Phase 2).

> [!TIP]
> Resolving conflicts via `DO UPDATE SET` on `contacts (id)` guarantees that if the UUID already exists purely as an incomplete generic contact structure it safely inherits `color`, `type` and `is_personal` payloads dynamically.

Please review the drafted SQL. Issue `@[/execute]` to dispatch the Strangler Migration to the local database.
