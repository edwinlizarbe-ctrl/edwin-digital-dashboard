-- Brásper Email Marketing: approved, tenant-safe scheduled queues.
ALTER TABLE public.ed_email_campaigns DROP CONSTRAINT IF EXISTS ed_email_campaigns_status_check;
ALTER TABLE public.ed_email_campaigns ADD CONSTRAINT ed_email_campaigns_status_check CHECK(status IN ('draft','scheduled','sending','completed','paused','cancelled'));
ALTER TABLE public.ed_email_campaigns ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE public.ed_email_campaigns ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.ed_email_campaigns ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.ed_email_deliveries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
 campaign_id uuid NOT NULL REFERENCES public.ed_email_campaigns(id) ON DELETE CASCADE,
 contact_id uuid NOT NULL REFERENCES public.ed_email_contacts(id) ON DELETE CASCADE,
 email text NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','claimed','sent','delivered','opened','clicked','bounced','complained','failed','suppressed')),
 claim_at timestamptz,
 sent_at timestamptz,
 last_event_at timestamptz,
 provider_message_id text UNIQUE,
 error_message text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(campaign_id,contact_id)
);
CREATE INDEX IF NOT EXISTS ed_email_deliveries_pending ON public.ed_email_deliveries(business_id,status,campaign_id,created_at);
CREATE INDEX IF NOT EXISTS ed_email_deliveries_provider ON public.ed_email_deliveries(provider_message_id);
ALTER TABLE public.ed_email_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ed_email_deliveries FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ed_email_deliveries TO service_role;

CREATE TABLE IF NOT EXISTS public.ed_email_webhook_events(
 event_id text PRIMARY KEY,
 event_type text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ed_email_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ed_email_webhook_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.ed_email_webhook_events TO service_role;

-- Approved campaigns get a fixed one-recipient-per-contact queue. No automatic enrollment after approval.
CREATE OR REPLACE FUNCTION public.ed_email_schedule(
 p_business uuid,p_campaign uuid,p_actor uuid,p_send_at timestamptz
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE n integer; rec record;
BEGIN
 IF p_send_at IS NULL OR p_send_at < now() - interval '30 seconds' OR p_send_at > now() + interval '90 days'
 THEN RAISE EXCEPTION 'Invalid scheduled time'; END IF;
 SELECT id,language INTO rec FROM public.ed_email_campaigns
  WHERE id=p_campaign AND business_id=p_business AND status='draft' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Campaign must be an unsent draft'; END IF;
 SELECT count(*) INTO n FROM public.ed_email_contacts
  WHERE business_id=p_business AND consented_at IS NOT NULL AND unsubscribed_at IS NULL
   AND language=rec.language;
 IF n<1 OR n>2000 THEN RAISE EXCEPTION 'Requires between 1 and 2000 opted-in contacts'; END IF;
 INSERT INTO public.ed_email_deliveries(business_id,campaign_id,contact_id,email)
 SELECT p_business,p_campaign,id,email FROM public.ed_email_contacts
 WHERE business_id=p_business AND consented_at IS NOT NULL AND unsubscribed_at IS NULL AND language=rec.language
 ON CONFLICT(campaign_id,contact_id) DO NOTHING;
 UPDATE public.ed_email_campaigns SET status='scheduled',scheduled_at=p_send_at,approved_at=now(),approved_by=p_actor,updated_at=now()
 WHERE id=p_campaign AND business_id=p_business;
 RETURN n;
END $$;
-- Claiming is atomic even if multiple workers or cron instances run concurrently.
CREATE OR REPLACE FUNCTION public.ed_email_claim_batch(p_business uuid,p_limit integer DEFAULT 10)
RETURNS SETOF public.ed_email_deliveries LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_limit<1 OR p_limit>25 THEN RAISE EXCEPTION 'Invalid batch size'; END IF;
 RETURN QUERY
 WITH eligible AS (
  SELECT d.id FROM public.ed_email_deliveries d
  JOIN public.ed_email_campaigns c ON c.id=d.campaign_id AND c.business_id=d.business_id
  JOIN public.ed_email_contacts contact ON contact.id=d.contact_id AND contact.business_id=d.business_id
  WHERE d.business_id=p_business AND d.status='pending' AND c.status IN ('scheduled','sending')
    AND c.scheduled_at<=now() AND contact.consented_at IS NOT NULL AND contact.unsubscribed_at IS NULL
  ORDER BY d.created_at,d.id FOR UPDATE OF d SKIP LOCKED LIMIT p_limit
 )
 UPDATE public.ed_email_deliveries d SET status='claimed',claim_at=now()
 FROM eligible e WHERE d.id=e.id RETURNING d.*;
 UPDATE public.ed_email_campaigns c SET status='sending',updated_at=now()
 WHERE c.business_id=p_business AND c.status='scheduled' AND c.scheduled_at<=now();
END $$;
REVOKE ALL ON FUNCTION public.ed_email_schedule(uuid,uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ed_email_claim_batch(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ed_email_schedule(uuid,uuid,uuid,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.ed_email_claim_batch(uuid,integer) TO service_role;
