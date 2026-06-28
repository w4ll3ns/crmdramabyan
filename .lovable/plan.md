## Motor de réguas de automação

Vou implementar 7 réguas + painel, todas com toggle e parâmetros editáveis em **Configurações > Automações** (admin). Todas as mensagens passam pela fila `mensagens_agendadas` que já existe — o processador atual continua sendo o único ponto de envio.

### 1. Schema (1 migração)

**`settings` (seed/upsert)** — uma chave por régua, valor `jsonb`:
- `regua_confirmacao` `{ enabled, hora_d1, hora_d0, antecedencia_horas_minimo }`
- `regua_lembrete` `{ enabled, horas_antes }` (default 3)
- `regua_pos_procedimento` `{ enabled, dias: [1,7] }`
- `regua_retorno` `{ enabled }` (usa `procedimentos.retorno_dias`)
- `regua_recall` `{ enabled }` (usa `procedimentos.recorrencia_dias`)
- `regua_aniversario` `{ enabled, hora: "08:00" }`
- `regua_no_show` `{ enabled, horas_apos: 1 }`
- `regua_reativacao` `{ enabled, meses_inatividade: 6, janela_dias: 30 }`

**`modelo_tipo` enum** — já existe (`confirmacao`, `lembrete`, `pos_procedimento`, `retorno`, `recall`, `aniversario`, `no_show`, `reativacao`). Seed se faltar.

**Novas colunas em `agendamentos`:**
- `confirmacao_resposta` text — `confirmado | remarcar | null`
- `confirmacao_respondida_em` timestamptz
- Já existem `aguardando_confirmacao` e `lembrete_enviado`.

**Novo `automacao_eventos`** (idempotência das réguas únicas):
```
(paciente_id, tipo text, ref_id uuid null, ocorreu_em date)  -- unique
```
Garante "não duplicar" para aniversário/recall/reativação/pós/retorno/no_show.

**Triggers no `agendamentos`** (AFTER INSERT/UPDATE):
- `trg_agendamento_after_insert` — agenda confirmação D-1 18:00 + reforço D-0 manhã (se `data_hora > now() + antecedencia_horas_minimo` e `aceita_automacoes`), agenda lembrete 3h antes.
- `trg_agendamento_after_update` — quando `status` muda:
  - `realizado` → agenda `pos_procedimento` (D+1, D+7), `retorno` (D+retorno_dias se houver), `recall` (D+recorrencia_dias se houver e sem novo agendamento do mesmo procedimento na janela — checagem feita no momento do envio também).
  - `faltou` → agenda `no_show` (D+horas_apos) e cria `tasks` "Remarcar {paciente}".
  - `cancelado`/`remarcar` → cancela `mensagens_agendadas` pendentes desse agendamento (status `pendente` → `cancelada`).

Todas as inserções na fila gravam `automacao_eventos` p/ idempotência e respeitam `aceita_automacoes`, `regua_*.enabled`, e `regua_pausado` global.

### 2. Server functions (TanStack, `requireSupabaseAuth`)

`src/lib/automacoes.functions.ts`:
- `getReguas()` — lê settings das 8 chaves
- `setRegua(chave, params)` — admin only (`has_role`)
- `getMetricasAutomacoes(periodo)` — métricas do painel

### 3. Webhook (zapi-webhook) — confirmação 2 vias

Já trata opt-out. Adicionar: ao receber mensagem do paciente, se existir agendamento futuro próximo com `aguardando_confirmacao=true`:
- regex `^(1|sim|confirmo|ok)` → `status='confirmado'`, `confirmacao_resposta='confirmado'`, `aguardando_confirmacao=false`, enfileira auto-resposta de agradecimento (modelo manual curto).
- regex `^(2|remarcar|n[ãa]o|cancelar)` → `status='cancelado'`, `confirmacao_resposta='remarcar'`, cria `tasks` "Remarcar {paciente}" prioridade alta, auto-resposta confirmando recebimento.
- Cancela mensagens pendentes (`lembrete`, reforço de confirmação) desse agendamento.
- `SAIR/PARAR` continua silenciando.

### 4. Cron jobs (pg_cron)

- **Existente** `processar-mensagens-agendadas` — segue como único ponto de envio.
- **Novo `regua-aniversario`** — diário 08:00 BRT (`0 11 * * *` UTC): pacientes com `data_nascimento`=hoje, `aceita_automacoes=true`, enfileira modelo `aniversario` se não houver evento hoje.
- **Novo `regua-reativacao`** — semanal (`0 12 * * 1` UTC): pacientes sem agendamento `realizado` há > N meses e sem evento de reativação na janela; enfileira modelo `reativacao`.

Ambos via TanStack server route `/api/public/hooks/reguas-cron` com `apikey` anon, single endpoint que despacha por `?job=`.

### 5. UI — Configurações > Automações

Expandir `_authenticated.app.configuracoes.automacoes.tsx` (3 abas):

1. **Réguas** — lista das 8 réguas, cada uma com:
   - Toggle ligado/desligado
   - Parâmetros editáveis (hora, dias, horas antes, meses, etc.)
   - Modelo associado (link p/ editor)
   - Última métrica resumida
2. **Modelos** — editor existente.
3. **Janela e limites** — form existente.

**Novo painel "Métricas"** (4ª aba ou no topo):
- Taxa de confirmação (confirmações / mensagens de confirmação enviadas) — 30 dias
- Taxa de no-show (faltou / total realizados+faltou)
- Enviadas × respondidas (por régua)
- Recalls convertidos (recall enviado → novo agendamento em 30 dias)
- Gráfico simples (recharts já instalado, se houver) ou cards numéricos.

### 6. Agenda — badge "X a confirmar hoje"

Já existe hook `useAConfirmarHojeCount` (badge no bottom nav). Adicionar pill no topo da página da Agenda mostrando `{n} a confirmar hoje`, filtro rápido.

### 7. Critérios de aceite mapeados

- Criar agendamento → trigger enfileira confirmação D-1 e D-0 e lembrete 3h antes. ✓
- Resposta 1/2 no webhook atualiza status + auto-resposta + tarefa. ✓
- Opt-out silencia + cancela pendentes. ✓ (já existe; manter)
- `realizado` agenda pós/retorno/recall via trigger. ✓
- Aniversário/no-show/reativação sem duplicar via `automacao_eventos` unique. ✓
- Painel com métricas reais via `getMetricasAutomacoes`. ✓

### Arquivos

**Novos**
- `supabase/migrations/<ts>_reguas_automacao.sql`
- `src/lib/automacoes.functions.ts`
- `src/routes/api/public/hooks/reguas-cron.ts`
- `src/components/automacoes/ReguaCard.tsx`
- `src/components/automacoes/PainelMetricas.tsx`
- `src/hooks/useReguas.ts`, `useMetricasAutomacoes.ts`

**Editados**
- `src/routes/_authenticated.app.configuracoes.automacoes.tsx` (4 abas)
- `src/routes/_authenticated.app.agenda.tsx` (badge a confirmar)
- `supabase/functions/zapi-webhook/index.ts` (confirmação 2 vias)
- Seed de cron via insert tool após deploy do route.

### Pontos de decisão antes de implementar

1. **Auto-resposta de agradecimento (confirmação) e de remarcar**: crio modelo extra `confirmacao_ack` / uso texto fixo no código? Sugiro texto fixo curto e neutro ("Obrigada pela confirmação! Até breve." / "Anotado, vou te chamar para remarcar.") — evita poluir editor.
2. **Métricas de "recalls convertidos"**: considero conversão se houver novo agendamento (qualquer procedimento) em 30 dias após o envio. Ok?
3. **No-show**: aciono a régua só com transição explícita para `faltou` no status, não automaticamente após a hora do agendamento passar. Confirma?

Posso seguir com esses defaults se preferir não decidir agora.
