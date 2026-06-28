## Diagnóstico

Na URL `/app/conversas/245881aa-...` o app continua exibindo a **lista de conversas** em vez da tela da conversa. Por isso não há campo de mensagem para responder.

**Causa raiz (routing TanStack):**
- `src/routes/_authenticated.app.conversas.tsx` é uma rota-folha que renderiza `<ConversasPage />` (a lista) e **não** renderiza `<Outlet />`.
- Existe a rota filha `src/routes/_authenticated.app.conversas.$conversaId.tsx`.
- Quando a URL casa com a filha, o pai continua sendo renderizado, mas como não tem `<Outlet />`, a filha nunca monta — o usuário vê a lista no lugar da conversa.

A rota detalhe em si está correta (busca a conversa e as mensagens com sucesso — confirmado nos network logs: 1 conversa + 1 mensagem "Oi" retornaram 200).

## Correção

Promover `conversas` de folha para um arranjo "layout + index":

1. **Renomear** `src/routes/_authenticated.app.conversas.tsx` → `src/routes/_authenticated.app.conversas.index.tsx`
   - Atualizar `createFileRoute("/_authenticated/app/conversas")` → `createFileRoute("/_authenticated/app/conversas/")` (id do index).
   - Nenhuma outra mudança no componente da lista.

2. **Não criar** um novo arquivo `conversas.tsx` de layout. Sem layout pai, cada rota (`/app/conversas` e `/app/conversas/$conversaId`) renderiza independentemente — exatamente o que queremos, já que a tela de detalhe ocupa `h-dvh` com header próprio.

3. **Regenerar o route tree** automaticamente via dev server (sem editar `routeTree.gen.ts`).

## Validação

- Abrir `/app/conversas` → lista carrega normalmente.
- Tocar em "Wallen Santiago" → navega para `/app/conversas/245881aa-...` e a tela da conversa aparece com:
  - header com avatar, nome e botão voltar
  - balão "Oi" recebido
  - campo de texto + botão enviar
- Digitar e enviar mensagem → invoca `zapi-send`, mensagem aparece como outbound, e webhook de status atualiza o ícone de entrega.

Sem mudanças de UI, backend ou edge functions — apenas o rename de arquivo de rota.