# Conversas + Integração Z-API

Implementar inbox de WhatsApp completo com envio/recebimento real via Z-API, realtime e configuração admin.

## 1. Migration — Realtime + índice

- `ALTER PUBLICATION supabase_realtime ADD TABLE public.messages, public.conversations;`
- `ALTER TABLE public.messages REPLICA IDENTITY FULL;` (mesmo para `conversations`).
- Índices: `conversations(ultima_mensagem_em DESC)`, `messages(conversation_id, created_at)`.
- Settings seed: linha `chave='mensagem_modelos'` com array vazio (admin edita depois).

## 2. Secret — Z-API webhook

`generate_secret` para `ZAPI_WEBHOOK_TOKEN` (validar nas requests do webhook via query `?token=`). `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` já existem.

## 3. Edge functions (Supabase) — necessárias porque Z-API chama webhook externo e a URL deve viver no domínio de funções estável

Lovable Cloud expõe edge functions com URL pública estável; a Z-API precisa de uma URL fixa para callback. Mantemos a regra: app-internal usa server fns, externo (webhook Z-API) usa edge function.

- `zapi-instance-manager` (GET/POST, autenticada, admin-only via JWT + has_role): ações `status`, `qr-code`, `disconnect`, `restart`. Lê instância ativa de `zapi_instances` e chama API da Z-API correspondente.
- `zapi-send` (POST, autenticada): body `{ conversation_id, type, content, media_url? }`. Resolve telefone via conversa, chama Z-API `/send-text` ou `/send-image|audio|document`, insere `messages` com `direction='outbound'`, atualiza `conversations.ultima_mensagem_em`.
- `zapi-webhook` (POST, `verify_jwt=false`, pública): valida `?token=`, normaliza payload Z-API (message received / status update), faz upsert de `pacientes` por telefone, upsert de `conversations`, insere `messages` com `direction='inbound'`, marca `status='nao_lida'`. Suporta eventos `received`, `delivery`, `read` para atualizar `status` da mensagem por `external_message_id`. Loga payload em `webhook_events`.

`supabase/config.toml`: adicionar bloco `[functions.zapi-webhook] verify_jwt = false` (as outras herdam o default Lovable de `verify_jwt = false` também, mas como chamamos com bearer da sessão elas funcionam normalmente).

## 4. Server functions (TanStack)

`src/lib/conversas.functions.ts`:
- `listConversas({ filter, search })` → ordena por `ultima_mensagem_em desc`, conta não lidas (`messages` inbound com status null).
- `getConversa(id)` → conversa + paciente + mensagens (paginadas, últimas 100).
- `markConversaLida(id)` → marca conversa `em_atendimento` e mensagens inbound como lidas.
- `setEtapaFunil({ oportunidade_id, etapa })`.

`src/lib/zapi.functions.ts` (admin):
- `getZapiInstanceAtiva()`, `upsertZapiInstance(...)`, `getZapiStatus()`, `getZapiQrCode()`, `disconnectZapi()` — wrappers para a edge function `zapi-instance-manager`.

Envio de mensagem chama diretamente `supabase.functions.invoke('zapi-send', ...)` no client (já tem bearer).

## 5. UI

**`/app/conversas` (lista)** — substitui placeholder:
- Header com busca (nome/telefone) e `SegmentedControl` (Não lidas / Em atendimento / Todas).
- Lista de `ListRow` com `Avatar` (inicial do nome), nome, prévia da última msg, horário (relativo: "agora", "14:32", "ontem", "12/06"), badge dourado de não lidas.
- `useSuspenseQuery` + canal realtime em `messages` para invalidar query.
- Empty state quando vazio.

**`/app/conversas/$id` (detalhe — nova rota `_authenticated.app.conversas.$id.tsx`)**:
- Tela cheia mobile (esconde BottomNav nesta rota via flag no `AppShell`).
- Header: botão voltar, avatar+nome (link → ficha do paciente), menu kebab (`BottomSheet`): "Agendar avaliação", "Criar tarefa", "Mover etapa do funil".
- Área de mensagens scroll reverso: bolhas
  - inbound: branco, borda sutil, alinhadas à esquerda.
  - outbound: champanhe claro (`bg-primary/15` via token), alinhadas à direita, com horário + ícone de status (✓ enviado, ✓✓ entregue, ✓✓ azul=lido).
  - Suporte a `type`: text (texto), image (img clicável), audio (`<audio controls>`), document (chip com nome + download).
- Input fixo bottom (safe-area-inset-bottom): textarea auto-grow, botão paperclip (anexos — modal simples com URL por ora ou upload futuro), botão "Modelo" abre `BottomSheet` com modelos de `settings.mensagem_modelos`, atalho "Agendar" navega para nova avaliação pré-preenchida, botão enviar dourado circular.
- Realtime: subscribe a `messages` filtrado por `conversation_id`; auto-scroll ao chegar nova.
- Ao montar: dispara `markConversaLida`.

**Badge no BottomNav de Conversas**: hook `useUnreadCount` no `AppShell` consulta `conversations` com não lidas, subscribe realtime em `conversations` para reatualizar; passa contagem para item "Conversas".

**`/app/configuracoes/zapi` (nova rota, admin-only)**:
- Form: nome_instancia, instance_id, token, client_token, phone_number (todos em branco para o usuário preencher).
- Botão "Conectar" → chama `zapi-instance-manager?action=qr-code` e mostra QR (img base64 retornado pela Z-API). Polling a cada 3s do status até `connected=true`.
- Botão "Desconectar". Card de status conectado (com phone_number + reset).
- Acesso bloqueado a não-admin (checa `has_role` via server fn).

## 6. Realtime wiring

- Lista: canal `conversas-list` em `conversations` (UPDATE/INSERT) → `queryClient.invalidateQueries(['conversas'])`.
- Detalhe: canal `conversa-${id}-msgs` em `messages` filtrado por `conversation_id=eq.${id}` → append à lista.
- Badge: canal `conversas-unread` em `conversations` → recalcula.

Todos dentro de `useEffect` com cleanup, como o knowledge prescreve.

## 7. Critérios de aceite mapeados

- Inbox lista + filtros + busca ✅ (passo 5 lista)
- Conversa detalhe full-screen com bolhas, status, mídia ✅ (passo 5 detalhe)
- Input com anexo/modelo/agendar/enviar ✅
- Z-API enviar (zapi-send) + receber (zapi-webhook) ✅
- Criação automática de paciente/conversa via webhook ✅
- Realtime + badge no BottomNav ✅
- Configuração admin com QR + status ✅
- Instância em branco ✅

## 8. Itens fora deste escopo (entrego em chat se o usuário quiser depois)

- Upload real de mídia para Storage (por ora aceita URL no input de anexo).
- Editor de modelos de mensagem (criar/editar) — listagem e uso já entram; CRUD fica para próxima.
- Templates HSM/oficiais — Z-API normal só envia para conversas dentro de 24h.

Pergunto antes de codar:
