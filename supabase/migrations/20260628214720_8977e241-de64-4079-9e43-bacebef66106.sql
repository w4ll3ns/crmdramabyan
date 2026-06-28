
CREATE INDEX IF NOT EXISTS agendamentos_data_hora_idx
  ON public.agendamentos (data_hora);

CREATE INDEX IF NOT EXISTS agendamentos_paciente_aguardando_idx
  ON public.agendamentos (paciente_id, aguardando_confirmacao);

CREATE INDEX IF NOT EXISTS oportunidades_etapa_idx
  ON public.oportunidades (etapa);

CREATE INDEX IF NOT EXISTS oportunidades_status_idx
  ON public.oportunidades (status);

CREATE INDEX IF NOT EXISTS oportunidades_paciente_idx
  ON public.oportunidades (paciente_id);

CREATE INDEX IF NOT EXISTS tasks_status_idx
  ON public.tasks (status);

CREATE INDEX IF NOT EXISTS tasks_paciente_idx
  ON public.tasks (paciente_id);

CREATE INDEX IF NOT EXISTS tasks_responsavel_interno_idx
  ON public.tasks (responsavel_interno_id);

CREATE INDEX IF NOT EXISTS mensagens_agendadas_status_enviada_em_idx
  ON public.mensagens_agendadas (status, enviada_em);
