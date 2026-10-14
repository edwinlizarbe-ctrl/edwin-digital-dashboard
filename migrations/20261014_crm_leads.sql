-- Edwin CRM: manual opportunities / lead pipeline. New isolated table only.
-- Never allow direct anon/authenticated access: server checks tenant membership first.
CREATE TABLE IF NOT EXISTS public.ed_crm_leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
 email text CHECK (email IS NULL OR char_length(email) <= 160),
 phone text CHECK (phone IS NULL OR char_length(phone) <= 35),
 source text NOT NULL CHECK (source IN ('google_ads','meta_ads','organic','referral','whatsapp','other')),
 stage text NOT NULL DEFAULT 'new' CHECK (stage IN ('new','contacted','qualified','won','lost')),
 campaign text CHECK (campaign IS NULL OR char_length(campaign) <= 150),
 notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
 amount numeric(16,2) CHECK (amount IS NULL OR (amount >= 0 AND amount <= 10000000000)),
 currency text NOT NULL DEFAULT 'PEN' CHECK (currency ~ '^[A-Z]{3}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ed_crm_leads_business_created ON public.ed_crm_leads(business_id,created_at DESC);
ALTER TABLE public.ed_crm_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ed_crm_leads FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.ed_crm_leads TO service_role;
