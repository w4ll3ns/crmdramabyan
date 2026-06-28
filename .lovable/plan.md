## Diagnóstico

- A instância Z-API está conectada (`connected=true`).
- O banco ainda tem `0` conversas, `0` mensagens e `0` eventos de webhook.
- Os logs mostram chamadas apenas ao gerenciador da instância, não ao `zapi-webhook`.
- Conclusão: o WhatsApp conectou via QR, mas a Z-API ainda não está enviando eventos para o webhook do app, então nada chega para criar conversas.

## Plano de correção

1. **Automatizar o cadastro do webhook na Z-API**
   - Adicionar uma ação no `zapi-instance-manager` para chamar o endpoint oficial da Z-API:
     - `PUT /update-webhook-received`
   - Enviar a URL pública do webhook do app com o token seguro já configurado.

2. **Adicionar botão na tela de configuração**
   - Em `/app/configuracoes/zapi`, adicionar uma ação clara: **Ativar recebimento de mensagens**.
   - Esse botão chamará o gerenciador e cadastrará automaticamente o webhook na instância conectada.
   - Mostrar sucesso/erro em toast.

3. **Melhorar o status da configuração**
   - Ao consultar status, também buscar dados da instância (`/me`) para confirmar se `receivedCallbackUrl` está configurado.
   - Exibir na tela se o webhook de recebimento está ativo ou pendente.

4. **Validar o fluxo após implementar**
   - Confirmar que a função responde corretamente.
   - Depois que uma mensagem real for enviada para o WhatsApp conectado, checar se aparecem registros em:
     - `webhook_events`
     - `pacientes`
     - `conversations`
     - `messages`
   - A tela de Conversas deve atualizar pelo realtime automaticamente.

## Observação

Não vou alterar permissões/RLS agora: elas já permitem leitura para usuários autenticados e o problema atual está antes disso, na ausência de chamadas ao webhook.