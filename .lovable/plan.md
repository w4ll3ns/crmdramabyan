# Mensagens automáticas e agendadas (Z-API)

Implementa modelos editáveis, fila com agendamento, processador cron, envio manual agendado e tela de Configurações > Automações.

## 1. Banco (1 migração)

### Tabela `modelos_mensagem`
- `nome` text, `tipo` enum `modelo_tipo` (`boas_vindas|confirmacao|lembrete|pos_procedimento|retorno|recall|aniversario|reativacao|no_show|manual`), `corpo` text, `ativo` boolean default true.
- Unique parcial em `tipo` quando `ativo=true` (1 modelo ativo por tipo).
- RLS: SELECT authenticated; INSERT/UPDATE/DELETE só `has_role(uid,'admin')`.
- Seed: 1 linha por tipo, com `corpo` neutro (placeholder genérico, conteúdo clínico em branco para a Dra. preencher) — feito via tool insert depois da migração.

### Tabela `mensagens_agendadas`
- `paciente_id` fk, `conversation_id` fk null, `agendamento_id` fk null, `modelo_id` fk null,
- `tipo` modelo_tipo, `conteudo_renderizado` text, `variaveis` jsonb,
- `agendado_para` timestamptz, `status` enum `msg_status` (`pendente|enviada|cancelada|falhou|respondida`) default `pendente`,
- `tentativas` int default 0, `enviada_em` timestamptz, `erro` text,
- `origem` enum (`automacao|manual`), `created_by` uuid.
- Índice `(status, agendado_para)`.
- RLS: SELECT/INSERT/UPDATE authenticated; DELETE admin.

### `settings` (já existe, chave/valor)
Chaves novas (consumidas pelo processador):
- `automacoes_janela_inicio` (default `08:00`), `automacoes_janela_fim` (`20:00`),
- `automacoes_fuso` (`America/Fortaleza`),
- `automacoes_limite_minuto` (`8`),
- `automacoes_palavra_optout` (`sair`),
- `automacoes_pausado` (`false`).

### Função `render_template(template text, vars jsonb)`
Substitui `{{chave}}` por `vars->>chave`. SECURITY INVOKER, IMMUTABLE.

## 2. Edge function `processar-mensagens-agendadas`

Trigger: pg_cron a cada 5 min via `pg_net` POST com `apikey` anon header (rota dentro de `supabase/functions/`, não TanStack — segue padrão do projeto que já usa edge functions para Z-API).

Fluxo por execução:
1. Lê `settings` (janela, fuso, limite/min, pausado). Se `pausado=true`, retorna 0.
2. Verifica hora atual no fuso. Se fora da janela: reprograma pendentes vencidas para o próximo início de janela, retorna.
3. Seleciona até `limite_minuto*5` mensagens `pendente` com `agendado_para <= now()`, ordenadas por `agendado_para`.
4. Para cada uma:
   - Carrega `paciente`. Se `aceita_automacoes=false` e `origem='automacao'` → status `cancelada`, erro `opt-out`.
   - Se `conteudo_renderizado` vazio e tem `modelo_id` → renderiza via `render_template`.
   - Chama `zapi-send` internamente (telefone do paciente, type `text`, content renderizado), com `Authorization` service-role e `created_by` mapeado.
   - Atualiza `status='enviada'`, `enviada_em=now()`, `tentativas+=1`. Em erro: `status='falhou'`, `erro=msg`, `tentativas+=1`.
   - Delay aleatório 2–6s entre mensagens (anti-bloqueio).
5. Idempotência: lock leve via `UPDATE ... SET status='enviada'` condicionado a `status='pendente'`.

Cron SQL (via tool insert, não migração): `cron.schedule('processar-msgs-5min', '*/5 * * * *', ...)` chamando `https://<project>.supabase.co/functions/v1/processar-mensagens-agendadas` com header `apikey` anon (verify_jwt=false na função).

## 3. UI

### `src/routes/_authenticated.app.configuracoes.automacoes.tsx` (admin)
- Aba/seção "Janela e limites": time pickers início/fim, select fuso, input limite/min, input palavra opt-out, switch "pausar automações global".
- Aba "Modelos": lista por tipo, editor com:
  - Textarea `corpo`, **contador de caracteres** (limite suave 1000),
  - Chips clicáveis de variáveis (`{{nome}}` etc.) que inserem no cursor,
  - **Prévia** ao vivo com dados mock (nome="Maria", data="28/06/2026", hora="14:30", procedimento="Avaliação", etc.),
  - Switch `ativo`, botão salvar.

### Agendar mensagem manual
- Botão "Agendar mensagem" em:
  - Detalhe da conversa (`_authenticated.app.conversas.$conversaId.tsx`),
  - Ficha do paciente, aba Resumo.
- Bottom sheet `AgendarMensagemSheet`: escolher modelo (preenche corpo renderizado) **ou** texto livre + date/time picker → cria `mensagens_agendadas` com `origem='manual'`.

### Link no menu de Configurações
Adicionar atalho "Automações" na home/menu de configurações (rota nova).

## 4. Componentes/hooks novos
- `src/components/automacoes/ModeloEditor.tsx`
- `src/components/automacoes/MensagemPreview.tsx`
- `src/components/automacoes/AgendarMensagemSheet.tsx`
- `src/components/automacoes/JanelaConfigForm.tsx`
- `src/hooks/useModelos.ts`, `useMensagensAgendadas.ts`, `useAutomacaoSettings.ts`
- `src/lib/templates.ts` — `renderTemplate(corpo, vars)` client-side para prévia.

## 5. Segurança
- Editor de modelos e Configurações > Automações: gate `useIsAdmin`.
- Edge function valida `apikey` anon (cron) ou `service_role` (chamadas internas); usa admin client para ler/atualizar.
- Webhook de entrada (já existe `zapi-webhook`): adicionar handler para palavra opt-out → seta `pacientes.aceita_automacoes=false` e marca mensagens pendentes desse paciente como `cancelada` (opt-out). *Escopo opcional desta entrega, default ligado.*

## 6. Critérios de aceite
- pg_cron dispara a função a cada 5 min; mensagens só saem dentro da janela.
- Fora da janela: pendentes são reprogramadas (não enviadas).
- `aceita_automacoes=false` → cancela automações; manual ainda envia.
- Toggle "pausar automações" interrompe todo o envio.
- Editor mostra contador de caracteres e prévia com variáveis.
- "Agendar mensagem" disponível na conversa e na ficha.
- Palavra de opt-out recebida via webhook desativa automações do paciente.
