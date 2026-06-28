
-- =========================================================
-- 1) Tabela agenda_bloqueios
-- =========================================================
CREATE TABLE IF NOT EXISTS public.agenda_bloqueios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  motivo text,
  dia_inteiro boolean NOT NULL DEFAULT true,
  inicio time,
  fim time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_bloqueios TO authenticated;
GRANT ALL ON public.agenda_bloqueios TO service_role;

ALTER TABLE public.agenda_bloqueios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bloqueios_select_auth" ON public.agenda_bloqueios;
CREATE POLICY "bloqueios_select_auth" ON public.agenda_bloqueios
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "bloqueios_admin_insert" ON public.agenda_bloqueios;
CREATE POLICY "bloqueios_admin_insert" ON public.agenda_bloqueios
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "bloqueios_admin_update" ON public.agenda_bloqueios;
CREATE POLICY "bloqueios_admin_update" ON public.agenda_bloqueios
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "bloqueios_admin_delete" ON public.agenda_bloqueios;
CREATE POLICY "bloqueios_admin_delete" ON public.agenda_bloqueios
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS trg_bloqueios_updated_at ON public.agenda_bloqueios;
CREATE TRIGGER trg_bloqueios_updated_at
  BEFORE UPDATE ON public.agenda_bloqueios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS agenda_bloqueios_data_idx ON public.agenda_bloqueios(data);

-- =========================================================
-- 2) Setting agenda_expediente
-- =========================================================
INSERT INTO public.settings (chave, valor) VALUES
  ('agenda_expediente',
    '{"seg":["08:00","18:00"],"ter":["08:00","18:00"],"qua":["08:00","18:00"],"qui":["08:00","18:00"],"sex":["08:00","18:00"],"sab":null,"dom":null}'::jsonb)
ON CONFLICT (chave) DO NOTHING;

-- =========================================================
-- 3) Validação de expediente + bloqueios
-- =========================================================
CREATE OR REPLACE FUNCTION public.check_agendamento_horario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  exp jsonb;
  dia_key text;
  faixa jsonb;
  abertura time;
  fechamento time;
  d_local timestamp;
  d_date date;
  d_time time;
  fim_time time;
  bloq record;
BEGIN
  IF NEW.status IN ('cancelado','realizado','faltou') THEN
    RETURN NEW;
  END IF;

  d_local := (NEW.data_hora AT TIME ZONE 'America/Fortaleza');
  d_date := d_local::date;
  d_time := d_local::time;
  fim_time := (d_local + (COALESCE(NEW.duracao_minutos,60) || ' minutes')::interval)::time;

  -- Expediente
  SELECT valor INTO exp FROM public.settings WHERE chave = 'agenda_expediente';
  IF exp IS NOT NULL THEN
    dia_key := CASE EXTRACT(DOW FROM d_date)::int
      WHEN 0 THEN 'dom' WHEN 1 THEN 'seg' WHEN 2 THEN 'ter'
      WHEN 3 THEN 'qua' WHEN 4 THEN 'qui' WHEN 5 THEN 'sex'
      WHEN 6 THEN 'sab' END;
    faixa := exp->dia_key;
    IF faixa IS NULL OR jsonb_typeof(faixa) = 'null' THEN
      RAISE EXCEPTION 'Fora do expediente: a clínica não atende neste dia da semana.'
        USING ERRCODE = 'P0001';
    END IF;
    abertura := (faixa->>0)::time;
    fechamento := (faixa->>1)::time;
    IF d_time < abertura OR fim_time > fechamento THEN
      RAISE EXCEPTION 'Fora do expediente: horário deve estar entre % e %.', abertura, fechamento
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Bloqueios
  FOR bloq IN
    SELECT * FROM public.agenda_bloqueios WHERE data = d_date
  LOOP
    IF bloq.dia_inteiro
       OR (bloq.inicio IS NOT NULL AND bloq.fim IS NOT NULL
           AND d_time < bloq.fim AND fim_time > bloq.inicio) THEN
      RAISE EXCEPTION 'Data/horário bloqueado%.',
        CASE WHEN bloq.motivo IS NOT NULL AND bloq.motivo <> ''
             THEN ': ' || bloq.motivo ELSE '' END
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agendamento_horario ON public.agendamentos;
CREATE TRIGGER trg_agendamento_horario
  BEFORE INSERT OR UPDATE OF data_hora, duracao_minutos, status ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.check_agendamento_horario();

-- =========================================================
-- 4) Anti double-booking
-- =========================================================
CREATE OR REPLACE FUNCTION public.check_agendamento_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conflito record;
  novo_ini timestamptz;
  novo_fim timestamptz;
BEGIN
  IF NEW.status NOT IN ('agendado','confirmado') THEN
    RETURN NEW;
  END IF;
  IF NEW.profissional IS NULL OR trim(NEW.profissional) = '' THEN
    RETURN NEW;
  END IF;

  novo_ini := NEW.data_hora;
  novo_fim := NEW.data_hora + (COALESCE(NEW.duracao_minutos,60) || ' minutes')::interval;

  SELECT a.id, a.data_hora, a.duracao_minutos INTO conflito
    FROM public.agendamentos a
   WHERE a.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND a.status IN ('agendado','confirmado')
     AND lower(trim(a.profissional)) = lower(trim(NEW.profissional))
     AND tstzrange(a.data_hora, a.data_hora + (COALESCE(a.duracao_minutos,60) || ' minutes')::interval, '[)')
         && tstzrange(novo_ini, novo_fim, '[)')
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Já existe um agendamento nesse horário para %.', NEW.profissional
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agendamento_overlap ON public.agendamentos;
CREATE TRIGGER trg_agendamento_overlap
  BEFORE INSERT OR UPDATE OF data_hora, duracao_minutos, profissional, status ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.check_agendamento_overlap();

-- =========================================================
-- 5) Trigger after_insert com encaixe <12h
-- =========================================================
CREATE OR REPLACE FUNCTION public.trg_agendamento_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conf jsonb;
  lemb jsonb;
  d1 timestamptz;
  d0 timestamptz;
  lembrete_em timestamptz;
  hora_d1 text;
  hora_d0 text;
  antec_horas int;
  horas_antes int;
  enfileirou_confirmacao boolean := false;
  encaixe timestamptz;
BEGIN
  IF NEW.data_hora <= now() THEN RETURN NEW; END IF;
  IF NEW.status IN ('cancelado','realizado','faltou') THEN RETURN NEW; END IF;

  SELECT valor INTO conf FROM public.settings WHERE chave = 'regua_confirmacao';
  SELECT valor INTO lemb FROM public.settings WHERE chave = 'regua_lembrete';

  IF COALESCE((conf->>'enabled')::boolean, true) THEN
    hora_d1 := COALESCE(conf->>'hora_d1', '18:00');
    hora_d0 := COALESCE(conf->>'hora_d0', '09:00');
    antec_horas := COALESCE((conf->>'antecedencia_horas_minimo')::int, 12);

    IF NEW.data_hora > now() + (antec_horas || ' hours')::interval THEN
      d1 := ((NEW.data_hora AT TIME ZONE 'America/Fortaleza')::date - 1 || ' ' || hora_d1)::timestamp
              AT TIME ZONE 'America/Fortaleza';
      IF d1 > now() THEN
        PERFORM public.enfileirar_automacao(
          NEW.paciente_id, 'confirmacao'::public.modelo_tipo, d1, NEW.id,
          '{}'::jsonb, 'confirmacao_d1', NEW.id
        );
        enfileirou_confirmacao := true;
      END IF;
      d0 := ((NEW.data_hora AT TIME ZONE 'America/Fortaleza')::date || ' ' || hora_d0)::timestamp
              AT TIME ZONE 'America/Fortaleza';
      IF d0 > now() AND d0 < NEW.data_hora THEN
        PERFORM public.enfileirar_automacao(
          NEW.paciente_id, 'confirmacao'::public.modelo_tipo, d0, NEW.id,
          '{}'::jsonb, 'confirmacao_d0', NEW.id
        );
        enfileirou_confirmacao := true;
      END IF;
      IF enfileirou_confirmacao THEN
        UPDATE public.agendamentos SET aguardando_confirmacao = true WHERE id = NEW.id;
      END IF;
    ELSE
      -- Encaixe < antecedencia mínima: lembrete imediato
      encaixe := now() + interval '2 minutes';
      IF encaixe < NEW.data_hora THEN
        PERFORM public.enfileirar_automacao(
          NEW.paciente_id, 'lembrete'::public.modelo_tipo, encaixe, NEW.id,
          '{}'::jsonb, 'lembrete_encaixe', NEW.id
        );
      END IF;
    END IF;
  END IF;

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
