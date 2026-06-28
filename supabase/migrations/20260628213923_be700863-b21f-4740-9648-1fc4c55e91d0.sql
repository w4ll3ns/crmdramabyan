CREATE OR REPLACE FUNCTION public.claim_mensagens_pendentes(_limit integer)
RETURNS SETOF public.mensagens_agendadas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _max int;
BEGIN
  SELECT COALESCE((valor)::text::int, 3) INTO _max
    FROM public.settings WHERE chave = 'automacoes_max_tentativas';
  _max := COALESCE(_max, 3);

  RETURN QUERY
  UPDATE public.mensagens_agendadas m
     SET status = 'enviando'::public.msg_status,
         tentativas = COALESCE(m.tentativas, 0) + 1,
         updated_at = now()
   WHERE m.id IN (
     SELECT id FROM public.mensagens_agendadas
      WHERE status = 'pendente'::public.msg_status
        AND agendado_para <= now()
        AND COALESCE(tentativas, 0) < _max
      ORDER BY agendado_para
      LIMIT GREATEST(1, _limit)
      FOR UPDATE SKIP LOCKED
   )
  RETURNING m.*;
END $$;