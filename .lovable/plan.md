## Endurecimento Z-API: claim atômico, delays nativos, teto de destinatários, shadowban breaker

Implementa as 5 frentes pedidas seguindo a documentação Z-API (`/send-text` aceita `delayTyping` e `delayMessage` em segundos, 1–15) e adiciona pausa automática por shadowban com retomada manual ou após cooldown.

### 1. Migration SQL (uma migration única)

- **Enum**: `ALTER TYPE public.msg_status ADD VALUE IF NOT EXISTS 'enviando' BEFORE 'enviada';`
- **Settings (seed conservador, `ON CONFLICT DO NOTHING`)**:
  - `zapi_delay_typing_min=3`, `zapi_delay_typing_max=6`
  - `zapi_delay_message_min=2`, `zapi_delay_message_max=4`
  - `zapi_max_destinatarios_hora=15`, `zapi_max_destinatarios_dia=40`
  - `automacoes_pausa_auto={"ativo": false, "motivo": null, "desde": null}`
  - `automacoes_shadowban_cooldown_horas=6`
- **RPC `public.claim_mensagens_pendentes(_limit int)`** (SECURITY DEFINER, `GRANT EXECUTE` só a `service_role`):
  - `UPDATE mensagens_agendadas SET status='enviando', tentativas=tentativas+1 WHERE id IN (SELECT id FROM mensagens_agendadas WHERE status='pendente' AND agendado_para<=now() ORDER BY agendado_para LIMIT _limit FOR UPDATE SKIP LOCKED) RETURNING ...` (com join lateral para retornar dados de paciente/modelo).
- **RPC `public.reagendar_excedente(_id uuid, _nova timestamptz)`**: volta a linha de `enviando`→`pendente` com `agendado_para=_nova`. Mesmo grant.

### 2. Edge function `processar-mensagens-agendadas`

Reescreve o loop principal:

1. Lê settings. Se `automacoes_pausado` **ou** `automacoes_pausa_auto.ativo=true` (e `desde + cooldown_horas > now()`): sai com `skipped`. Se cooldown expirou, limpa o auto-pausa e segue.
2. Janela 08–20h preservada (reagenda pendentes para próxima janela como hoje).
3. Calcula `lote` para caber em ~4 min de envios (cada envio gasta `delayTyping + delayMessage + gap 2–6s`; pior caso ~27s → lote máx ≈ 8). Cap final: `min(automacoes_limite_minuto * 5, 10)`.
4. Chama `rpc('claim_mensagens_pendentes', { _limit })` em vez de SELECT — só processa o que reivindicou.
5. **Teto de destinatários distintos** antes de cada envio:
   - Contagem de `paciente_id` distintos com `status='enviada'` em `mensagens_agendadas` na última 1h e no dia (fuso `automacoes_fuso`).
   - Se já no teto e o paciente atual ainda não está nesse conjunto: chama `reagendar_excedente` empurrando para o próximo bucket horário (ou início da janela do dia seguinte se diário batido) e segue para o próximo item — não conta como falha.
6. **Envio com delays nativos**: `body = { phone, message, delayTyping: rand(min,max,clamp 1..15), delayMessage: rand(min,max,clamp 1..15) }`. Mantém o `sleep(2000+rand*4000)` entre iterações.
7. **Detecção de shadowban** na resposta (ok ou erro) — match case-insensitive de `shadow ban`, `Did not have permission to send this message`, `Whatsapp rejected sending this message`. Ao detectar:
   - `UPDATE mensagens_agendadas SET status='falhou', erro=<texto>` para a mensagem atual.
   - `UPDATE settings SET valor=jsonb_build_object('ativo',true,'motivo',<texto>,'desde',now()) WHERE chave='automacoes_pausa_auto'`.
   - Cria `tasks` com `prioridade='alta'`, título "Possível shadowban Z-API — automações pausadas", descrição com motivo.
   - **break** do loop; retorna `{ ok:true, shadowban:true }`.
8. Em sucesso: `status='enviada'`, `enviada_em=now()`, grava em `messages` / `conversations` (já existe). Em falha não-shadowban: `status='falhou'`.
9. `clinica_nome` já corrigido em turno anterior.

### 3. Edge function `zapi-webhook`

No bloco de status de mensagem (após mapear `mapped`): se a `body` carregar campo de erro/descrição (`error`, `errorDescription`, `statusDescription`, `message`) que case com as strings de shadowban, executa a mesma rotina:

- `UPDATE settings ... automacoes_pausa_auto={ativo:true, motivo, desde:now()}`
- Cria task de alerta (uma por janela de 6h, dedup por título+`created_at > now()-6h`).
- Marca a mensagem ligada pelo `external_message_id` como `status='falhou'` em `mensagens_agendadas` (via join por `external_message_id` em `messages` → `conversation_id` + tempo? — solução prática: já gravamos `external_message_id` em `messages`; em `mensagens_agendadas` não há FK direta, então localizamos pelo par `(conversation_id, conteudo_renderizado, enviada_em)` ou simplesmente paramos por o próximo ciclo). **Simplificação aceitável**: só ativa o breaker e abre task; o processador já não enviará mais até retomada.

### 4. Frontend `ReguasTab.tsx`

- Lê `automacoes_pausa_auto` via `useReguas` (adicionar à `REGUA_KEYS`).
- Acima do card de "Pausa global", quando `automacoes_pausa_auto.ativo===true`, renderiza um banner âmbar:
  - Texto: "Automações pausadas automaticamente — possível shadowban no WhatsApp." + motivo + "desde {fmt}".
  - Botão "Retomar agora" → seta `{ativo:false, motivo:null, desde:null}` em `automacoes_pausa_auto`.
- Toggle global existente continua mexendo em `automacoes_pausado`.

### 5. Validação pós-deploy

- `SELECT * FROM public.claim_mensagens_pendentes(5);` duas vezes seguidas (sem commit entre) confirma SKIP LOCKED.
- `curl` da edge com lote pequeno: logs mostram `delayTyping`/`delayMessage` no payload Z-API.
- Inserir 20 `mensagens_agendadas` pendentes para 20 pacientes distintos: somente 15 saem na 1ª janela horária, restantes ficam `pendente` com `agendado_para` deslocado.
- Simular resposta Z-API com `error: "Whatsapp rejected sending this message"` → `automacoes_pausa_auto.ativo=true`, task criada, próximas execuções respondem `skipped`.
- Botão "Retomar" no painel limpa a flag e novo cron volta a enviar.

### Detalhes técnicos

- `ALTER TYPE ... ADD VALUE` não pode rodar dentro de transação com uso imediato; a migration vai conter apenas o ADD VALUE e seed, e a RPC vai numa segunda migration (ou separa em commits dentro do mesmo arquivo via `COMMIT;`). Vou usar **duas migrations** para não esbarrar nessa restrição.
- `automacoes_pausa_auto` é jsonb objeto; leitura no edge: `const auto = getSetting<{ativo:boolean,motivo:string|null,desde:string|null}>(rows,'automacoes_pausa_auto',{ativo:false,motivo:null,desde:null})`.
- Contagem de destinatários distintos via duas queries leves: `select paciente_id from mensagens_agendadas where status='enviada' and enviada_em >= now()-interval '1 hour'` e dia (`enviada_em::date AT TIME ZONE tz = today`). Mantemos em `Set<string>` no processo.
- Reagendamento de excedente horário: `nova = now() + interval '1 hour'`; diário batido: `nextWindowStartISO(tz, janelaIni)` do próximo dia.
- `claim_mensagens_pendentes` retorna `mensagens_agendadas.*` + colunas planas de paciente/modelo necessárias; alternativa: retorna só ids e o edge faz `SELECT ... WHERE id = ANY($ids) AND status='enviando'`. Vou usar a segunda forma, mais simples.
