## Objetivo

Construir a aba **Agenda** mobile-first: navegação Hoje/Dia/Semana, criação rápida via bottom sheet, detalhe com ações de status, e badge "X a confirmar hoje" na navegação.

## Estado atual

- `_authenticated.app.agenda.tsx` é um EmptyState placeholder.
- Tabelas prontas: `agendamentos` (paciente_id, procedimento_id, tipo enum `avaliacao|procedimento|retorno`, data_hora, duracao_minutos default 60, status enum `agendado|confirmado|realizado|faltou|cancelado`, valor, profissional, observacoes, aguardando_confirmacao), `procedimentos` (nome, duracao_minutos, valor_padrao), `pacientes` (nome, foto_url, telefone, whatsapp).
- RLS já permissiva (`agendamentos_all_auth`, `pacientes_all_auth`, `procedimentos_select_auth`).
- Componentes brand prontos: `SegmentedControl`, `BottomSheet` (Drawer), `Fab`, `StatusBadge`, `BrandAvatar`, `AppHeader`.
- `BottomNav` já aceita `badge` por item — ver Mudança 6.

## Mudanças

### 1. `src/lib/agenda.ts` (novo) — helpers de domínio

- Tipos `AgendamentoStatus`, `AgendamentoTipo` reaproveitando o enum gerado em `integrations/supabase/types.ts`.
- `statusMeta(status)` → `{ label, variant: StatusBadge["variant"] }` (agendado=neutral, confirmado=info, realizado=success, faltou=warning, cancelado=danger).
- `tipoLabel(tipo)`.
- `startOfDay/endOfDay/startOfWeek(date)` (semana segunda-domingo), `addDays`, `fmtHora` (HH:mm pt-BR), `fmtDia` (qua, 02), `fmtDataLonga`.

### 2. `src/hooks/useAgenda.ts` (novo) — fetch + realtime

- `useAgendamentosRange(from: Date, to: Date)` → TanStack Query key `["agendamentos", iso(from), iso(to)]`. SELECT com join: `*, paciente:pacientes!agendamentos_paciente_id_fkey(id,nome,foto_url,whatsapp,telefone), procedimento:procedimentos(id,nome,duracao_minutos,valor_padrao)` filtrado por `data_hora gte/lte`, ordenado por `data_hora`.
- `useAConfirmarHojeCount()` → count `agendamentos` com `status='agendado'` e data no dia atual (para o badge).
- Subscription supabase `postgres_changes` em `agendamentos` invalida `["agendamentos"]` e `["agendamentos","confirmar-hoje"]` (espelha o padrão de `useUnreadCount`).
- `useProcedimentos()`, `usePacientesSearch(term)` (top 20 por `ilike nome`).
- Mutations: `useCreateAgendamento`, `useUpdateAgendamentoStatus(id, novoStatus)`, `useUpsertAgendamento` (cobre edição).

### 3. `src/components/agenda/DayStrip.tsx` (novo)

Faixa horizontal rolável (overflow-x-auto, `snap-x snap-mandatory`, scrollbar oculta). Recebe `selected: Date`, `onChange`, gera ±14 dias ao redor de hoje. Cada item: pill 56×72 com dia da semana abreviado, número grande, ponto indicador quando há agendamentos (`countsByIso` opcional). `aria-pressed` no selecionado.

### 4. `src/components/agenda/AgendamentoCard.tsx` (novo)

Card de lista: linha 1 horário grande (HH:mm) e duração ("60 min"); linha 2 `BrandAvatar` + nome paciente; linha 3 procedimento + `StatusBadge`. Touch alvo ≥ 56px. `onClick` abre detalhe.

### 5. `src/components/agenda/AgendamentoSheet.tsx` (novo) — criar/editar

`BottomSheet` controlado. Steps lineares (sem wizard pesado, apenas blocos verticais com scroll):

1. **Paciente**: input com `ilike` (debounce 200ms) → lista de matches; botão "+ Novo paciente rápido" abre sub-formulário (nome obrigatório, telefone opcional) que faz `insert` em `pacientes` e seleciona.
2. **Tipo**: SegmentedControl `Avaliação | Procedimento | Retorno`.
3. **Procedimento** (Select shadcn) — quando muda, preenche `duracao_minutos` e `valor` (sobrescrevíveis).
4. **Data** (Calendar shadcn com `pointer-events-auto`) e **Hora** (input `type="time"` step 300).
5. **Profissional** (input texto, default "Dra. Mabyan" via `settings` se existir, senão livre).
6. **Observações** (Textarea).

Botão sticky no rodapé: "Salvar". Em edição, mesmo sheet com `defaultValues` e título "Editar agendamento".

### 6. `src/components/agenda/AgendamentoDetailSheet.tsx` (novo)

Mostra dados + grid 2×2 de ações: **Confirmar** (status→confirmado), **Realizado** (status→realizado), **Faltou** (status→faltou), **Cancelar** (status→cancelado, com confirm). Botão largo "Abrir conversa no WhatsApp" → procura `conversations` por `paciente_id` do agendamento; se existir navega para `/app/conversas/$id`, senão `insert` em `conversations` (telefone do paciente, status `em_atendimento`) e navega. Botão secundário "Editar" reabre o `AgendamentoSheet`.

Ao marcar **Realizado**, registra no histórico via `audit_logs` (`entity='agendamento'`, `entity_id`, `action='realizado'`, `metadata={paciente_id, procedimento_id, valor}`). O histórico do paciente já consome `audit_logs` no futuro — este insert é a fonte.

### 7. `src/routes/_authenticated.app.agenda.tsx` (reescrever)

Layout vertical:
- Header sticky logo abaixo do `AppHeader` global: linha 1 com `SegmentedControl` Dia/Semana à esquerda + chip "Hoje" à direita (volta a hoje, vira oculto quando `selected===hoje`). Linha 2 com `DayStrip`.
- Conteúdo:
  - Modo **Dia**: lista vertical agrupada por hora. Headers de hora discretos a cada slot ocupado. Cartões `AgendamentoCard`. Vazio → `EmptyState` "Nenhum agendamento neste dia".
  - Modo **Semana**: 7 colunas roláveis horizontalmente (snap), cada coluna com mini-lista. Em telas estreitas, cada coluna ocupa ~85vw para manter legibilidade com uma mão. Header sticky com dia/data por coluna.
- `Fab` fixo no canto inferior direito acima do `BottomNav` (`bottom-24 right-4`) com `Plus` + texto "Agendar" (largura automática), abre `AgendamentoSheet` em modo criação.

### 8. `src/components/brand/BottomNav.tsx`

Acrescentar consumo de `useAConfirmarHojeCount()` (do hook novo) e passar `badge` no item `/app/agenda`. Reusar o estilo de badge já presente (mesmo visual que `unread`). O hook tem realtime, então o número atualiza sozinho.

## Critérios de aceite mapeados

- Criar/editar/confirmar/concluir: Mudanças 5, 6.
- Dia e semana: Mudança 7.
- Fluidez com uma mão: `Fab` ao alcance do polegar, `BottomSheet`, alvos ≥ 56px, `DayStrip` snap, segmented Dia/Semana.
- Badge "X a confirmar hoje": Mudança 8.

## Detalhes técnicos

- Datas em timezone do navegador; armazenadas como `timestamptz`. Para "hoje" usa `startOfDay`/`endOfDay` locais.
- Realtime: um canal único em `useAgendamentosRange` (ou um provider global) para evitar múltiplas subscrições; segue o padrão de `useUnreadCount`.
- Sem mudanças de schema, RLS ou edge functions.
- Sem mudanças em rotas (já existe `/app/agenda`).
- Sem mudanças no fluxo Z-API; a ação "Abrir conversa" apenas garante a linha em `conversations` e navega.
