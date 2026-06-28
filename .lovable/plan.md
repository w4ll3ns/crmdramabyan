## Painel de diagnóstico das automações

Tela só-leitura em `Configurações › Automações › Diagnóstico` que verifica de uma vez se a régua tem chance real de disparar.

### Rota / acesso
- Nova aba **"Diagnóstico"** no `SegmentedControl` existente em `src/routes/_authenticated.app.configuracoes.automacoes.tsx` (junto de Réguas / Modelos / Janela / Métricas).
- Componente novo: `src/components/automacoes/DiagnosticoTab.tsx`.

### Checagens (uma linha de status cada — OK / Atenção / Falha)
1. **Pausa global** — `settings.automacoes_pausado` deve ser `false`.
2. **Pausa automática (shadowban)** — `settings.automacoes_pausa_auto.ativo` deve ser `false`; se ativo, mostra `desde` e `motivo` + botão "Retomar" (já existe a mutation).
3. **Z-API conectada** — lê `zapi_instances` (já feito via `useZapiStatus`); status `connected`.
4. **Modelos ativos por tipo automático** — `confirmacao`, `lembrete`, `pos_procedimento`, `retorno`, `recall`, `aniversario`, `reativacao`, `no_show`: cada um precisa ter ≥1 ativo. Lista os tipos sem variante ativa.
5. **Janela de envio** — mostra a janela configurada e se o horário atual (America/Fortaleza) está dentro.
6. **Cron job agendado** — chamada a uma RPC nova `public.diag_cron_jobs()` (security definer) que devolve `jobname, schedule, active, last_status, last_start` filtrados a jobs cujo `command` contém `/api/public/hooks/reguas-cron`. Sem acesso ao schema `cron` pelo cliente; a RPC encapsula a leitura.
7. **Última execução do cron** — `last_start` < 5 min e `last_status = 'succeeded'`. Se nunca rodou, status "Falha — cron não está agendado".
8. **Fila de mensagens** — contagens em `mensagens_agendadas`:
   - `pendentes` (status `pendente`, `agendado_para <= now() + 24h`)
   - `atrasadas` (status `pendente`, `agendado_para < now() - 5 min`) → vermelho se >0
   - `enviando` (status `enviando` há mais de 10 min) → atenção
   - `falhas_24h` (status `falha` nas últimas 24h)
9. **Próximas 5 mensagens** — lista `tipo`, `paciente.nome`, `agendado_para` (BRT), `status`, das próximas 5 pendentes.

### Dados (sem mudanças de schema)
- Migração só adiciona a RPC `diag_cron_jobs()`:
  ```sql
  CREATE OR REPLACE FUNCTION public.diag_cron_jobs()
  RETURNS TABLE(jobname text, schedule text, active boolean,
                last_status text, last_start timestamptz)
  LANGUAGE sql SECURITY DEFINER SET search_path = public, cron AS $$
    SELECT j.jobname, j.schedule, j.active,
           r.status::text, r.start_time
      FROM cron.job j
      LEFT JOIN LATERAL (
        SELECT status, start_time FROM cron.job_run_details
         WHERE jobid = j.jobid ORDER BY start_time DESC LIMIT 1
      ) r ON true
     WHERE j.command ILIKE '%/api/public/hooks/reguas-cron%';
  $$;
  REVOKE ALL ON FUNCTION public.diag_cron_jobs() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.diag_cron_jobs() TO authenticated;
  ```
  Restringido a `authenticated`; o componente já está atrás do gate `_authenticated` e da aba admin.

### Hook
- `src/hooks/useDiagnostico.ts` com `useDiagnostico()` que faz em paralelo:
  - select em `settings` (chaves: `automacoes_pausado`, `automacoes_pausa_auto`, `regua_janela`, etc.)
  - select em `zapi_instances`
  - select em `modelos_mensagem` agrupado por tipo
  - `rpc('diag_cron_jobs')`
  - contagens em `mensagens_agendadas` (head + count exact)
  - próximas 5 pendentes (join paciente)
- `refetchInterval: 30_000` enquanto a aba estiver aberta.

### UI
- Cards verticais, cada checagem como `StatusRow` (ícone ✓/⚠/✗, título, descrição curta, "como resolver" quando falha).
- Bloco final: tabela das próximas 5 mensagens.
- Botão "Re-checar agora" → `refetch()`.

### Critérios de aceite
- [ ] Aba "Diagnóstico" aparece em `Configurações › Automações` (admin).
- [ ] Cada checagem mostra status verde/amarelo/vermelho com motivo.
- [ ] Se o cron não estiver agendado ou nunca tiver rodado, aparece destaque vermelho com o nome esperado do job.
- [ ] Lista de próximas 5 mensagens reflete o que está em `mensagens_agendadas`.
- [ ] Nenhuma alteração nas funções de envio, nos modelos ou nas réguas.
