## Nova rota: Configurações › Variáveis

Tela read-only que documenta todas as variáveis disponíveis nos modelos de mensagem, com nome, descrição, exemplo e origem (de onde o sistema preenche o valor em tempo de envio).

### Rota
- `src/routes/_authenticated.app.configuracoes.variaveis.tsx` → URL `/app/configuracoes/variaveis`.
- Adicionar link "Variáveis" na navegação de Configurações (junto de Automações / Z-API).

### Conteúdo da tela
Tabela / lista de cards, uma linha por variável. Fonte da verdade: `enfileirar_automacao` (DB) + `src/lib/templates.ts`.

| Variável | Descrição | Exemplo | Origem |
|---|---|---|---|
| `{{nome}}` | Nome completo do paciente | Maria Silva | `pacientes.nome` |
| `{{primeiro_nome}}` | Primeiro nome do paciente | Maria | derivado de `pacientes.nome` |
| `{{nome_clinica}}` | Nome da clínica | Clínica Ramabyan | `settings.clinica_nome` |
| `{{data}}` | Data do agendamento (DD/MM/AAAA, fuso America/Fortaleza) | 28/06/2026 | `agendamentos.data_hora` |
| `{{hora}}` | Hora do agendamento (HH:MM) | 14:30 | `agendamentos.data_hora` |
| `{{procedimento}}` | Nome do procedimento | Avaliação | `procedimentos.nome` |
| `{{profissional}}` | Profissional responsável | Dra. Ramabyan | `agendamentos.profissional` |
| `{{valor}}` | Valor do agendamento (uso restrito; evitar em automáticas) | R$ 350,00 | `agendamentos.valor` |

Cada linha mostra:
- Chip com a sintaxe `{{chave}}` + botão "copiar".
- Descrição curta.
- Coluna "Exemplo" usando `MOCK_VARS` de `src/lib/templates.ts`.
- Coluna "Origem" em texto simples (tabela.coluna).
- Badge "Disponível só quando há agendamento" para `data`, `hora`, `procedimento`, `profissional`, `valor`.
- Aviso destacando que `{{valor}}` não deve aparecer em modelos automáticos (regra já aplicada nas seeds).

Topo da página:
- Título "Variáveis de mensagem" + parágrafo curto explicando que são substituídas no momento do envio e listando o fuso usado para `data`/`hora` (America/Fortaleza).
- Caixa de "Pré-visualização": textarea livre + render usando `renderTemplate(corpo, MOCK_VARS)` para o admin testar combinações sem sair da tela.

### Implementação
- Página puramente client, sem loader pesado; importa `VARIAVEIS_MENSAGEM`, `MOCK_VARS`, `renderTemplate` de `src/lib/templates.ts`.
- Definir um array local `VARIAVEIS_META` com `{ key, descricao, origem, exigeAgendamento, aviso? }` para alimentar a tabela (a lista de chaves continua sendo `VARIAVEIS_MENSAGEM`, mantendo uma única fonte).
- Reaproveita componentes `Card`, `Table`, `Badge`, `Button` já usados no projeto.
- Sem mudanças de banco, sem mudanças nas edge functions, sem mudanças no editor de modelos.

### Critérios de aceite
- [ ] Existe rota `/app/configuracoes/variaveis` acessível pelo menu de Configurações.
- [ ] Todas as 8 variáveis suportadas por `enfileirar_automacao` aparecem listadas com descrição, exemplo e origem coerentes com o que o DB injeta.
- [ ] Botão "copiar" coloca `{{chave}}` no clipboard.
- [ ] Pré-visualização renderiza um texto livre substituindo as variáveis pelos valores de exemplo.
- [ ] Nenhuma alteração em `modelos_mensagem`, `settings` ou nas funções de envio.
