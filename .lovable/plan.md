## Variantes múltiplas por tipo + descadastro + linguagem segura

### 1. Migration

- `DROP INDEX IF EXISTS public.modelos_mensagem_tipo_ativo_idx;` — permite N ativos por tipo.
- `CREATE OR REPLACE FUNCTION public.enfileirar_automacao(...)` idêntica à atual, trocando apenas o `SELECT id, corpo INTO modelo FROM public.modelos_mensagem WHERE tipo=_tipo AND ativo=true ORDER BY updated_at DESC LIMIT 1` por `ORDER BY random() LIMIT 1`. Resto da função preservado.

### 2. Seed de variantes (mesma migration, via `INSERT ... WHERE NOT EXISTS` por `nome`)

Para cada tipo automático insiro 3 variantes (`V1/V2/V3`) com estrutura e abertura diferentes (saudação direta, narrativa curta, pergunta), **ativo=true**. Mantenho a variante já existente intacta (continua participando do sorteio).

- **confirmacao** (3 novas, sem `{{valor}}`, com CTA "responda 1/2"):
  - V1 — direta: "Oi {{primeiro_nome}}! Confirma seu {{procedimento}} em {{data}} às {{hora}}? Responda *1* para confirmar ou *2* para remarcar. — {{nome_clinica}}"
  - V2 — narrativa: "{{primeiro_nome}}, separamos {{data}} às {{hora}} para o seu {{procedimento}}. Posso confirmar? *1* sim · *2* preciso remarcar. — {{nome_clinica}}"
  - V3 — pergunta primeiro: "Bom te ver por aqui, {{primeiro_nome}}! Seu {{procedimento}} está marcado para {{data}}, {{hora}}. Tudo certo aí? Responda *1* (sim) ou *2* (remarcar). — {{nome_clinica}}"
- **lembrete** (sem valor, com opt-out):
  - V1: "Oi {{primeiro_nome}}, passando pra lembrar do seu {{procedimento}} hoje às {{hora}}. Te esperamos! 🌿\nSe não quiser mais receber mensagens, responda SAIR."
  - V2: "{{primeiro_nome}}, faltam poucas horas pro seu {{procedimento}} ({{hora}}). Qualquer ajuste é só chamar.\nPara parar de receber, responda SAIR."
  - V3: "Lembrete carinhoso, {{primeiro_nome}}: hoje, {{hora}} — seu {{procedimento}}. Até já!\nResponda SAIR a qualquer momento para não receber mais."
- **pos_procedimento**:
  - V1: "{{primeiro_nome}}, como você está se sentindo após o procedimento? Estamos aqui se precisar.\nResponda SAIR para não receber mais mensagens."
  - V2: "Oi, {{primeiro_nome}}! Passou {{dias}} dia(s) do seu atendimento. Tudo correndo bem? Qualquer dúvida, é só responder.\nPara parar de receber, responda SAIR."
  - V3: "{{primeiro_nome}}, queria te dar um oi e saber como anda a recuperação. Pode me contar como está?\nSe preferir não receber mais, responda SAIR."
- **retorno**:
  - V1: "Oi {{primeiro_nome}}, já dá pra agendar seu retorno do {{procedimento}}. Quer que eu te ajude a escolher um horário?\nResponda SAIR para não receber mais mensagens."
  - V2: "{{primeiro_nome}}, chegou a hora do retorno. Posso te oferecer dois horários nesta semana?\nPara parar de receber, responda SAIR."
  - V3: "Faz um tempinho desde seu {{procedimento}}, {{primeiro_nome}}. Que tal marcarmos seu retorno?\nResponda SAIR se não quiser mais ouvir da gente."
- **recall**:
  - V1: "{{primeiro_nome}}, quanto tempo! Que tal cuidar de você de novo? Tenho horários disponíveis na próxima semana.\nResponda SAIR para parar de receber."
  - V2: "Oi {{primeiro_nome}}, lembrei de você por aqui. Posso te separar um horário para uma nova avaliação?\nPara não receber mais, responda SAIR."
  - V3: "{{primeiro_nome}}, sentimos saudade. Vamos retomar seus cuidados? Me diz um dia bom pra você.\nResponda SAIR a qualquer momento."
- **aniversario**:
  - V1: "Feliz aniversário, {{primeiro_nome}}! Que esse novo ciclo venha leve. — {{nome_clinica}}\nResponda SAIR para não receber mais mensagens."
  - V2: "{{primeiro_nome}}, hoje é o seu dia! Toda a equipe da {{nome_clinica}} deseja muita saúde e alegria. 🎉\nPara parar de receber, responda SAIR."
  - V3: "Parabéns, {{primeiro_nome}}! Que o seu dia seja bonito como você. Um abraço da {{nome_clinica}}.\nResponda SAIR se preferir não receber."
- **reativacao**:
  - V1: "{{primeiro_nome}}, faz um tempinho que não nos vemos. Posso te ajudar a voltar à rotina de cuidados?\nResponda SAIR para parar de receber mensagens."
  - V2: "Oi {{primeiro_nome}}, passando pra dizer que estamos por aqui se você quiser retomar seus cuidados.\nPara não receber mais, responda SAIR."
  - V3: "{{primeiro_nome}}, lembramos de você. Quando quiser conversar sobre voltar, é só responder por aqui.\nResponda SAIR a qualquer momento."
- **no_show** (acolhedor, sem cobrança):
  - V1: "Oi {{primeiro_nome}}, sentimos sua falta hoje. Aconteceu algo? Posso já remarcar para você.\nResponda SAIR para não receber mais."
  - V2: "{{primeiro_nome}}, percebemos que não conseguiu vir. Tudo bem? Quando quiser, marcamos um novo horário.\nPara parar de receber, responda SAIR."
  - V3: "Tudo certo, {{primeiro_nome}}? Como você não pôde comparecer, deixamos a porta aberta — me diz quando puder remarcar.\nResponda SAIR se preferir não receber."

Nenhuma variante usa "boleto", "PIX", "cartão" ou `{{valor}}`.

### 3. Frontend

Tela atual (`_authenticated.app.configuracoes.automacoes.tsx`) usa um `<select>` por tipo e busca `modelos.find(m => m.tipo === tipo)` — pega só a primeira variante e edita. Para suportar múltiplas, com mudanças mínimas:

- Em `useMensagens.ts`, manter `useModelos` retornando todos.
- Na página, abaixo do select de tipo, adicionar um segundo select listando as variantes daquele tipo (label `nome` + chip "ativo/inativo"); selecionar variante popula o `ModeloEditor` existente. Botão "Nova variante" cria um modelo com `nome="Variante <n>"`, `ativo=true`, corpo em branco.
- Adicionar `useCreateModelo` em `useMensagens.ts` (insert básico).

Sem mudanças visuais maiores; preserva o editor atual.

### 4. Validação

- `SELECT tipo, count(*) FILTER (WHERE ativo) FROM modelos_mensagem GROUP BY tipo;` → ≥3 ativos nos 8 tipos automáticos (4 contando a variante original).
- Inserir 10 mensagens agendadas do mesmo tipo e conferir distribuição entre variantes (sorteio).
- `grep -iE "boleto|pix|cart[ãa]o|\{\{valor\}\}"` nos corpos retornados → 0.
- Conferir manualmente que toda variante automática (exceto `confirmacao`) termina com "responda SAIR".
