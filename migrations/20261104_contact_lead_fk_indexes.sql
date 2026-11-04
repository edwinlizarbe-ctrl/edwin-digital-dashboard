-- Edwin CRM · Cover two foreign keys used for contact and lead lifecycle operations.
-- The current indexes start with campaign_id and business_id respectively, so
-- they cannot efficiently serve lookup/cascades beginning with these FK columns.
-- This is additive and idempotent: no data, constraints, or policies are changed.

CREATE INDEX IF NOT EXISTS ed_email_deliveries_contact_id_idx
  ON public.ed_email_deliveries (contact_id, business_id);

CREATE INDEX IF NOT EXISTS ed_crm_leads_created_by_idx
  ON public.ed_crm_leads (created_by);
