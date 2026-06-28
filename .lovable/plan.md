## 1) Anti double-booking (DB trigger)

Migration cria `check_agendamento_overlap()` (SECURITY DEFINER, `search_path=public`) + trigger BEFORE INSERT OR UPDATE em `agendamentos`:

- Considera ativos: `status IN ('agendado','confirmado')`. Ignora `cancelado/faltou/realizado`.
- Mesmo `profissional` (comparação case-insensitive/trim).
- Sobreposição: `tstzrange(NEW.data_hora, NEW.data_hora + (NEW.duracao_minutos||' min')::interval, '[)')` && o intervalo do existente.
- `WHERE id <> NEW.id` no UPDATE.
- `RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='Já existe um agendamento nesse horário para '||NEW.profissional||'.'`.

Frontend: `AgendamentoSheet.tsx` já faz `toast.error(e?.message ?? ...)`. Mapeio mensagens conhecidas a textos amigáveis (sufixo "para {profissional}." já vem da exceção). Sem mudar fluxo do sheet — apenas garantir que erro do Supabase preserva `message`.

## 2) Expediente + bloqueios

**Migration:**
- Insert `settings.agenda_expediente` (jsonb):  
  `{"seg":["08:00","18:00"],"ter":[...],"qua":[...],"qui":[...],"sex":[...],"sab":null,"dom":null}`.
- Tabela `agenda_bloqueios`:  
  `id uuid pk, data date not null, motivo text, dia_inteiro boolean default true, inicio time, fim time, created_at, updated_at`.
- GRANTs (authenticated + service_role), RLS:
  - SELECT: qualquer authenticated.
  - INSERT/UPDATE/DELETE: `has_role(auth.uid(),'admin')`.
- Trigger `agendamento_horario_valido()` BEFORE INSERT/UPDATE (roda antes do overlap):
  - Calcula dia da semana em America/Fortaleza, lê expediente; se `null` → exceção "Fora do expediente".
  - Verifica `agenda_bloqueios` na data; se `dia_inteiro` ou faixa horária colide → "Data/horário bloqueado: {motivo}".
  - Override admin: pular validação se `current_setting('app.bypass_horario', true) = 'on'` **OU** se sessão tem role admin (via `has_role(auth.uid(),'admin')` E uma flag `forcar` — implemento sem override por padrão; documento como opcional, não exposto na UI nesta etapa).

**UI Configurações:**
- Nova rota `/_authenticated/app/configuracoes/agenda` (item no index "Agenda — expediente e bloqueios", admin).
- Edita `agenda_expediente` (7 dias com switch + dois time inputs) e lista/CRUD de `agenda_bloqueios`.

**Validação cliente (AgendamentoSheet):** apenas confia no erro do trigger e exibe via toast. Não duplico lógica no cliente nesta etapa (evita drift).

## 3) Encaixe <12h: lembrete imediato

Edito `trg_agendamento_after_insert` (nova migration CREATE OR REPLACE):

- Após bloco de confirmação, se nada foi enfileirado por estar dentro de `antecedencia_horas_minimo` (ou seja, `NEW.data_hora <= now() + (antec_horas||' h')::interval`), enfileira um lembrete imediato:
  - `envio := now() + interval '2 minutes'`, desde que `< NEW.data_hora`.
  - Usa `enfileirar_automacao(... 'lembrete'::modelo_tipo, envio, NEW.id, '{}'::jsonb, 'lembrete_encaixe', NEW.id)` — chave de idempotência distinta de `lembrete` normal.
  - `enfileirar_automacao` já respeita `aceita_automacoes` e pausa global; a janela horária é aplicada no processador.
- Lembrete N-horas-antes continua agendado normalmente (mesmo se cair antes do encaixe, ele já não roda pois `lembrete_em < now()` é filtrado).

## Aceite

- Conflito mesmo profissional → exceção amigável; horário livre OK.
- Fora do expediente ou em bloqueio → bloqueado; Configurações → Agenda permite editar.
- Insert com `data_hora` em <12h → uma linha em `mensagens_agendadas` tipo `lembrete`, `agendado_para ≈ now()+2min`, idempotência `lembrete_encaixe`, respeitando opt-out.

## Arquivos

- `supabase/migrations/<ts>_agenda_overlap_expediente_encaixe.sql` (trigger overlap, tabela bloqueios + RLS/GRANTs, settings expediente, novo trigger after_insert com encaixe).
- `src/routes/_authenticated.app.configuracoes.agenda.tsx` (nova tela).
- `src/routes/_authenticated.app.configuracoes.index.tsx` (novo item).
- `src/hooks/useAgendaConfig.ts` (queries/mutations expediente + bloqueios).
- `src/components/agenda/AgendamentoSheet.tsx` (mapeamento de mensagens de erro, mínimo).
