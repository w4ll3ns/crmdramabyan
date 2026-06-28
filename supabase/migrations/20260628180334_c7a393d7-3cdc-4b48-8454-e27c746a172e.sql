
-- ============================================================
-- Settings: 8 réguas com toggle + parâmetros (jsonb)
-- ============================================================
INSERT INTO public.settings (chave, valor) VALUES
  ('regua_pausado', 'false'::jsonb),
  ('regua_confirmacao', '{"enabled":true,"hora_d1":"18:00","hora_d0":"09:00","antecedencia_horas_minimo":12}'::jsonb),
  ('regua_lembrete', '{"enabled":true,"horas_antes":3}'::jsonb),
  ('regua_pos_procedimento', '{"enabled":true,"dias":[1,7]}'::jsonb),
  ('regua_retorno', '{"enabled":true}'::jsonb),
  ('regua_recall', '{"enabled":true}'::jsonb),
  ('regua_aniversario', '{"enabled":true,"hora":"08:00"}'::jsonb),
  ('regua_no_show', '{"enabled":true,"horas_apos":2}'::jsonb),
  ('regua_reativacao', '{"enabled":true,"meses_inatividade":6,"janela_dias":30}'::jsonb)
ON CONFLICT (chave) DO NOTHING;

-- ============================================================
-- Colunas extras em agendamentos
-- ============================================================
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS confirmacao_resposta text
    CHECK (confirmacao_resposta IS NULL OR confirmacao_resposta IN ('confirmado','remarcar')),
  ADD COLUMN IF NOT EXISTS confirmacao_respondida_em timestamptz;

-- ============================================================
-- Tabela de eventos de automação (idempotência)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.automacao_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  ref_id uuid,
  ocorreu_em date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Fortaleza')::date,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS automacao_eventos_unq
  ON public.automacao_eventos (paciente_id, tipo, COALESCE(ref_id, '00000000-0000-0000-0000-000000000000'::uuid), ocorreu_em);

GRANT SELECT ON public.automacao_eventos TO authenticated;
GRANT ALL ON public.automacao_eventos TO service_role;

ALTER TABLE public.automacao_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view automacao_eventos"
  ON public.automacao_eventos FOR SELECT TO authenticated USING (true);

-- ============================================================
-- Helper: enfileira mensagem automática
-- Retorna o id criado, ou NULL se foi pulado (régua/paciente/duplicado).
-- ============================================================
CREATE OR REPLACE FUNCTION public.enfileirar_automacao(
  _paciente_id uuid,
  _tipo public.modelo_tipo,
  _agendado_para timestamptz,
  _agendamento_id uuid DEFAULT NULL,
  _vars_extra jsonb DEFAULT '{}'::jsonb,
  _idemp_key text DEFAULT NULL,
  _idemp_ref uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- Pausa global
  SELECT (valor)::text::boolean INTO pausado FROM public.settings WHERE chave = 'regua_pausado';
  IF COALESCE(pausado, false) THEN RETURN NULL; END IF;

  -- Paciente
  SELECT id, nome, aceita_automacoes INTO pac FROM public.pacientes WHERE id = _paciente_id;
  IF pac.id IS NULL OR NOT COALESCE(pac.aceita_automacoes, true) THEN RETURN NULL; END IF;

  -- Idempotência (só registra DEPOIS do insert para evitar gravar antes da régua ativa, mas
  -- a checagem antecipada evita trabalho)
  IF _idemp_key IS NOT NULL THEN
    PERFORM 1 FROM public.automacao_eventos
      WHERE paciente_id = _paciente_id
        AND tipo = _idemp_key
        AND COALESCE(ref_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = COALESCE(_idemp_ref, '00000000-0000-0000-0000-000000000000'::uuid)
        AND ocorreu_em = (now() AT TIME ZONE 'America/Fortaleza')::date;
    IF FOUND THEN RETURN NULL; END IF;
  END IF;

  -- Modelo ativo do tipo
  SELECT id, corpo INTO modelo
    FROM public.modelos_mensagem
    WHERE tipo = _tipo AND ativo = true
    ORDER BY updated_at DESC LIMIT 1;
  IF modelo.id IS NULL THEN RETURN NULL; END IF;

  -- Conversa por telefone (opcional)
  SELECT c.id INTO conv_id
    FROM public.conversations c
    JOIN public.pacientes p ON p.id = _paciente_id
   WHERE c.telefone = COALESCE(p.whatsapp, p.telefone)
   LIMIT 1;

  -- Dados do agendamento (se houver)
  IF _agendamento_id IS NOT NULL THEN
    SELECT * INTO ag FROM public.agendamentos WHERE id = _agendamento_id;
    IF ag.procedimento_id IS NOT NULL THEN
      SELECT * INTO proc FROM public.procedimentos WHERE id = ag.procedimento_id;
      proc_nome := proc.nome;
    END IF;
  END IF;

  -- Nome da clínica (settings)
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

  -- Marca evento de idempotência
  IF _idemp_key IS NOT NULL THEN
    INSERT INTO public.automacao_eventos (paciente_id, tipo, ref_id, payload)
      VALUES (_paciente_id, _idemp_key, _idemp_ref, jsonb_build_object('mensagem_id', msg_id))
      ON CONFLICT DO NOTHING;
  END IF;

  RETURN msg_id;
END;
$$;

-- ============================================================
-- Trigger: ao criar agendamento → confirmação D-1, D-0, lembrete
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_agendamento_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conf jsonb;
  lemb jsonb;
  ag_local timestamptz;
  d1 timestamptz;
  d0 timestamptz;
  lembrete_em timestamptz;
  hora_d1 text;
  hora_d0 text;
  antec_horas int;
  horas_antes int;
BEGIN
  -- Só para agendamentos futuros e com paciente que aceita automações
  IF NEW.data_hora <= now() THEN RETURN NEW; END IF;
  IF NEW.status IN ('cancelado','realizado','faltou') THEN RETURN NEW; END IF;

  SELECT valor INTO conf FROM public.settings WHERE chave = 'regua_confirmacao';
  SELECT valor INTO lemb FROM public.settings WHERE chave = 'regua_lembrete';

  -- Confirmação D-1 / D-0
  IF COALESCE((conf->>'enabled')::boolean, true) THEN
    hora_d1 := COALESCE(conf->>'hora_d1', '18:00');
    hora_d0 := COALESCE(conf->>'hora_d0', '09:00');
    antec_horas := COALESCE((conf->>'antecedencia_horas_minimo')::int, 12);

    IF NEW.data_hora > now() + (antec_horas || ' hours')::interval THEN
      -- D-1 18:00 BRT
      d1 := ((NEW.data_hora AT TIME ZONE 'America/Fortaleza')::date - 1 || ' ' || hora_d1)::timestamp
              AT TIME ZONE 'America/Fortaleza';
      IF d1 > now() THEN
        PERFORM public.enfileirar_automacao(
          NEW.paciente_id, 'confirmacao'::public.modelo_tipo, d1, NEW.id,
          '{}'::jsonb, 'confirmacao_d1', NEW.id
        );
      END IF;
      -- D-0 manhã
      d0 := ((NEW.data_hora AT TIME ZONE 'America/Fortaleza')::date || ' ' || hora_d0)::timestamp
              AT TIME ZONE 'America/Fortaleza';
      IF d0 > now() AND d0 < NEW.data_hora THEN
        PERFORM public.enfileirar_automacao(
          NEW.paciente_id, 'confirmacao'::public.modelo_tipo, d0, NEW.id,
          '{}'::jsonb, 'confirmacao_d0', NEW.id
        );
      END IF;
      -- marca como aguardando confirmação
      UPDATE public.agendamentos SET aguardando_confirmacao = true WHERE id = NEW.id;
    END IF;
  END IF;

  -- Lembrete N horas antes
  IF COALESCE((lemb->>'enabled')::boolean, true) THEN
    horas_antes := COALESCE((lemb->>'horas_antes')::int, 3);
    lembrete_em := NEW.data_hora - (horas_antes || ' hours')::interval;
    IF lembrete_em > now() THEN
      PERFORM public.enfileirar_automacao(
        NEW.paciente_id, 'lembrete'::public.modelo_tipo, lembrete_em, NEW.id,
        '{}'::jsonb, 'lembrete', NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agendamentos_after_insert ON public.agendamentos;
CREATE TRIGGER trg_agendamentos_after_insert
AFTER INSERT ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_agendamento_after_insert();

-- ============================================================
-- Trigger: transições de status (realizado/faltou/cancelado)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_agendamento_after_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pos_cfg jsonb;
  ret_cfg jsonb;
  rec_cfg jsonb;
  ns_cfg jsonb;
  proc record;
  dia int;
  base_data date;
  envio timestamptz;
  novo_ag_id uuid;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  -- Cancelado/remarcar: cancela mensagens automáticas pendentes desse agendamento
  IF NEW.status = 'cancelado' THEN
    UPDATE public.mensagens_agendadas
       SET status = 'cancelada', erro = COALESCE(erro, 'agendamento_cancelado')
     WHERE agendamento_id = NEW.id
       AND status = 'pendente'
       AND origem = 'automacao';
    RETURN NEW;
  END IF;

  IF NEW.status = 'realizado' THEN
    base_data := (NEW.data_hora AT TIME ZONE 'America/Fortaleza')::date;
    SELECT valor INTO pos_cfg FROM public.settings WHERE chave = 'regua_pos_procedimento';
    SELECT valor INTO ret_cfg FROM public.settings WHERE chave = 'regua_retorno';
    SELECT valor INTO rec_cfg FROM public.settings WHERE chave = 'regua_recall';

    IF COALESCE((pos_cfg->>'enabled')::boolean, true) THEN
      FOR dia IN
        SELECT jsonb_array_elements_text(COALESCE(pos_cfg->'dias','[1,7]'::jsonb))::int
      LOOP
        envio := ((base_data + dia) || ' 10:00')::timestamp AT TIME ZONE 'America/Fortaleza';
        IF envio > now() THEN
          PERFORM public.enfileirar_automacao(
            NEW.paciente_id, 'pos_procedimento'::public.modelo_tipo, envio, NEW.id,
            jsonb_build_object('dias', dia),
            'pos_procedimento_d' || dia, NEW.id
          );
        END IF;
      END LOOP;
    END IF;

    IF NEW.procedimento_id IS NOT NULL THEN
      SELECT * INTO proc FROM public.procedimentos WHERE id = NEW.procedimento_id;

      IF COALESCE((ret_cfg->>'enabled')::boolean, true) AND proc.retorno_dias IS NOT NULL AND proc.retorno_dias > 0 THEN
        envio := ((base_data + proc.retorno_dias) || ' 10:00')::timestamp AT TIME ZONE 'America/Fortaleza';
        IF envio > now() THEN
          PERFORM public.enfileirar_automacao(
            NEW.paciente_id, 'retorno'::public.modelo_tipo, envio, NEW.id,
            '{}'::jsonb, 'retorno', NEW.id
          );
        END IF;
      END IF;

      IF COALESCE((rec_cfg->>'enabled')::boolean, true) AND proc.recorrencia_dias IS NOT NULL AND proc.recorrencia_dias > 0 THEN
        envio := ((base_data + proc.recorrencia_dias) || ' 10:00')::timestamp AT TIME ZONE 'America/Fortaleza';
        IF envio > now() THEN
          PERFORM public.enfileirar_automacao(
            NEW.paciente_id, 'recall'::public.modelo_tipo, envio, NEW.id,
            '{}'::jsonb, 'recall', NEW.id
          );
        END IF;
      END IF;
    END IF;
  END IF;

  IF NEW.status = 'faltou' THEN
    SELECT valor INTO ns_cfg FROM public.settings WHERE chave = 'regua_no_show';
    IF COALESCE((ns_cfg->>'enabled')::boolean, true) THEN
      envio := now() + (COALESCE((ns_cfg->>'horas_apos')::int, 2) || ' hours')::interval;
      PERFORM public.enfileirar_automacao(
        NEW.paciente_id, 'no_show'::public.modelo_tipo, envio, NEW.id,
        '{}'::jsonb, 'no_show', NEW.id
      );
    END IF;
    -- Cria tarefa de remarcar
    INSERT INTO public.tasks (titulo, descricao, prioridade, status, paciente_id, agendamento_id)
      SELECT 'Remarcar ' || COALESCE(p.nome, 'paciente'),
             'Paciente faltou ao agendamento.',
             'alta'::public.task_prioridade, 'pendente'::public.task_status,
             NEW.paciente_id, NEW.id
        FROM public.pacientes p WHERE p.id = NEW.paciente_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agendamentos_after_update ON public.agendamentos;
CREATE TRIGGER trg_agendamentos_after_update
AFTER UPDATE OF status ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_agendamento_after_update();

-- ============================================================
-- Função pública: jobs de aniversário e reativação (chamados via cron)
-- ============================================================
CREATE OR REPLACE FUNCTION public.run_regua_aniversario()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg jsonb;
  hora text;
  envio timestamptz;
  cont int := 0;
  pac record;
BEGIN
  SELECT valor INTO cfg FROM public.settings WHERE chave = 'regua_aniversario';
  IF NOT COALESCE((cfg->>'enabled')::boolean, true) THEN RETURN 0; END IF;
  hora := COALESCE(cfg->>'hora', '08:00');

  FOR pac IN
    SELECT id, data_nascimento
      FROM public.pacientes
     WHERE aceita_automacoes = true
       AND data_nascimento IS NOT NULL
       AND to_char(data_nascimento, 'MM-DD')
         = to_char((now() AT TIME ZONE 'America/Fortaleza')::date, 'MM-DD')
  LOOP
    envio := ((now() AT TIME ZONE 'America/Fortaleza')::date || ' ' || hora)::timestamp
              AT TIME ZONE 'America/Fortaleza';
    IF envio < now() THEN envio := now() + interval '1 minute'; END IF;
    IF public.enfileirar_automacao(
        pac.id, 'aniversario'::public.modelo_tipo, envio, NULL,
        '{}'::jsonb, 'aniversario', NULL
      ) IS NOT NULL THEN
      cont := cont + 1;
    END IF;
  END LOOP;
  RETURN cont;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_regua_reativacao()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg jsonb;
  meses int;
  janela int;
  cont int := 0;
  pac record;
  envio timestamptz;
BEGIN
  SELECT valor INTO cfg FROM public.settings WHERE chave = 'regua_reativacao';
  IF NOT COALESCE((cfg->>'enabled')::boolean, true) THEN RETURN 0; END IF;
  meses := COALESCE((cfg->>'meses_inatividade')::int, 6);
  janela := COALESCE((cfg->>'janela_dias')::int, 30);

  FOR pac IN
    SELECT p.id
      FROM public.pacientes p
     WHERE p.aceita_automacoes = true
       AND NOT EXISTS (
         SELECT 1 FROM public.agendamentos a
          WHERE a.paciente_id = p.id
            AND a.status = 'realizado'
            AND a.data_hora > now() - (meses || ' months')::interval
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.automacao_eventos e
          WHERE e.paciente_id = p.id
            AND e.tipo = 'reativacao'
            AND e.ocorreu_em > (now() AT TIME ZONE 'America/Fortaleza')::date - janela
       )
       AND EXISTS (
         SELECT 1 FROM public.agendamentos a2 WHERE a2.paciente_id = p.id
       )
  LOOP
    envio := now() + interval '5 minutes';
    IF public.enfileirar_automacao(
        pac.id, 'reativacao'::public.modelo_tipo, envio, NULL,
        '{}'::jsonb, 'reativacao', NULL
      ) IS NOT NULL THEN
      cont := cont + 1;
    END IF;
  END LOOP;
  RETURN cont;
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_regua_aniversario() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.run_regua_reativacao() TO authenticated, anon, service_role;
