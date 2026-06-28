-- 1) Vault disponível
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- 2) Função utilitária para gravar/rotacionar o cron_secret no Vault.
--    Mantida restrita: só service_role/postgres pode chamar.
CREATE OR REPLACE FUNCTION public.set_cron_secret(_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  _id uuid;
BEGIN
  IF _value IS NULL OR length(_value) < 16 THEN
    RAISE EXCEPTION 'cron_secret muito curto';
  END IF;
  SELECT id INTO _id FROM vault.secrets WHERE name = 'cron_secret';
  IF _id IS NULL THEN
    PERFORM vault.create_secret(_value, 'cron_secret', 'Header x-cron-secret usado pelos jobs pg_cron');
  ELSE
    PERFORM vault.update_secret(_id, _value, 'cron_secret', 'Header x-cron-secret usado pelos jobs pg_cron');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_cron_secret(text) TO service_role;

-- 3) Reagenda cron jobs lendo segredo do Vault e apontando réguas para produção
DO $$
BEGIN
  PERFORM cron.unschedule('processar-mensagens-5min');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('regua-aniversario');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('regua-reativacao');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'processar-mensagens-5min',
  '*/5 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://ehbgrqqleluhyzwwhbol.supabase.co/functions/v1/processar-mensagens-agendadas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoYmdycXFsZWx1aHl6d3doYm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NDgwNjcsImV4cCI6MjA5ODIyNDA2N30.Lhw17bNm_-lqi19xUxvswlU3HL84n7hQezvWEyYzfYc',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $job$
);

SELECT cron.schedule(
  'regua-aniversario',
  '0 11 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://crmdramabyan.lovable.app/api/public/hooks/reguas-cron?job=aniversario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $job$
);

SELECT cron.schedule(
  'regua-reativacao',
  '0 12 * * 1',
  $job$
  SELECT net.http_post(
    url := 'https://crmdramabyan.lovable.app/api/public/hooks/reguas-cron?job=reativacao',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $job$
);