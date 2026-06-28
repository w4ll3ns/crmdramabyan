# Diagnóstico: número errado no novo lead

## O que aconteceu

O lead chegou via anúncio Click-to-WhatsApp do Facebook (campo `externalAdReply` no payload, com `sourceType: "ad"`, `sourceApp: "facebook"`). Nesses casos o WhatsApp **mascara o número real** do usuário com um identificador chamado **LID** (Linked Device ID), por privacidade.

No webhook recebido (`webhook_events` id `5aa85d36-…`), o payload veio assim:

```
phone:           "44891786768631@lid"
chatLid:         "44891786768631@lid"
participantLid:  null
senderName:      "Lucia"
externalAdReply: { sourceType: "ad", sourceApp: "facebook", ... }
```

O número real **+55 98 97005-0911** (`5598970050911`) não está em nenhum campo do payload — o WhatsApp não envia, é preciso **resolver o LID** chamando um endpoint extra da Z-API.

Hoje, `zapi-webhook/index.ts` faz:

```ts
const phoneRaw = body.phone || body.from || body.sender || ...
const telefone = normalizePhone(phoneRaw); // "44891786768631"
```

…e usa esse LID como se fosse telefone — daí o paciente/conversa salvos com `telefone = 44891786768631` (o que você viu na tela) em vez de `5598970050911`.

Eventos subsequentes (`PresenceChatCallback`) também trazem só o `@lid`, então não há autocorreção depois.

## Plano de correção

### 1. Detectar LID no webhook

Em `supabase/functions/zapi-webhook/index.ts`, ao montar `phoneRaw`, verificar se `phone` / `chatLid` contém `@lid` (ou se `phone` é todo numérico mas sem prefixo de país plausível e existe `chatLid`).

### 2. Resolver LID → telefone real via Z-API

Criar helper `resolveLidToPhone(lid, instance)` em `supabase/functions/_shared/zapi.ts`. A Z-API expõe, para contas com WhatsApp LID habilitado, o endpoint:

```
GET {zapiBase}/lid-to-phone/{lid}        // retorna { phone: "5598970050911" }
```

(fallbacks: `chat-metadata/{lid}`, `phone-exists-lid/{lid}` — testar qual responde no plano da conta e usar o primeiro com sucesso). Cachear em memória por requisição.

Se a resolução falhar, registrar `webhook_events` com `event_type = "lid_unresolved"` e **não** criar paciente/conversa com o LID — guardar a mensagem em uma conversa "pendente de identificação" usando o LID com sufixo `@lid` em `telefone` para não conflitar com números reais, e gerar uma `task` "Identificar lead vindo de anúncio (LID …)".

### 3. Backfill do lead atual

Migration única (one-off SQL) que:

- Atualiza `pacientes` e `conversations` onde `telefone = '44891786768631'` para `telefone = '5598970050911'` e `whatsapp = '5598970050911'`.
- Se já existir paciente com `5598970050911`, faz merge (move `messages` da conversa antiga para a do número real e apaga a duplicada).

### 4. Salvar o LID para futuras correlações

Adicionar coluna `wa_lid TEXT` em `pacientes` (nullable, índice único parcial). Quando resolvermos o LID, gravamos `wa_lid` no paciente — assim, se o mesmo LID voltar (ex.: `PresenceChatCallback`), encontramos o paciente direto sem nova chamada HTTP.

### 5. Marcar origem do lead

Quando `externalAdReply` está presente no `ReceivedCallback`, gravar em `pacientes.origem` algo como `"facebook_ad"` (em vez de apenas `"whatsapp"`) e salvar `externalAdReply.sourceId` / `sourceUrl` em `pacientes.observacoes` (ou em coluna nova `lead_ad_ref JSONB`), para você saber depois de qual anúncio veio.

## Detalhes técnicos

- Z-API base já existe em `_shared/zapi.ts` (`zapiBase`, `zapiHeaders`).
- Buscar a instância ativa por `body.instanceId` em `zapi_instances` para montar a URL/headers.
- Timeout curto (5s) na chamada de resolução; em erro, cair no fluxo "pendente".
- Manter idempotência: a dedupe por `external_message_id` continua funcionando.

## Critérios de aceite

1. Novo lead vindo de anúncio FB aparece com o telefone real (formato `55DDDNNNNNNNNN`), não com `…@lid`.
2. O paciente "Lucia" atual passa a ter telefone `+55 98 97005-0911` após o backfill, sem duplicar registros.
3. Mensagens subsequentes do mesmo LID caem na mesma conversa do número real.
4. Se a Z-API não resolver o LID, a mensagem não é perdida — fica em conversa pendente + task de identificação.
