-- Index used for membership lookups by user across businesses.
-- The existing primary key (business_id, user_id) does not cover lookups by user_id alone.
-- This migration does not modify any rows or change RLS policies.
CREATE INDEX IF NOT EXISTS business_members_user_id_idx
  ON public.business_members (user_id);
