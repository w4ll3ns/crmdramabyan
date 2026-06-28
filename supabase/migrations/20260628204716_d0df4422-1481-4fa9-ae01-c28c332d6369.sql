CREATE OR REPLACE FUNCTION public.claim_mensagens_pendentes(_limit int)
RETURNS SETOF public.mensagens_agendadas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.mensagens_agendadas m
     SET status = 'enviando'::public.msg_status,
         tentativas = COALESCE(m.tentativas, 0) + 1,
         updated_at = now()
   WHERE m.id IN (
     SELECT id FROM public.mensagens_agendadas
      WHERE status = 'pendente'::public.msg_status
        AND agendado_para <= now()
      ORDER BY agendado_para
      LIMIT GREATEST(1, _limit)
      FOR UPDATE SKIP LOCKED
   )
  RETURNING m.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.reagendar_mensagem(_id uuid, _nova timestamptz)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.mensagens_agendadas
     SET status = 'pendente'::public.msg_status,
         agendado_para = _nova,
         updated_at = now()
   WHERE id = _id;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_mensagens_pendentes(int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reagendar_mensagem(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_mensagens_pendentes(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.reagendar_mensagem(uuid, timestamptz) TO service_role;