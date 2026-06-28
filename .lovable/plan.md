## Migration: índices de performance

Criar uma única migration com índices `IF NOT EXISTS` nas tabelas e colunas indicadas. Todos B-tree padrão (sem `CONCURRENTLY` — migrations rodam em transação).

```sql
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
```

## Validação

- `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN (...)` confirma os 9 índices.
- `EXPLAIN` em uma query típica do processador (`WHERE status='enviada' AND enviada_em > now() - interval '5 minutes'`) deve usar `mensagens_agendadas_status_enviada_em_idx` (Index/Bitmap Scan, sem Seq Scan).
- `EXPLAIN` na query da Agenda (`WHERE data_hora BETWEEN ... AND ...`) usa `agendamentos_data_hora_idx`.

## Observações

- Confirmo previamente que `responsavel_interno_id` existe em `tasks` e `aguardando_confirmacao` em `agendamentos` lendo o schema antes de aplicar; se algum nome divergir, ajusto o nome da coluna na migration mantendo o restante.
- Não removo nem renomeio índices existentes.
