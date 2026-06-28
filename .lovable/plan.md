## Problema
Na conversa, o sheet "Modelos de mensagem" busca de `settings.mensagem_modelos` (chave legada, array de strings). Os modelos reais ficam em `public.modelos_mensagem` (usados pelo editor em Configurações > Automações). Resultado: lista sempre vazia.

## Correção

**Arquivo:** `src/routes/_authenticated.app.conversas.$conversaId.tsx`

1. Substituir `fetchModelos()` (linhas 81–90) pela leitura da tabela `modelos_mensagem`, filtrando `ativo = true` e ordenando por `tipo`. Retornar `{ id, nome, tipo, corpo }[]`.
2. Atualizar `useQuery(["mensagem_modelos"])` → `useQuery(["modelos_mensagem","ativos"])` com o novo retorno.
3. Renderizar cada item no sheet com **nome** (título) + prévia do `corpo` (linha secundária `line-clamp-2`).
4. Ao tocar, renderizar variáveis com `renderTemplate(m.corpo, vars)` usando `MOCK_VARS` mescladas com dados reais do paciente/conversa disponíveis (`nome`, `primeiro_nome`, `nome_clinica` via settings se já carregado; demais campos ficam como placeholder vazio quando não houver agendamento em contexto). Inserir o texto renderizado no input (substituindo o append cru de hoje).
5. Manter o texto auxiliar: "Cadastre modelos em Configurações > Automações."

## Sem mudanças
Nenhuma alteração de schema, RLS, ou outros arquivos. Apenas a leitura no componente de conversa.

## Critério de aceite
Abrir uma conversa → tocar no botão de modelos → lista mostra todos os modelos ativos cadastrados; tocar em um insere o corpo com variáveis substituídas no campo de mensagem.
