## Objetivo

Em `/app/configuracoes/zapi`:
1. Indicador detalhado de conexão (instância + smartphone + última atualização).
2. Fluxo de reconexão com QR que confirma automaticamente quando o WhatsApp volta a aparear.

## Mudanças

### 1. Backend (`zapi-instance-manager` `action: "status"`)
Já chamamos `/status` (Z-API retorna `connected`, `smartphoneConnected`, `error`/`session`). Acrescentar no JSON de resposta:
- `smartphoneConnected: boolean`
- `session: string | boolean` (já vem do `/status`, só repassar limpo)
- `checkedAt: ISOString` (timestamp do servidor, para a UI exibir "última atualização")

Sem mudar contrato existente — apenas campos novos.

### 2. UI — Card "Status da conexão"
Substitui o card atual de status por um bloco com 3 linhas:
- **Instância Z-API** · bolinha verde/cinza · "Conectada" / "Desconectada"
- **Smartphone** · bolinha verde/âmbar/cinza · "Online" / "Offline" / "—"
- **Webhooks** · bolinha verde/âmbar · "Ativos (5/5)" / "X/5 registrados" (reusa `webhookMatches`)
- Rodapé: "Atualizado há Xs" (tempo relativo, recalculado a cada 1s a partir de `checkedAt`) + botão refresh.

Poll automático leve: `refetchInterval: 15s` para o `zapi-remote-status` quando a aba estiver visível (sem QR aberto), garantindo o "última atualização" vivo sem custo alto.

### 3. Fluxo de reconexão automática
Hoje já temos `conectar()` que pede QR e faz polling a cada 3s. Vou:

- Renomear o botão para "Reconectar (novo QR)" quando `instance.connected === false` ou `smartphoneConnected === false`, e mantê-lo como "Gerar novo QR" quando já conectado.
- Adicionar overlay/dialog do QR com timer de expiração (60s) e botão "Gerar novo QR" — Z-API renova o QR a cada ~30s, então quando o polling detecta `connected: true` o dialog fecha sozinho e dispara:
  - `toast.success("WhatsApp reconectado")`
  - `configure-webhook` automaticamente (re-registra os 5 webhooks — o endpoint é idempotente, garante que ficaram OK após nova sessão)
  - `invalidateQueries(["zapi-instance"])` + `["zapi-remote-status"]`
  - Fecha o QR
- Se o polling rodar por mais de 90s sem conectar, mostra toast "QR expirado — tente novamente" e para o polling.
- Se o usuário fechar o dialog, polling para.

### 4. Detalhes técnicos
- Helper `formatRelativeTime(checkedAt)` no próprio arquivo (curto, "agora", "há Xs", "há Xmin").
- `useEffect` com `setInterval(1000)` apenas enquanto o card está montado, para recálculo do relativo.
- Sem novas dependências.

## Fora do escopo
- Histórico de conexões/desconexões (precisaria nova tabela).
- Notificação push quando WhatsApp cair (precisaria worker/job).
- Reconectar por código de telefone (`/phone-code/{phone}`) — já existe a action no backend, mas UI ficaria para outra entrega.

Posso seguir?
