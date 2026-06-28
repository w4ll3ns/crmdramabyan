ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS wa_lid TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS lead_ad_ref JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS pacientes_wa_lid_unique ON public.pacientes (wa_lid) WHERE wa_lid IS NOT NULL;
CREATE INDEX IF NOT EXISTS pacientes_lead_ad_ref_gin ON public.pacientes USING GIN (lead_ad_ref);