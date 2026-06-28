
CREATE OR REPLACE FUNCTION public.trg_agendamento_after_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pos_cfg jsonb;
  ret_cfg jsonb;
  rec_cfg jsonb;
  ns_cfg jsonb;
  proc record;
  dia int;
  base_data date;
  envio timestamptz;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

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
    INSERT INTO public.tasks (titulo, descricao, prioridade, status, paciente_id, agendamento_id)
      SELECT 'Remarcar ' || COALESCE(p.nome, 'paciente'),
             'Paciente faltou ao agendamento.',
             'alta'::public.task_priority, 'pendente'::public.task_status,
             NEW.paciente_id, NEW.id
        FROM public.pacientes p WHERE p.id = NEW.paciente_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enfileirar_automacao(_paciente_id uuid, _tipo modelo_tipo, _agendado_para timestamp with time zone, _agendamento_id uuid DEFAULT NULL::uuid, _vars_extra jsonb DEFAULT '{}'::jsonb, _idemp_key text DEFAULT NULL::text, _idemp_ref uuid DEFAULT NULL::uuid)
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

  SELECT id, corpo INTO modelo
    FROM public.modelos_mensagem
    WHERE tipo = _tipo AND ativo = true
    ORDER BY updated_at DESC LIMIT 1;
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

-- Seed settings: ensure unified pause + clinica_nome exist; migrate legacy values
INSERT INTO public.settings (chave, valor)
  VALUES ('automacoes_pausado', 'false'::jsonb)
  ON CONFLICT (chave) DO NOTHING;

UPDATE public.settings s SET valor = lp.valor
  FROM (SELECT valor FROM public.settings WHERE chave = 'regua_pausado') lp
  WHERE s.chave = 'automacoes_pausado'
    AND (s.valor IS NULL OR s.valor = 'false'::jsonb)
    AND lp.valor IS NOT NULL AND lp.valor <> 'false'::jsonb;

INSERT INTO public.settings (chave, valor)
  VALUES ('clinica_nome', '"Clínica"'::jsonb)
  ON CONFLICT (chave) DO NOTHING;

UPDATE public.settings s SET valor = legacy.valor
  FROM (SELECT valor FROM public.settings WHERE chave = 'nome_clinica') legacy
  WHERE s.chave = 'clinica_nome'
    AND (s.valor IS NULL OR s.valor = '"Clínica"'::jsonb)
    AND legacy.valor IS NOT NULL;

-- Revoga execução pública
REVOKE EXECUTE ON FUNCTION public.run_regua_aniversario() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_regua_reativacao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enfileirar_automacao(uuid, public.modelo_tipo, timestamptz, uuid, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_regua_aniversario() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_regua_reativacao() TO service_role;
GRANT EXECUTE ON FUNCTION public.enfileirar_automacao(uuid, public.modelo_tipo, timestamptz, uuid, jsonb, text, uuid) TO service_role;

-- Reagenda cron jobs incluindo header x-cron-secret
SELECT cron.unschedule('processar-mensagens-5min');
SELECT cron.unschedule('regua-aniversario');
SELECT cron.unschedule('regua-reativacao');

SELECT cron.schedule(
  'processar-mensagens-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ehbgrqqleluhyzwwhbol.supabase.co/functions/v1/processar-mensagens-agendadas',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoYmdycXFsZWx1aHl6d3doYm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NDgwNjcsImV4cCI6MjA5ODIyNDA2N30.Lhw17bNm_-lqi19xUxvswlU3HL84n7hQezvWEyYzfYc","x-cron-secret":"55c65dc8fe56c2abc29f87c2e841b742ca807087c040e32b0bfcbf393abe0ccc"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'regua-aniversario',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ad354cb1-87ea-4a9c-8eed-f91574a39190.lovable.app/api/public/hooks/reguas-cron?job=aniversario',
    headers := '{"Content-Type":"application/json","x-cron-secret":"55c65dc8fe56c2abc29f87c2e841b742ca807087c040e32b0bfcbf393abe0ccc"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'regua-reativacao',
  '0 12 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://project--ad354cb1-87ea-4a9c-8eed-f91574a39190.lovable.app/api/public/hooks/reguas-cron?job=reativacao',
    headers := '{"Content-Type":"application/json","x-cron-secret":"55c65dc8fe56c2abc29f87c2e841b742ca807087c040e32b0bfcbf393abe0ccc"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
