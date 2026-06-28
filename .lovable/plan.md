## Correções de automações (enum, pausa, nome_clinica, segredo cron)

### 1. Migration SQL única
Arquivo novo em `supabase/migrations/`:

- **Recriar `public.trg_agendamento_after_update`** idêntica à atual, trocando apenas `'alta'::public.task_prioridade` por `'alta'::public.task_priority` no `INSERT INTO public.tasks` do ramo `status = 'faltou'`. Resto da função preservado.
- **Recriar `public.enfileirar_automacao(...)`** idêntica à atual, trocando o `SELECT ... FROM public.settings WHERE chave = 'regua_pausado'` por `'automacoes_pausado'`. Resto preservado.
- **Seed/migração de chave**: `INSERT INTO public.settings(chave, valor) VALUES ('automacoes_pausado', 'false'::jsonb) ON CONFLICT (chave) DO NOTHING;` e, se existir `regua_pausado`, copiar valor para `automacoes_pausado` quando este ainda for default.
- **Padronizar `clinica_nome`**: `INSERT ... ('clinica_nome', '"Clínica"'::jsonb) ON CONFLICT DO NOTHING;` e, se existir `nome_clinica` com valor não vazio e `clinica_nome` inexistente/vazio, copiar.
- **Revogar execução pública**:
  ```sql
  REVOKE EXECUTE ON FUNCTION public.run_regua_aniversario() FROM PUBLIC, anon, authenticated;
  REVOKE EXECUTE ON FUNCTION public.run_regua_reativacao() FROM PUBLIC, anon, authenticated;
  REVOKE EXECUTE ON FUNCTION public.enfileirar_automacao(uuid, public.modelo_tipo, timestamptz, uuid, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION ... TO service_role;
  ```
  Triggers continuam funcionando (SECURITY DEFINER).

### 2. Secret CRON_SECRET
- Gerar com `generate_secret` (64 chars), nome `CRON_SECRET`. Fica disponível tanto para edge functions quanto para o runtime do TanStack (Cloudflare Worker).

### 3. Edge function `processar-mensagens-agendadas/index.ts`
- No topo do handler, antes de qualquer trabalho:
  ```ts
  const provided = req.headers.get('x-cron-secret');
  const expected = Deno.env.get('CRON_SECRET');
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  ```
  (mantém `OPTIONS` preflight livre).
- Trocar `getSetting<string>(rows, "nome_clinica", "Clínica")` por `"clinica_nome"`.
- Leitura de `automacoes_pausado` já está correta — manter.

### 4. Rota `src/routes/api/public/hooks/reguas-cron.ts`
- Mesma checagem `x-cron-secret` antes do `rpc`. `process.env.CRON_SECRET` lido dentro do handler. 401 sem header válido.

### 5. Frontend `src/components/automacoes/ReguasTab.tsx`
- Atualmente o switch global usa `chave: "regua_pausado"`. Trocar para `"automacoes_pausado"` na chamada `set.mutateAsync` e na leitura `reguas?.regua_pausado` → `reguas?.automacoes_pausado`.
- Verificar `src/hooks/useReguas.ts` para incluir `automacoes_pausado` na lista de chaves carregadas (se houver allowlist) — se já busca livre por chave, nada a fazer.
- Tela de Configurações da clínica (`_authenticated.app.configuracoes.index.tsx`): garantir que o campo de nome grava `clinica_nome` (não `nome_clinica`). Vou inspecionar o arquivo durante a implementação e ajustar se necessário.

### 6. Cron jobs no banco
- Listar `cron.job` para `processar-mensagens-agendadas` e `reguas-cron`; atualizar `headers` JSON adicionando `"x-cron-secret": "<valor>"`. Será feito via `supabase--insert` após a secret existir, lendo o valor através de `current_setting` não é possível — então passamos o valor literal nos `cron.alter_job`/reschedule. Vou listar os jobs existentes primeiro para reagendar com o header correto preservando schedule e URL.

### Validação pós-deploy
- `psql` test: UPDATE de um agendamento para `'faltou'` (em ambiente de teste) — espera sucesso e linha em `tasks`.
- `curl` no endpoint sem header → 401; com header → 200.
- Toggle pausa no frontend reflete em `settings.automacoes_pausado` e processador pula execução.
- Render de template com `{{nome_clinica}}` traz o valor de `clinica_nome`.

### Detalhes técnicos
- A função `enfileirar_automacao` tem assinatura com 7 args (incluindo defaults) — o `REVOKE` precisa da assinatura completa exata.
- `CRON_SECRET` no Worker: `process.env.CRON_SECRET` dentro do handler (não no módulo). No Deno edge: `Deno.env.get('CRON_SECRET')`.
- Sem mudanças em `supabase/config.toml`.
