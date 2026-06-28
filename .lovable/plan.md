## Diagnóstico

Os webhooks da Z-API estão chegando ao backend: há eventos `ReceivedCallback` recentes no log. Porém, eles não viram conversas/mensagens porque o webhook atual verifica `body.status` antes de identificar mensagem recebida. Como o payload recebido vem com `status: "RECEIVED"`, ele entra no bloco de atualização de status e retorna antes de inserir a mensagem.

## Plano de correção

1. **Corrigir a ordem de interpretação do webhook**
   - Em `zapi-webhook`, identificar primeiro eventos de mensagem recebida (`ReceivedCallback`) e só depois tratar eventos de status/entrega.
   - Restringir o bloco de status para callbacks reais de status/entrega, evitando que `ReceivedCallback` seja confundido com confirmação de entrega.

2. **Manter os filtros existentes**
   - Continuar ignorando grupos/newsletters.
   - Continuar deduplicando por `messageId`.
   - Continuar criando/atualizando paciente, conversa e mensagem como já implementado.

3. **Melhorar rastreabilidade em caso de payload inesperado**
   - Registrar no `webhook_events` quando um evento recebido for ignorado por falta de telefone ou tipo não suportado, sem quebrar o webhook.

4. **Validar com os dados reais já recebidos**
   - Conferir que novos `ReceivedCallback` passam a gerar linhas em `messages` e `conversations`.
   - Não vou retroprocessar automaticamente os 2 eventos antigos para evitar duplicações; se quiser, posso fazer isso depois como ação separada.