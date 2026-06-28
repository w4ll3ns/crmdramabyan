## Objetivo

Revisar e ajustar toda a integração Z-API do projeto para ficar 100% alinhada com a documentação oficial (`developer.z-api.io`), focando nos pontos onde o código atual diverge ou usa endpoints menos completos.

## O que está certo hoje (mantém)

- Base URL: `https://api.z-api.io/instances/{id}/token/{token}`
- Header `Client-Token` em todas as chamadas
- Endpoints `/status`, `/me`, `/qr-code/image`, `/qr-code`, `/disconnect`, `/restart`, `/phone-code/{phone}`
- Webhook público em HTTPS (`zapi-webhook`) protegido por token na query
- Envio de texto/imagem/vídeo (`/send-text`, `/send-image`, `/send-video`)

## Ajustes vs. documentação

### 1. Registrar **todos** os webhooks de uma vez (`zapi-instance-manager`)
Hoje só registramos o "Ao receber" via `PUT /update-webhook-received`. A doc oferece `PUT /update-every-webhooks` que aponta uma URL única para todos os callbacks (received, delivery, status, connected, disconnected) e ainda aceita `notifySentByMe`.

- Substituir a action `configure-webhook` para chamar `PUT /update-every-webhooks` com body `{ value: <url>, notifySentByMe: true }`.
- Verificação de "webhook configurado" em `me` passa a conferir os 5 campos: `receivedCallbackUrl`, `deliveryCallbackUrl`, `messageStatusCallbackUrl`, `connectedCallbackUrl`, `disconnectedCallbackUrl` — todos iguais à nossa URL.
- Status remoto na tela de configurações reflete esses 5 campos (um único indicador "Webhooks ativos").

### 2. Parser do webhook "Ao receber" (`zapi-webhook`)
Ajustar para o contrato oficial de `on-message-received`:

- Usar `body.momment` (ms) como `sent_at` quando presente, fallback para `now`.
- Tratar `isGroup`/`isNewsletter` → ignorar grupos/canais por enquanto (não criamos `pacientes` a partir de grupo); registrar em `webhook_events` mesmo assim.
- Suportar `senderName`, `chatName`, `senderPhoto`, `participantPhone` (grupo) — preencher `pacientes.foto_url` quando vier `senderPhoto` e o paciente ainda não tiver.
- Adicionar novos tipos suportados pela doc:
  - `body.sticker` → type `sticker` (gravamos como `image` com mime `image/webp` até termos coluna própria)
  - `body.location` → type `location`, content_text com `"lat,lng – descrição"`
  - `body.contact` / `body.contacts` → type `contact`, content_text com nome+telefone
  - `body.reaction` → atualiza a mensagem alvo (`reactionMessage.referencedMessage`) em vez de criar nova
  - `body.poll` → type `poll`, content_text com a pergunta + opções
- Para `fromMe: true`: não ignorar mais. Gravar como `direction: 'outbound'` (mensagens enviadas pelo celular conectado), respeitando `notifySentByMe`. Ainda deduplicar por `external_message_id`.

### 3. Webhook de status / delivery
Doc separa `on-message-send` (DeliveryCallback) e `on-whatsapp-message-status-changes` (status `SENT|RECEIVED|READ|PLAYED`).

- Mapear `RECEIVED`/`DELIVERED` → `entregue`, `READ` → `lido`, `PLAYED` → `lido`, `SENT` → `enviado`.
- Suportar `body.ids` como array (DeliveryCallback envia em lote).
- Continuar gravando em `webhook_events`.

### 4. Webhook "ao conectar / desconectar"
Hoje ignoramos. Adicionar branches:
- `Connected`/`ReceivedCallback`: atualizar `zapi_instances.connected=true` e `phone_number`.
- `Disconnected`: setar `connected=false`, `status='disconnected'`.

### 5. Envio (`zapi-send`)
- `/send-document/{extension}` hoje fixo em `pdf`. Derivar a extensão de `filename`/`media_mime_type` (pdf, docx, xlsx, etc.) conforme a doc.
- `/send-audio` aceita `audio` (URL) — manter, mas adicionar `viewOnce: false` e `waveform: true` por padrão (opcional na doc, melhora UX no WhatsApp).
- Validar resposta: a doc retorna `zaapId`, `messageId` e `id`. Já tratado; manter.

### 6. UI `/app/configuracoes/zapi`
- Renomear botão "Ativar recebimento de mensagens" → "Registrar webhooks" (alinhado com `update-every-webhooks`).
- Mostrar um único cartão "Webhooks ativos" baseado nos 5 callbacks da resposta de `/me`, com botão "Re-registrar" caso algum esteja faltando.
- Exibir o `connectedPhone` retornado em `/me` quando disponível.

### 7. Tipos / housekeeping
- Tipar o payload do webhook em `_shared/zapi.ts` com `ZapiReceivedPayload`, `ZapiStatusPayload`, `ZapiConnectedPayload`.
- Helper `extractExternalId(body)` reusado entre webhook e send.

## Fora do escopo (proposta, não incluído agora)

- Botões/listas/templates de WhatsApp Business (`send-button-*`, `send-option-list`)
- Newsletter/canais e comunidades
- Catálogo / pedidos / pagamentos
- Filtros de webhook (`/update-filters`)
- Stickers/figurinhas como tipo dedicado (precisa migration de tipo de mensagem)
- Instâncias mobile e Partner

Confirme se posso seguir só com os itens 1–7 (alinhamento básico + recebimento/envio robusto), ou se quer incluir algum dos itens "fora de escopo" desta vez.
