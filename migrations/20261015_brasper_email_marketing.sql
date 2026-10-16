-- Brásper-only Email Marketing MVP. Does not modify existing CRM entities.
-- All queries go through the Worker after tenant+role checks.
CREATE TABLE IF NOT EXISTS public.ed_email_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(char_length(title) BETWEEN 3 AND 120),
 subject text NOT NULL CHECK(char_length(subject) BETWEEN 3 AND 150),
 preheader text NOT NULL DEFAULT '',
 language text NOT NULL CHECK(language IN ('es','pt')),
 blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
 status text NOT NULL DEFAULT 'draft' CHECK(status='draft'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ed_email_campaigns_tenant ON public.ed_email_campaigns(business_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS public.ed_email_contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 name text NOT NULL,
 email text NOT NULL,
 company text,
 language text NOT NULL DEFAULT 'es' CHECK(language IN ('es','pt')),
 consented_at timestamptz NOT NULL,
 consent_source text NOT NULL,
 unsubscribed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(business_id,email)
);
CREATE INDEX IF NOT EXISTS ed_email_contacts_tenant ON public.ed_email_contacts(business_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.ed_email_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 path text NOT NULL,
 url text NOT NULL,
 mime text NOT NULL CHECK(mime IN ('image/jpeg','image/png','image/webp')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ed_email_assets_tenant ON public.ed_email_assets(business_id,created_at DESC);
ALTER TABLE public.ed_email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ed_email_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ed_email_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ed_email_campaigns,public.ed_email_contacts,public.ed_email_assets FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.ed_email_campaigns,public.ed_email_contacts,public.ed_email_assets TO service_role;
-- The bucket serves ONLY marketing creative images. Never upload customer data.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES ('brasper-newsletter-assets','brasper-newsletter-assets',true,2000000,ARRAY['image/png','image/jpeg','image/webp'])
 ON CONFLICT(id) DO NOTHING;
