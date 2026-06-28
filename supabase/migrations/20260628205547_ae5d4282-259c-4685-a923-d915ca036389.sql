-- 1) Permite N modelos ativos por tipo
DROP INDEX IF EXISTS public.modelos_mensagem_tipo_ativo_idx;

-- 2) Recria enfileirar_automacao sorteando a variante (ORDER BY random())
CREATE OR REPLACE FUNCTION public.enfileirar_automacao(
  _paciente_id uuid,
  _tipo modelo_tipo,
  _agendado_para timestamp with time zone,
  _agendamento_id uuid DEFAULT NULL::uuid,
  _vars_extra jsonb DEFAULT '{}'::jsonb,
  _idemp_key text DEFAULT NULL::text,
  _idemp_ref uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pausado boolean;
  pac record;
  modelo record;
  conv_id uuid;
  vars jsonb;
  conteudo text;
  msg_id uuid;
  ag record;
  proc record;
  clinica_nome text;
  proc_nome text;
BEGIN
  SELECT (valor)::text::boolean INTO pausado FROM public.settings WHERE chave = 'automacoes_pausado';
  IF COALESCE(pausado, false) THEN RETURN NULL; END IF;

  SELECT id, nome, aceita_automacoes INTO pac FROM public.pacientes WHERE id = _paciente_id;
  IF pac.id IS NULL OR NOT COALESCE(pac.aceita_automacoes, true) THEN RETURN NULL; END IF;

  IF _idemp_key IS NOT NULL THEN
    PERFORM 1 FROM public.automacao_eventos
      WHERE paciente_id = _paciente_id
        AND tipo = _idemp_key
        AND COALESCE(ref_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = COALESCE(_idemp_ref, '00000000-0000-0000-0000-000000000000'::uuid)
        AND ocorreu_em = (now() AT TIME ZONE 'America/Fortaleza')::date;
    IF FOUND THEN RETURN NULL; END IF;
  END IF;

  -- Sorteia entre as variantes ativas do tipo
  SELECT id, corpo INTO modelo
    FROM public.modelos_mensagem
    WHERE tipo = _tipo AND ativo = true
    ORDER BY random() LIMIT 1;
  IF modelo.id IS NULL THEN RETURN NULL; END IF;

  SELECT c.id INTO conv_id
    FROM public.conversations c
    JOIN public.pacientes p ON p.id = _paciente_id
   WHERE c.telefone = COALESCE(p.whatsapp, p.telefone)
   LIMIT 1;

  IF _agendamento_id IS NOT NULL THEN
    SELECT * INTO ag FROM public.agendamentos WHERE id = _agendamento_id;
    IF ag.procedimento_id IS NOT NULL THEN
      SELECT * INTO proc FROM public.procedimentos WHERE id = ag.procedimento_id;
      proc_nome := proc.nome;
    END IF;
  END IF;

  SELECT (valor)::text INTO clinica_nome FROM public.settings WHERE chave = 'clinica_nome';
  clinica_nome := COALESCE(NULLIF(trim(both '"' from COALESCE(clinica_nome,'')), ''), 'nossa clínica');

  vars := jsonb_build_object(
    'nome', pac.nome,
    'primeiro_nome', split_part(pac.nome, ' ', 1),
    'nome_clinica', clinica_nome,
    'data', CASE WHEN ag.data_hora IS NOT NULL
      THEN to_char(ag.data_hora AT TIME ZONE 'America/Fortaleza', 'DD/MM/YYYY') ELSE '' END,
    'hora', CASE WHEN ag.data_hora IS NOT NULL
      THEN to_char(ag.data_hora AT TIME ZONE 'America/Fortaleza', 'HH24:MI') ELSE '' END,
    'procedimento', COALESCE(proc_nome, ''),
    'profissional', COALESCE(ag.profissional, ''),
    'valor', COALESCE(ag.valor::text, '')
  ) || COALESCE(_vars_extra, '{}'::jsonb);

  conteudo := public.render_template(modelo.corpo, vars);

  INSERT INTO public.mensagens_agendadas (
    paciente_id, conversation_id, agendamento_id, modelo_id,
    tipo, conteudo_renderizado, variaveis, agendado_para, origem
  ) VALUES (
    _paciente_id, conv_id, _agendamento_id, modelo.id,
    _tipo, conteudo, vars, _agendado_para, 'automacao'
  ) RETURNING id INTO msg_id;

  IF _idemp_key IS NOT NULL THEN
    INSERT INTO public.automacao_eventos (paciente_id, tipo, ref_id, payload)
      VALUES (_paciente_id, _idemp_key, _idemp_ref, jsonb_build_object('mensagem_id', msg_id))
      ON CONFLICT DO NOTHING;
  END IF;

  RETURN msg_id;
END;
$function$;

-- 3) Seed de variantes (idempotente por nome)
INSERT INTO public.modelos_mensagem (nome, tipo, corpo, ativo)
SELECT v.nome, v.tipo::public.modelo_tipo, v.corpo, true
FROM (VALUES
  ('Confirmação V1', 'confirmacao', E'Oi {{primeiro_nome}}! Confirma seu {{procedimento}} em {{data}} às {{hora}}? Responda *1* para confirmar ou *2* para remarcar. — {{nome_clinica}}'),
  ('Confirmação V2', 'confirmacao', E'{{primeiro_nome}}, separamos {{data}} às {{hora}} para o seu {{procedimento}}. Posso confirmar? *1* sim · *2* preciso remarcar. — {{nome_clinica}}'),
  ('Confirmação V3', 'confirmacao', E'Bom te ver por aqui, {{primeiro_nome}}! Seu {{procedimento}} está marcado para {{data}}, {{hora}}. Tudo certo aí? Responda *1* (sim) ou *2* (remarcar). — {{nome_clinica}}'),

  ('Lembrete V1', 'lembrete', E'Oi {{primeiro_nome}}, passando pra lembrar do seu {{procedimento}} hoje às {{hora}}. Te esperamos! 🌿\nSe não quiser mais receber mensagens, responda SAIR.'),
  ('Lembrete V2', 'lembrete', E'{{primeiro_nome}}, faltam poucas horas pro seu {{procedimento}} ({{hora}}). Qualquer ajuste é só chamar.\nPara parar de receber, responda SAIR.'),
  ('Lembrete V3', 'lembrete', E'Lembrete carinhoso, {{primeiro_nome}}: hoje, {{hora}} — seu {{procedimento}}. Até já!\nResponda SAIR a qualquer momento para não receber mais.'),

  ('Pós-procedimento V1', 'pos_procedimento', E'{{primeiro_nome}}, como você está se sentindo após o procedimento? Estamos aqui se precisar.\nResponda SAIR para não receber mais mensagens.'),
  ('Pós-procedimento V2', 'pos_procedimento', E'Oi, {{primeiro_nome}}! Passou {{dias}} dia(s) do seu atendimento. Tudo correndo bem? Qualquer dúvida, é só responder.\nPara parar de receber, responda SAIR.'),
  ('Pós-procedimento V3', 'pos_procedimento', E'{{primeiro_nome}}, queria te dar um oi e saber como anda a recuperação. Pode me contar como está?\nSe preferir não receber mais, responda SAIR.'),

  ('Retorno V1', 'retorno', E'Oi {{primeiro_nome}}, já dá pra agendar seu retorno do {{procedimento}}. Quer que eu te ajude a escolher um horário?\nResponda SAIR para não receber mais mensagens.'),
  ('Retorno V2', 'retorno', E'{{primeiro_nome}}, chegou a hora do retorno. Posso te oferecer dois horários nesta semana?\nPara parar de receber, responda SAIR.'),
  ('Retorno V3', 'retorno', E'Faz um tempinho desde seu {{procedimento}}, {{primeiro_nome}}. Que tal marcarmos seu retorno?\nResponda SAIR se não quiser mais ouvir da gente.'),

  ('Recall V1', 'recall', E'{{primeiro_nome}}, quanto tempo! Que tal cuidar de você de novo? Tenho horários disponíveis na próxima semana.\nResponda SAIR para parar de receber.'),
  ('Recall V2', 'recall', E'Oi {{primeiro_nome}}, lembrei de você por aqui. Posso te separar um horário para uma nova avaliação?\nPara não receber mais, responda SAIR.'),
  ('Recall V3', 'recall', E'{{primeiro_nome}}, sentimos saudade. Vamos retomar seus cuidados? Me diz um dia bom pra você.\nResponda SAIR a qualquer momento.'),

  ('Aniversário V1', 'aniversario', E'Feliz aniversário, {{primeiro_nome}}! Que esse novo ciclo venha leve. — {{nome_clinica}}\nResponda SAIR para não receber mais mensagens.'),
  ('Aniversário V2', 'aniversario', E'{{primeiro_nome}}, hoje é o seu dia! Toda a equipe da {{nome_clinica}} deseja muita saúde e alegria. 🎉\nPara parar de receber, responda SAIR.'),
  ('Aniversário V3', 'aniversario', E'Parabéns, {{primeiro_nome}}! Que o seu dia seja bonito como você. Um abraço da {{nome_clinica}}.\nResponda SAIR se preferir não receber.'),

  ('Reativação V1', 'reativacao', E'{{primeiro_nome}}, faz um tempinho que não nos vemos. Posso te ajudar a voltar à rotina de cuidados?\nResponda SAIR para parar de receber mensagens.'),
  ('Reativação V2', 'reativacao', E'Oi {{primeiro_nome}}, passando pra dizer que estamos por aqui se você quiser retomar seus cuidados.\nPara não receber mais, responda SAIR.'),
  ('Reativação V3', 'reativacao', E'{{primeiro_nome}}, lembramos de você. Quando quiser conversar sobre voltar, é só responder por aqui.\nResponda SAIR a qualquer momento.'),

  ('No-show V1', 'no_show', E'Oi {{primeiro_nome}}, sentimos sua falta hoje. Aconteceu algo? Posso já remarcar para você.\nResponda SAIR para não receber mais.'),
  ('No-show V2', 'no_show', E'{{primeiro_nome}}, percebemos que não conseguiu vir. Tudo bem? Quando quiser, marcamos um novo horário.\nPara parar de receber, responda SAIR.'),
  ('No-show V3', 'no_show', E'Tudo certo, {{primeiro_nome}}? Como você não pôde comparecer, deixamos a porta aberta — me diz quando puder remarcar.\nResponda SAIR se preferir não receber.')
) AS v(nome, tipo, corpo)
WHERE NOT EXISTS (
  SELECT 1 FROM public.modelos_mensagem m WHERE m.nome = v.nome
);