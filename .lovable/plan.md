## Retry com backoff em `processar-mensagens-agendadas`

### 1. Setting nova
Inserir via `supabase--insert` (não migration, é dado):
```sql
INSERT INTO public.settings (chave, valor)
VALUES ('automacoes_max_tentativas', '3'::jsonb)
ON CONFLICT (chave) DO NOTHING;
```

### 2. Mudança na edge function `supabase/functions/processar-mensagens-agendadas/index.ts`

**Ler a setting** junto com as outras no topo:
```ts
const maxTent = clampInt(Number(getSetting<number>(rows, "automacoes_max_tentativas", 3)), 1, 10);
```

**Helper de backoff** (constante no arquivo):
```ts
const BACKOFF_MIN = [10, 30, 60]; // minutos para tentativa 1, 2, 3...
function backoffMsFor(tent: number): number {
  const i = Math.max(0, Math.min(tent - 1, BACKOFF_MIN.length - 1));
  return BACKOFF_MIN[i] * 60 * 1000;
}
```

**No loop, isolar a "falha transitória"** (não-shadowban). Hoje há 2 caminhos que marcam `falhou`:
- `!resp.ok || sb_hit` (resposta da Z-API)
- `catch (e)` (exceção de rede)

Refatorar ambos: se `sb_hit` (shadowban), manter o comportamento atual (`falhou` + `ativarPausaAutoShadowban` + `break`). Se for falha transitória:

```ts
const erroTxt = (errorText || `zapi ${resp.status}`).slice(0, 500);
if (m.tentativas >= maxTent) {
  await sb.from("mensagens_agendadas").update({
    status: "falhou", erro: erroTxt,
  }).eq("id", m.id);
  falhas++;
} else {
  const nova = new Date(Date.now() + backoffMsFor(m.tentativas)).toISOString();
  await sb.rpc("reagendar_mensagem", { _id: m.id, _nova: nova });
  await sb.from("mensagens_agendadas").update({ erro: erroTxt }).eq("id", m.id);
  reagendadas++;
}
continue;
```

Aplicar o mesmo padrão no `catch`. Atenção: `reagendar_mensagem` já volta status para `pendente` e não toca em `tentativas` (o incremento vem do `claim_mensagens_pendentes`), então o contador segue evoluindo a cada retentativa.

Falhas pré-envio que **não** são transitórias (paciente inexistente, opt-out, conteúdo vazio, telefone vazio, sem instância Z-API) **continuam** marcando `falhou`/`cancelada` direto — não fazem sentido reagendar.

**Contador `reagendadas`** já existe no retorno JSON; a retentativa por backoff também incrementa esse contador (semanticamente é "voltou pra fila").

### 3. Guarda anti-loop em `claim_mensagens_pendentes`

Para garantir que nada com `tentativas >= max` seja reclamado mesmo se algo escapar, ajustar a função via migration:

```sql
CREATE OR REPLACE FUNCTION public.claim_mensagens_pendentes(_limit integer)
RETURNS SETOF public.mensagens_agendadas
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _max int;
BEGIN
  SELECT COALESCE((valor)::text::int, 3) INTO _max
    FROM public.settings WHERE chave = 'automacoes_max_tentativas';
  _max := COALESCE(_max, 3);

  RETURN QUERY
  UPDATE public.mensagens_agendadas m
     SET status = 'enviando'::public.msg_status,
         tentativas = COALESCE(m.tentativas, 0) + 1,
         updated_at = now()
   WHERE m.id IN (
     SELECT id FROM public.mensagens_agendadas
      WHERE status = 'pendente'::public.msg_status
        AND agendado_para <= now()
        AND COALESCE(tentativas, 0) < _max
      ORDER BY agendado_para
      LIMIT GREATEST(1, _limit)
      FOR UPDATE SKIP LOCKED
   )
  RETURNING m.*;
END $$;
```

Isso garante o corte por tentativas mesmo se a edge function tiver bug, e impede reenvio infinito.

### 4. Sem mudanças
- Comportamento de shadowban (pausa automática + alerta + `break`) permanece intocado.
- Janela de envio, claim atômico, tetos hora/dia, delays Z-API, opt-out: nada muda.
- `reagendar_mensagem` continua igual (já volta para `pendente`).

### Critérios de aceite
- [ ] Falha não-shadowban com `tentativas < max` → volta para `pendente` com `agendado_para = now + backoff(tent)`, `erro` preenchido, status NÃO vira `falhou`.
- [ ] Após 3ª tentativa fracassada → `falhou` definitivo.
- [ ] Shadowban no 1º envio → `falhou` + pausa automática, sem retry.
- [ ] Mensagem com `tentativas >= max` nunca mais é reclamada por `claim_mensagens_pendentes`.