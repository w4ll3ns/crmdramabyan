## 1. Rotacionar CRON_SECRET via Vault (sem expor em migration)

**Gerar novo valor** com `secrets--generate_secret` (`CRON_SECRET`, 64 chars) — atualiza a env das edge functions e do servidor TanStack automaticamente. O valor nunca aparece no chat, no SQL nem em qualquer arquivo.

**Migration nova** (SQL versionado, sem segredo literal):
- `CREATE EXTENSION IF NOT EXISTS supabase_vault;`
- Apaga entrada antiga, se existir: `DELETE FROM vault.secrets WHERE name = 'cron_secret';`
- Reagenda os 3 jobs lendo o valor do Vault em runtime, ex.:
  ```sql
  SELECT cron.unschedule('processar-mensagens-5min');
  SELECT cron.schedule(
    'processar-mensagens-5min','*/5 * * * *',
    $$
    SELECT net.http_post(
      url := 'https://ehbgrqqleluhyzwwhbol.supabase.co/functions/v1/processar-mensagens-agendadas',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'apikey', current_setting('app.settings.anon_key', true),
        'x-cron-secret',
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cron_secret')
      ),
      body := '{}'::jsonb
    );
    $$
  );
  ```
  (o `apikey` continua sendo a anon key publishable, inline — não é segredo.)

**Inserir o segredo no Vault** sem versionar: feito com `supabase--insert` (ferramenta read-only-em-migrations, mas grava direto), executando `SELECT vault.create_secret(:value, 'cron_secret');` com o novo valor passado como parâmetro. Esse passo não cria arquivo SQL.

**Re-escrever a migration histórica que vazou o valor** (`20260628203848_…sql` linhas 227/239/251): substituir as 3 strings hardcoded por placeholder `__CRON_SECRET_VIA_VAULT__` num comentário explicando que os jobs reais são reagendados pela migration nova. Isso garante que `git grep <valor_antigo>` retorne vazio em qualquer commit futuro (commits antigos do histórico Git permanecem — o valor já está rotacionado, então não é mais válido).

## 2. Apontar cron para produção

Trocar nos 2 jobs de régua:
- `https://project--ad354cb1-87ea-4a9c-8eed-f91574a39190.lovable.app/...`
- por: `https://crmdramabyan.lovable.app/api/public/hooks/reguas-cron?job=…`

`processar-mensagens-5min` continua chamando `…supabase.co/functions/v1/…`.

Validar com `supabase--read_query` chamando `SELECT * FROM public.diag_cron_jobs();` após o reagendamento e confirmar `active=true` nos 3.

## 3. Remover `.env` do versionamento

- Adicionar `.env` ao `.gitignore` (não está lá hoje).
- `git rm --cached .env` via shell.
- Manter o arquivo local intacto. As únicas chaves dentro dele já são públicas (`VITE_SUPABASE_*`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` = anon publishable). `SERVICE_ROLE`, `CRON_SECRET`, `ZAPI_WEBHOOK_TOKEN` permanecem só como secrets do ambiente (já estão).

## Validação final
- `git grep 55c65dc8` → vazio (após edição da migration antiga).
- `git ls-files | grep -x .env` → vazio.
- `diag_cron_jobs()` lista 3 jobs ativos apontando para domínios corretos.
- Chamada manual ao endpoint com header antigo → 401; com novo (lido do Vault no cron) → 200.

### Confirmações necessárias
1. Posso re-escrever a migration histórica `20260628203848_…sql` removendo o valor literal antigo do `CRON_SECRET`? (O DB de produção não é re-executado, só limpa o histórico do repo.)
2. Confirma `crmdramabyan.lovable.app` como domínio de produção alvo das duas réguas?