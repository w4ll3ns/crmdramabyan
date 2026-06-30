
-- Indexes for messages
CREATE INDEX IF NOT EXISTS messages_conversation_id_created_at_desc_idx
  ON public.messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS messages_unread_inbound_idx
  ON public.messages (conversation_id)
  WHERE direction = 'inbound' AND status IS NULL;

-- RPC: conversations_overview
CREATE OR REPLACE FUNCTION public.conversations_overview(
  p_filter text DEFAULT 'todas',
  p_limit  int  DEFAULT 100
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT c.id, c.telefone, c.status::text AS status,
           c.ultima_mensagem_em, c.paciente_id
    FROM public.conversations c
    WHERE
      CASE p_filter
        WHEN 'nao_lidas'      THEN c.status::text = 'nao_lida'
        WHEN 'em_atendimento' THEN c.status::text = 'em_atendimento'
        ELSE TRUE
      END
    ORDER BY c.ultima_mensagem_em DESC NULLS LAST
    LIMIT p_limit
  ),
  last_msg AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id, m.content_text, m.type::text AS type,
      m.direction::text AS direction, m.created_at, m.status
    FROM public.messages m
    WHERE m.conversation_id IN (SELECT id FROM base)
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread AS (
    SELECT m.conversation_id, COUNT(*)::int AS unread
    FROM public.messages m
    WHERE m.conversation_id IN (SELECT id FROM base)
      AND m.direction = 'inbound'
      AND m.status IS NULL
    GROUP BY m.conversation_id
  )
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', b.id,
      'telefone', b.telefone,
      'status', b.status,
      'ultima_mensagem_em', b.ultima_mensagem_em,
      'paciente', CASE WHEN p.id IS NULL THEN NULL ELSE
        jsonb_build_object('id', p.id, 'nome', p.nome, 'foto_url', p.foto_url)
      END,
      'ultima_msg', CASE WHEN lm.conversation_id IS NULL THEN NULL ELSE
        jsonb_build_object(
          'content_text', lm.content_text,
          'type', lm.type,
          'direction', lm.direction
        )
      END,
      'unread', COALESCE(u.unread, 0)
    ) AS row
    FROM base b
    LEFT JOIN public.pacientes p ON p.id = b.paciente_id
    LEFT JOIN last_msg lm ON lm.conversation_id = b.id
    LEFT JOIN unread u    ON u.conversation_id  = b.id
    ORDER BY b.ultima_mensagem_em DESC NULLS LAST
  ) t;
$$;

GRANT EXECUTE ON FUNCTION public.conversations_overview(text, int) TO authenticated;

-- RPC: home_summary
CREATE OR REPLACE FUNCTION public.home_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_week_ago timestamptz := now() - interval '7 days';
  v_today_start timestamptz := date_trunc('day', now());
  v_today_end   timestamptz := date_trunc('day', now()) + interval '1 day';
  v_month_start timestamptz := date_trunc('month', now());
  v_90_ago timestamptz := now() - interval '90 days';
  v_30_ago timestamptz := now() - interval '30 days';

  v_greeting text;
  v_leads_novos int;
  v_followups_atrasados int;
  v_a_confirmar_hoje int;
  v_unread int;
  v_mini_funil jsonb;
  v_no_show jsonb;
  v_ticket jsonb;
  v_recall jsonb;
BEGIN
  -- greeting name
  SELECT COALESCE(
    NULLIF(initcap(split_part(p.name, ' ', 1)), ''),
    'Dra.'
  ) INTO v_greeting
  FROM public.profiles p WHERE p.id = v_user_id;
  IF v_greeting IS NULL THEN v_greeting := 'Dra.'; END IF;

  -- leads novos (7d)
  SELECT count(*)::int INTO v_leads_novos
  FROM public.oportunidades
  WHERE status::text='aberta' AND etapa::text='novo_lead' AND created_at >= v_week_ago;

  -- followups atrasados = oportunidades + tasks
  SELECT
    (SELECT count(*) FROM public.oportunidades
       WHERE status::text='aberta' AND proximo_followup_em < v_now)
   +(SELECT count(*) FROM public.tasks
       WHERE status::text='pendente' AND due_date < v_now)
  INTO v_followups_atrasados;

  -- a confirmar hoje
  SELECT count(*)::int INTO v_a_confirmar_hoje
  FROM public.agendamentos
  WHERE aguardando_confirmacao = true
    AND data_hora >= v_today_start AND data_hora < v_today_end;

  -- unread (mensagens inbound sem status)
  SELECT count(*)::int INTO v_unread
  FROM public.messages
  WHERE direction='inbound' AND status IS NULL;

  -- mini funil
  SELECT COALESCE(jsonb_agg(row ORDER BY ord), '[]'::jsonb) INTO v_mini_funil
  FROM (
    SELECT
      array_position(
        ARRAY['novo_lead','primeiro_contato','avaliacao_agendada','avaliacao_realizada','orcamento_enviado','negociacao','procedimento_agendado']::text[],
        etapa::text
      ) AS ord,
      jsonb_build_object(
        'etapa', etapa::text,
        'count', count(*),
        'valor', COALESCE(sum(valor_estimado), 0)
      ) AS row
    FROM public.oportunidades
    WHERE status::text='aberta'
      AND etapa::text IN ('novo_lead','primeiro_contato','avaliacao_agendada','avaliacao_realizada','orcamento_enviado','negociacao','procedimento_agendado')
    GROUP BY etapa
  ) s WHERE ord IS NOT NULL;

  -- no-show mês
  WITH a AS (
    SELECT status::text AS status FROM public.agendamentos
    WHERE data_hora >= v_month_start AND status::text IN ('faltou','realizado')
  )
  SELECT jsonb_build_object(
    'faltou', count(*) FILTER (WHERE status='faltou'),
    'total',  count(*),
    'rate',   CASE WHEN count(*)=0 THEN 0 ELSE
              (count(*) FILTER (WHERE status='faltou'))::numeric / count(*) END
  ) INTO v_no_show FROM a;

  -- ticket médio top 3 (90d) realizados
  SELECT COALESCE(jsonb_agg(row ORDER BY volume DESC), '[]'::jsonb) INTO v_ticket
  FROM (
    SELECT
      pr.nome,
      count(*)::int AS volume,
      jsonb_build_object(
        'nome', pr.nome,
        'ticket', CASE WHEN count(ag.valor)=0 THEN 0 ELSE avg(ag.valor) END,
        'volume', count(*)::int
      ) AS row
    FROM public.agendamentos ag
    JOIN public.procedimentos pr ON pr.id = ag.procedimento_id
    WHERE ag.status::text='realizado' AND ag.data_hora >= v_90_ago
    GROUP BY pr.nome
    ORDER BY volume DESC
    LIMIT 3
  ) t;

  -- recall rate (30d)
  WITH evts AS (
    SELECT paciente_id, created_at
    FROM public.automacao_eventos
    WHERE tipo='recall' AND created_at >= v_30_ago
  ),
  hit AS (
    SELECT e.paciente_id FROM evts e
    WHERE EXISTS (
      SELECT 1 FROM public.agendamentos ag
      WHERE ag.paciente_id = e.paciente_id AND ag.created_at > e.created_at
    )
  )
  SELECT jsonb_build_object(
    'denom', (SELECT count(*) FROM evts),
    'num',   (SELECT count(*) FROM hit),
    'rate',  CASE WHEN (SELECT count(*) FROM evts)=0 THEN 0 ELSE
             (SELECT count(*) FROM hit)::numeric / (SELECT count(*) FROM evts) END
  ) INTO v_recall;

  RETURN jsonb_build_object(
    'greeting', v_greeting,
    'leads_novos', v_leads_novos,
    'followups_atrasados', v_followups_atrasados,
    'a_confirmar_hoje', v_a_confirmar_hoje,
    'unread', v_unread,
    'mini_funil', v_mini_funil,
    'no_show', v_no_show,
    'ticket_medio', v_ticket,
    'recall', v_recall
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.home_summary() TO authenticated;
