## Editar nome da clínica em Configurações

Hoje `settings.clinica_nome` é usado por `enfileirar_automacao` para preencher `{{nome_clinica}}` nos modelos, mas não existe tela para alterá-lo. Vou adicionar uma seção "Clínica" em Configurações.

### Rota
- Novo arquivo `src/routes/_authenticated.app.configuracoes.clinica.tsx` → URL `/app/configuracoes/clinica`.
- Item "Clínica" no índice de Configurações (`_authenticated.app.configuracoes.index.tsx`), com ícone `Building2`, marcado `adminOnly`.

### UI
- Header padrão (botão voltar + título "Dados da clínica").
- Card com um único campo controlado:
  - Label: "Nome da clínica"
  - Helper: "Aparece nas mensagens como `{{nome_clinica}}`."
  - Input texto, `maxLength={80}`, trim no salvar.
- Botão "Salvar" desabilitado quando vazio ou igual ao valor atual.
- Toast de sucesso/erro; usa `useIsAdmin` para bloquear edição em não-admin (mostra valor read-only + aviso).

### Dados
- Reutilizar o padrão existente em `settings` (mesma chave: `clinica_nome`, valor armazenado como JSON string — `to_jsonb(text)`).
- Hook novo em `src/hooks/useClinica.ts`:
  - `useClinicaNome()` → `useQuery` lendo `settings` onde `chave='clinica_nome'`, retorna string desserializada.
  - `useUpdateClinicaNome()` → `useMutation` que faz `upsert` em `settings` com `valor = to_jsonb(nome)` via `supabase.from('settings').upsert({ chave: 'clinica_nome', valor: nome })`. Como a coluna é jsonb, o supabase-js serializa a string automaticamente. Invalida a query no sucesso.
- Sem migração: a chave já existe e RLS de `settings` já permite admin escrever (mesmo padrão usado pelas demais configs).

### Critérios de aceite
- [ ] Existe `/app/configuracoes/clinica` com input para o nome.
- [ ] Salvar persiste em `settings.clinica_nome`; novas mensagens automáticas passam a usar o novo nome em `{{nome_clinica}}`.
- [ ] Usuário não-admin vê o valor mas não consegue editar.
- [ ] Sem alterações em edge functions, modelos ou demais tabelas.
