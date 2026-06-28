## Objetivo
Refazer `src/routes/_authenticated.app.index.tsx` como tela inicial calorosa, com dados reais do Supabase, indicadores de retenção (admin) e atalhos rápidos.

## Layout

```
[Header oculto] (usa saudação própria, não AppHeader)
─────────────────────────────
Bom dia,                       ⚙
{Primeiro Nome}      ← serif display
ter, 28 de junho · Hoje
─────────────────────────────
Chips: + Nova conversa · Agendar · Novo lead
─────────────────────────────
Card grande "Agenda de hoje"
  • N atendimentos · X a confirmar
  • Próximos 3 (avatar + hora + procedimento + status)
  • CTA "Ver agenda"
─────────────────────────────
Grid 2 col:
  [Conversas não lidas N]   [Leads novos N]
  [Follow-ups atrasados N]  [No-show do mês N] (admin)
─────────────────────────────
Card "Mini-funil" (oportunidades ativas)
  Por etapa: contagem + valor estimado
  Barras horizontais proporcionais
─────────────────────────────
[admin] Card "Retenção"
  • Ticket médio por procedimento (top 3)
  • Taxa de recall convertido (30d)
  • No-show do mês (%)
─────────────────────────────
FAB: + (abre sheet com 3 ações)
BottomNav
```

## Fontes de dados (Supabase, React Query)

Novo `src/hooks/useHomeDashboard.ts` agrupando queries (cada uma com `queryKey` próprio para realtime/invalidate):

1. **Saudação**: `profiles.name` do user logado (fallback email). Hora local define "Bom dia/Boa tarde/Boa noite".
2. **Agenda hoje** (reusa `useAgendamentosRange(startOfDay, endOfDay)` + `useAConfirmarHojeCount`): mostra próximos 3 com status != cancelado/realizado, ordenados por `data_hora`.
3. **Conversas não lidas**: `useUnreadCount` (já existe).
4. **Leads novos**: `oportunidades` count `etapa='novo_lead'` (ou primeira etapa do enum) e `status='ativa'` criados nos últimos 7d.
5. **Follow-ups atrasados**: count de `oportunidades` com `proximo_followup_em < now()` e `status='ativa'`; complementa com `tasks` `status='pendente' and due_date<now()`.
6. **Mini-funil**: `oportunidades` agrupado por `etapa` (apenas `status='ativa'`) → `{etapa, count, soma(valor_estimado)}`.
7. **Retenção (admin)**:
   - Ticket médio por procedimento: agendamentos `status='realizado'` últimos 90d, `avg(valor)` agrupado por `procedimento_id`, join `procedimentos.nome`, top 3 por volume.
   - Taxa de recall convertido: `automacao_eventos` `tipo='recall'` nos últimos 30d como denominador; numerador = pacientes desses eventos que agendaram (`agendamentos.created_at` > evento) na janela.
   - No-show do mês: `count(status='faltou') / count(status in ('realizado','faltou'))` no mês corrente.

Admin gating via `useIsAdmin()`.

## Componentes

- Reusar `StatCard`, `ListRow`, `StatusBadge`, `Chip`, `ChipRow`, `Fab`, `SectionHeader`.
- Novos componentes locais ao arquivo home:
  - `AgendaHojeCard` — card grande com próximos 3.
  - `MiniFunilCard` — barras com `etapa`, `count`, `valor` formatado em BRL.
  - `RetencaoCard` (admin) — 3 mini-blocos.
  - `QuickActionsSheet` — sheet do FAB com 3 ações.
- Saudação serif: aplicar `font-serif` (Tailwind) ou classe utilitária já existente; verificar `styles.css` antes de adicionar. Se não houver serif configurada, adicionar via `<link>` no `__root.tsx` (ex.: "Instrument Serif") e `--font-serif` em `styles.css` + utilitária `.text-serif-display`.

## Navegação dos atalhos

- "Nova conversa" → `/app/conversas` (abrir modal de seleção de paciente em fase 2; por ora navega).
- "Agendar" → `/app/agenda?novo=1` (a rota agenda já trata; senão apenas navega para `/app/agenda`).
- "Novo lead" → `/app/funil` (futuro sheet; por ora navega).
- Cards: agenda → `/app/agenda`; conversas → `/app/conversas`; leads/follow-ups/funil → `/app/funil`.

## Estados

- Loading: skeletons leves (`Skeleton` shadcn) nos cards.
- Vazio: micro-mensagens ("Nenhum atendimento hoje", "Tudo em dia ✨").
- Erros silenciados (mostra 0/—) para não quebrar a home.

## Arquivos

- **Editar**: `src/routes/_authenticated.app.index.tsx` (reescrever).
- **Criar**: `src/hooks/useHomeDashboard.ts` (queries agrupadas).
- **Possível**: `src/routes/__root.tsx` (+ link Google Font serif) e `src/styles.css` (token `--font-serif`) — só se serif ainda não estiver disponível.

## Sem mudanças

- Sem migrações: todos os dados existem.
- Sem alterar `AppShell`/`BottomNav`.
- Sem mexer em automações/edge functions.

## Critério de aceite

- Saudação com primeiro nome real + data PT-BR.
- Cards exibem números reais (validados contra Supabase).
- Atalhos navegam para rotas existentes.
- Bloco de retenção só aparece para admin e usa fórmulas descritas.
- Visual coerente com o resto do app (cards `rounded-3xl shadow-soft`, tipografia consistente).
