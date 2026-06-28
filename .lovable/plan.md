## Diagnóstico

Hoje existem duas telas de configuração — `/app/configuracoes/automacoes` e `/app/configuracoes/zapi` — mas:

- **Não há uma página índice `/app/configuracoes`** (hub).
- **Não há link no menu inferior** nem ícone fixo no cabeçalho. Os únicos acessos são dois cards na home, fáceis de não perceber.
- Os shortcuts atuais **não checam `useIsAdmin`**, então a aparência é igual para todos os usuários.

Também é possível (segundo motivo de "não ver nada") que seu usuário não tenha o papel `admin` em `user_roles`. As telas existentes gatam ações sensíveis por esse papel.

## O que vou fazer

1. **Criar `/app/configuracoes` (hub)** — lista grande e clara com:
   - Automações (modelos, janela, pausa global)
   - WhatsApp (Z-API)
   - Espaço pronto para futuras seções (Equipe/Perfil/Clínica)
   - Cada item mostra "Somente admin" quando aplicável; usuário não-admin vê uma mensagem explicando que precisa de permissão.

2. **Ponto de acesso fixo**: adicionar um ícone de engrenagem no cabeçalho da home (`_authenticated.app.index.tsx`) ligando ao hub. Mantém a navegação inferior com 5 itens (sem quebrar layout mobile).

3. **Promover os cards da home**: substituir a seção atual "Configurações" por um único card "Abrir configurações" que leva ao hub (menos ruído na home).

4. **Verificação de papel admin**: ao abrir o hub, se `useIsAdmin` retornar `false`, mostrar aviso "Sua conta não tem papel admin. Peça para um administrador atribuir." Isso esclarece o caso em que o problema é falta de role no banco — não falta de tela.

## Fora de escopo

- Não vou criar UI para gerenciar `user_roles` (atribuir admin a outros usuários) agora — posso fazer em seguida se quiser.
- Não altero as telas internas de Automações/Z-API.

## Arquivos

- novo: `src/routes/_authenticated.app.configuracoes.index.tsx`
- editado: `src/routes/_authenticated.app.index.tsx` (gear no header, simplifica seção)
- (opcional) `src/components/brand/AppShell.tsx` se precisar de slot de ação no header

Confirma que quer apenas o hub agora, ou quer também a tela de gerenciar admins (atribuir/remover papel `admin` a usuários)?
