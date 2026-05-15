-- 🐺 MIGRATION: LOG & METRIC SYNC BRIDGE
-- Purpose: Safely drops and recreates the CHECK constraints on the `notes` table 
-- to allow the new 'log' archetype and 'METRIC' behavior class to push to Supabase.

BEGIN;

-------------------------------------------------------------------------------
-- 1. BEHAVIOR CLASS HIERARCHY (The FAST Model)
-------------------------------------------------------------------------------
-- Drop the existing constraint
ALTER TABLE public.notes 
DROP CONSTRAINT IF EXISTS notes_behavior_class_check;

-- Recreate with 'METRIC'
ALTER TABLE public.notes 
ADD CONSTRAINT notes_behavior_class_check 
CHECK (behavior_class = ANY (ARRAY[
  'ACTIONABLE', 
  'EVENT', 
  'ISSUE', 
  'REMINDER', 
  'DESCRIPTIVE', 
  'FINANCIAL',
  'METRIC'
]));

-------------------------------------------------------------------------------
-- 2. UNIVERSAL TYPE CLASSIFICATION
-------------------------------------------------------------------------------
-- Safely extract and destroy any rogue constraints affecting `type`
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'notes'::regclass 
        AND contype = 'c' 
        AND pg_get_constraintdef(oid) LIKE '%CHECK (type %'
    LOOP 
        EXECUTE 'ALTER TABLE notes DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_type_check_universal;

-- Recreate with 'log'
ALTER TABLE public.notes 
ADD CONSTRAINT notes_type_check_universal 
CHECK (type IN (
  'note', 
  'thought', 
  'brief', 
  'meeting', 
  'bug', 
  'expense', 
  'memo', 
  'idea', 
  'todo', 
  'reminder', 
  'journal',
  'log'
));

COMMIT;
