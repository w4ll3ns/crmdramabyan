CREATE OR REPLACE FUNCTION public.diag_cron_jobs()
RETURNS TABLE(jobname text, schedule text, active boolean, last_status text, last_start timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT j.jobname::text, j.schedule::text, j.active,
         r.status::text, r.start_time
    FROM cron.job j
    LEFT JOIN LATERAL (
      SELECT status, start_time FROM cron.job_run_details
       WHERE jobid = j.jobid ORDER BY start_time DESC LIMIT 1
    ) r ON true
   WHERE j.command ILIKE '%/api/public/hooks/reguas-cron%'
      OR j.command ILIKE '%/functions/v1/processar-mensagens-agendadas%'
      OR j.jobname ILIKE '%regua%'
      OR j.jobname ILIKE '%automac%'
      OR j.jobname ILIKE '%processar-mensagens%';
$$;