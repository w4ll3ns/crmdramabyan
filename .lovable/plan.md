# Diagnóstico

Reproduzi e mapeei o motivo da lentidão entre menus. Não é "rede ruim" – é arquitetura de dados:

1. **Sem preload de rotas.** `src/router.tsx` não define `defaultPreload`. Toda navegação só começa a carregar código + dados *depois* do clique. Em `BottomNav` os `<Link>` também não pedem preload.
2. **Sem loaders.** Nenhuma rota usa `loader` + `ensureQueryData`. As queries só disparam quando o componente monta, então cada troca de aba mostra "Carregando…" do zero, mesmo voltando para uma tela já visitada.
3. **Início (`/app`) dispara ~8 queries independentes** (`useGreetingName`, `useLeadsNovosCount`, `useFollowupsAtrasadosCount`, `useAConfirmarHojeCount`, `useUnreadCount`, `useMiniFunil`, `useNoShowMes`, `useRecallConversionRate`, `useTicketMedioPorProcedimento`) + realtime. `useRecallConversionRate` faz **1 query por evento** (N+1 clássico).
4. **Lista de Conversas faz 2 round-trips grandes**: busca conversas e depois TODAS as mensagens de até 100 conversas (`messages where conversation_id in (...) order by created_at desc`) – sem `limit`. Em clínicas com histórico grande isso traz milhares de linhas só para pegar a última mensagem e contar não-lidas.
5. **Abrir conversa = 4 queries seriais não-paralelas no mount** (`fetchConversa`, `fetchMessages` até 200, `fetchModelos`, `fetchNomeClinica`) e o componente tem 828 linhas com `BottomSheet`, gravador de áudio, sheet de agendamento etc. tudo carregado eagerly.
6. **BottomNav assina `useUnreadCount` e `useAConfirmarHojeCount`** em toda tela, refazendo trabalho em cada troca.

# O que vou mudar

## 1. Preload + cache do router (ganho imediato no clique do menu)
- `src/router.tsx`: adicionar `defaultPreload: "intent"`, `defaultPreloadDelay: 50`, manter `defaultPreloadStaleTime: 0` (Query controla freshness).
- `BottomNav`: links já são `<Link>`, herdam preload. Resultado: passar o dedo/cursor sobre o item já começa a baixar o código da rota e priming do loader.

## 2. Loaders que primam o cache via TanStack Query
Padrão canônico (loader chama `ensureQueryData`, componente usa `useSuspenseQuery`):
- `/_authenticated/app/` → prima `home-summary` (ver item 3).
- `/_authenticated/app/conversas/` → prima `conversas-list` por filtro atual.
- `/_authenticated/app/conversas/$conversaId` → prima `conversa-header`, `conversa-messages` e `modelos` em **paralelo** via `Promise.all`.
- `/_authenticated/app/agenda`, `/funil`, `/pacientes`: idem com queries existentes.
- `staleTime` por query subido (30s→2min onde não há realtime) para que voltar a uma aba já carregada seja instantâneo.

## 3. Consolidar Início em uma única RPC `home_summary()`
Nova função SQL `security definer` retornando JSON com: greeting name, contagem de leads novos (7d), followups atrasados, a confirmar hoje, mini-funil (etapa/count/valor), no-show do mês, ticket médio top-3 (90d). Substitui 8 queries por 1. Mantém hooks atuais como wrappers para compatibilidade.
- Elimina N+1 do `useRecallConversionRate` movendo para SQL com `EXISTS`.
- Throttle no realtime de Home: invalidar no máximo 1x a cada 2s.

## 4. Lista de Conversas: 1 RPC `conversations_overview(filter, limit)`
Retorna por conversa: id, telefone, status, ultima_mensagem_em, paciente (nome/foto), **última mensagem** (via `DISTINCT ON (conversation_id) ... ORDER BY created_at DESC`) e **unread count** (`COUNT(*) FILTER (WHERE direction='inbound' AND status IS NULL)`). Um único round-trip; usa o índice `messages(conversation_id, created_at desc)` que vamos garantir.
- Índices (migration nova, todos `IF NOT EXISTS`):
  - `messages(conversation_id, created_at desc)`
  - `messages(conversation_id, direction, status)` parcial onde `direction='inbound' AND status IS NULL`

## 5. Conversa aberta: paralelizar + code-split + skeleton
- Em `_authenticated.app.conversas.$conversaId.tsx`:
  - Loader paraleliza `fetchConversa`, `fetchMessages(limit 50 inicial)`, `fetchModelos`, `fetchNomeClinica` com `Promise.all` e prima cache.
  - Trocar `limit(200)` por janela inicial de 50 + "Carregar mais" (infinite query). Render do header e últimas mensagens fica instantâneo.
  - Lazy-load (`React.lazy`) das peças pesadas raramente usadas no primeiro frame: `AgendarMensagemSheet`, `useAudioRecorder` + `AudioPlayer`, `BottomSheet` de modelos, `MediaBubble` de vídeo/documento.
  - Skeleton de bolhas no lugar do branco enquanto loader resolve (300ms imperceptíveis viram percepção de "abriu na hora").
- Preload no hover do item da lista (já vem do `defaultPreload: "intent"`).

## 6. BottomNav mais leve
- `useUnreadCount` e `useAConfirmarHojeCount` com `staleTime: 60_000` e `refetchOnWindowFocus: false`; já cacheados pelo loader da Home.

# Detalhes técnicos

- Arquivos editados: `src/router.tsx`, `src/routes/_authenticated.app*.tsx` (loaders), `src/routes/_authenticated.app.conversas.$conversaId.tsx` (code-split + janela), `src/hooks/useHomeDashboard.ts` (wrapper sobre `home_summary`), `src/hooks/useUnreadCount.ts`, `src/hooks/useAgenda.ts` (staleTime).
- Migrations novas:
  - `home_summary()` RPC (`SECURITY DEFINER`, `search_path=public`, `GRANT EXECUTE TO authenticated`).
  - `conversations_overview(p_filter text, p_limit int)` RPC (idem).
  - Índices de `messages` listados acima.
- Nada muda em RLS nem nas regras de negócio; lembretes, agendamento, automações intactos.

# Critérios de aceite

- [ ] Passar o cursor/dedo sobre um item do menu inicia o preload (verificável em Network).
- [ ] Voltar para uma aba já visitada renderiza sem "Carregando…" (cache quente).
- [ ] `/app` faz no máximo **1** request de dados ao montar (a RPC `home_summary`).
- [ ] Lista de conversas faz no máximo **1** request (`conversations_overview`) e não traz mais "todas as mensagens".
- [ ] Abrir uma conversa: header + últimas 50 mensagens visíveis em < 300ms em cache quente; em cache frio, skeleton aparece imediatamente e conteúdo em < 1s na maioria dos casos.
- [ ] Funcionalidades existentes (envio, mídia, agendar mensagem, modelos, realtime) continuam funcionando.

Quer que eu execute o plano inteiro ou prefere fatiar em fases (1+2 primeiro como ganho rápido, depois 3+4, depois 5)?
