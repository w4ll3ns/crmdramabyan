# Schema completo Dra. Mabyan CRM no Lovable Cloud

Criação de schema completo com enums, tabelas, RLS, triggers e seed do catálogo, em uma única migration.

## 1. Enums (CREATE TYPE)

- `app_role`: admin, atendente
- `origem_type`: instagram, indicacao, google, tiktok, site, anuncio_meta, whatsapp, passou_em_frente, outro
- `etapa_funil`: novo_lead, primeiro_contato, avaliacao_agendada, avaliacao_realizada, orcamento_enviado, negociacao, procedimento_agendado, cliente, pos_procedimento, perdido
- `oportunidade_status`: aberta, ganha, perdida
- `conversation_status`: nao_lida, em_atendimento, aguardando, resolvida, arquivada
- `message_direction`: inbound, outbound
- `message_type`: text, image, audio, video, document
- `agendamento_tipo`: avaliacao, procedimento, retorno
- `agendamento_status`: agendado, confirmado, realizado, faltou, cancelado
- `task_status`: pendente, em_andamento, concluida, cancelada
- `task_priority`: baixa, media, alta, urgente
- `temperatura_type`: quente, morno, frio (em vez de CHECK, para consistência)

## 2. Helpers de segurança

- `public.update_updated_at_column()` — trigger genérico de `updated_at`.
- `public.has_role(_user_id uuid, _role app_role) returns boolean` — SECURITY DEFINER, `search_path=public`, lê de `user_roles`. Usado em todas as policies de admin (evita recursão).
- `public.handle_new_user()` — trigger AFTER INSERT em `auth.users` que cria linha em `public.profiles` (id, email, name a partir de `raw_user_meta_data`).

## 3. Tabelas (todas em `public`, com `id uuid default gen_random_uuid()`, `created_at`/`updated_at timestamptz default now()`)

Operacionais (autenticados leem/escrevem):
- `profiles` (id = auth.users.id, name, email, phone, avatar_url, active bool default true)
- `user_roles` (user_id → auth.users, role app_role, UNIQUE(user_id, role))
- `pacientes`, `oportunidades`, `agendamentos`, `conversations`, `messages`, `tasks`, `webhook_events`

Catálogo / config (somente admin escreve, autenticados leem):
- `procedimentos`, `zapi_instances`, `settings` (chave text unique, valor jsonb), `audit_logs` (somente admin lê/escreve)

Todas as FKs entre tabelas do domínio usam `ON DELETE` apropriado (SET NULL para opcionais, CASCADE para `messages.conversation_id`).

## 4. RLS (estrutura padrão por tabela)

Para cada tabela: `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role;` depois `ENABLE ROW LEVEL SECURITY` e policies:

- **Operacionais** (profiles, pacientes, oportunidades, agendamentos, conversations, messages, tasks, webhook_events):
  - SELECT/INSERT/UPDATE/DELETE: `authenticated` com `using (true)` / `with check (true)` (CRM interno; qualquer membro autenticado pode operar).
  - Exceção `profiles`: UPDATE só do próprio registro ou admin; DELETE só admin.
  - Exceção `user_roles`: SELECT autenticado; INSERT/UPDATE/DELETE só admin (`has_role(auth.uid(),'admin')`).
- **Catálogo/config** (procedimentos, zapi_instances, settings):
  - SELECT: authenticated.
  - INSERT/UPDATE/DELETE: somente admin via `has_role`.
- **audit_logs**: SELECT/INSERT/UPDATE/DELETE somente admin.

Sem grants ao `anon` em nenhuma tabela.

## 5. Triggers

- `update_updated_at_column` BEFORE UPDATE em: profiles, pacientes, procedimentos, oportunidades, agendamentos, conversations, tasks, zapi_instances, settings.
- `handle_new_user` AFTER INSERT em `auth.users` → cria `profiles`.

## 6. Seed do catálogo de procedimentos

`INSERT INTO procedimentos (nome, categoria, retorno_dias, recorrencia_dias, ativo) VALUES ...` com a lista fornecida:

| Nome | retorno_dias | recorrencia_dias |
|---|---|---|
| Toxina Botulínica | 15 | 120 |
| Preenchimento Labial | – | 300 |
| Preenchimento Facial | – | 365 |
| Bioestimulador de Colágeno | – | 365 |
| Fios de Sustentação | – | 540 |
| Skinbooster | – | 90 |
| Microagulhamento | – | 30 |
| Peeling Químico | – | 30 |
| Limpeza de Pele | – | 30 |
| Harmonização Facial Completa | – | – |
| Lipo de Papada (enzimas) | – | – |
| Botox Capilar | – | – |

Idempotente via `ON CONFLICT (nome) DO NOTHING` (adiciono UNIQUE em `procedimentos.nome`).

## 7. Entrega

Uma única chamada `supabase--migration` com todo o SQL acima na ordem: enums → helpers → tabelas (cada uma com GRANT → RLS → policies) → triggers → seed. Após aprovação e regeneração de `src/integrations/supabase/types.ts`, o frontend já passa a ter os tipos prontos para integrar nas próximas telas (sem alteração de código nesta etapa).

Critérios de aceite atendidos: todas as tabelas com RLS; `has_role()` criado; seed do catálogo aplicado; trigger `handle_new_user` cria profile no signup.
