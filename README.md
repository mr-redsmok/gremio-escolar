# Urna Escolar

Sistema de votação para eleição do grêmio estudantil, com urna eletrônica em português, painel administrativo, apuração e relatórios em PDF.

Desenvolvido com **Vue 3**, **Vite**, **Pinia**, **Vue Router**, **Supabase**, **jsPDF** e **Vitest**. O projeto pode ser publicado na Vercel e inclui um modo de demonstração que funciona sem credenciais.

## Funcionalidades

### Urna pública

- Identificação do eleitor por nome completo e turma, sem lista prévia de eleitores.
- Bloqueio de novo voto pela combinação normalizada de nome e turma.
- Um cargo por tela, na ordem definida pela comissão.
- Teclado numérico e atalhos de teclado físico.
- Voto para candidato, em branco ou nulo, com correção e dupla confirmação de número inexistente.
- Overlay de confirmação e tela final **FIM**.
- Cancelamento por inatividade e proteção contra saída acidental durante a votação.
- Registro atômico de todos os cargos somente no final; votos parciais não são persistidos.
- Comparecimento separado dos votos, sem vínculo entre eleitor, escolha, sessão ou horário do voto.

### Administração

- Autenticação com Supabase Auth e autorização pela tabela `urna_admins`.
- Acesso discreto pela urna: cinco toques no título ou `Ctrl+Shift+A`.
- Painel com indicadores, apuração por cargo e auditoria recente.
- Configuração da escola, eleição, comissão, cargos e candidatos.
- Ciclo de vida: `rascunho` → `aberta` → `encerrada` → `arquivada`.
- Somente uma eleição aberta por vez; configuração congelada após a abertura.
- Consulta interna e somente leitura dos votantes.
- Relatórios: zerésima, boletim por cargo e ata de encerramento.
- Histórico de relatórios com hash SHA-256 e download de PDF.
- Trilha de auditoria das ações administrativas e dos registros de voto, sem identificar eleitores.

Não há fotos, logotipos, cadastro público de administradores ou PDF de comparecimento.

## Executar em modo demonstração

Requisitos: Node.js 20 ou superior e npm.

```bash
npm install
cp .env.example .env
```

No arquivo `.env`, ative o modo local:

```env
VITE_DEMO=true
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Inicie o servidor:

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5175`.

O modo demonstração começa com uma eleição aberta e candidatos fictícios. Os dados são armazenados no `localStorage` do navegador e não representam votos reais.

**Credenciais administrativas da demonstração:**

- E-mail: `admin@escola.local`
- Senha: `admin123`

Para abrir o login, use cinco toques em **Urna Escolar** no topo da página ou pressione `Ctrl+Shift+A`.

## Configurar o Supabase

### 1. Criar o projeto e executar os SQLs

Crie um projeto no [Supabase](https://supabase.com/). No **SQL Editor**, execute os arquivos abaixo, nesta ordem:

1. `sql/001_schema.sql` — tabelas, índices e restrições.
2. `sql/002_functions.sql` — funções RPC e regras transacionais.
3. `sql/003_rls.sql` — Row Level Security e permissões.
4. `sql/004_storage.sql` — bucket privado `urna-relatorios` e políticas.
5. `sql/005_admin.sql` — promoção do administrador inicial, após ajustar o e-mail.

### 2. Criar o administrador

1. Abra **Authentication → Users** e crie o usuário administrador com e-mail e senha.
2. Em `sql/005_admin.sql`, substitua `admin@escola.com` pelo e-mail criado e execute o arquivo.
3. Em **Authentication → Providers → Email**, desative **Enable sign ups** para impedir cadastros públicos.

Somente usuários presentes em `urna_admins` com papel `admin` conseguem acessar o painel.

### 3. Configurar as variáveis

Copie a URL do projeto e a chave pública **anon** em **Project Settings → API**:

```env
VITE_DEMO=false
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
```

Use somente a chave `anon` no frontend. **Nunca coloque `service_role` no `.env`, no código ou na Vercel.**

## Publicar na Vercel

1. Envie o repositório ao GitHub e importe-o na Vercel.
2. A Vercel detectará o projeto Vite automaticamente:
   - Build: `npm run build`
   - Saída: `dist`
3. Configure as três variáveis de ambiente acima para produção.
4. Publique. O `vercel.json` já contém o rewrite necessário para as rotas do Vue Router.

A aplicação é **online-only**. A urna precisa de conexão com o Supabase para liberar eleitores e registrar votos.

## Comandos

```bash
npm run dev       # servidor de desenvolvimento
npm run build     # build de produção
npm run preview   # visualizar o build localmente
npm run lint      # ESLint
npm test          # testes com Vitest
npm run format    # Prettier nos arquivos de src e tests
```

## Relatórios e privacidade

- **Zerésima:** só pode ser emitida antes do primeiro voto.
- **Boletim por cargo:** inclui votos válidos, brancos, nulos, percentuais, ranking, vencedor ou empate. Pode ser parcial durante a votação, com identificação e marca d'água; após o encerramento, é oficial.
- **Ata de encerramento:** disponível somente com a eleição encerrada, com comparecimento, resultados e campos de assinatura.

Os PDFs são gerados no navegador e enviados ao bucket privado `urna-relatorios`. O download no Supabase usa URL assinada temporária. No modo demonstração, os últimos oito PDFs ficam somente no navegador.

A lista de votantes é separada das escolhas e não possui exportação em PDF.

## Estrutura

```text
src/
  components/       componentes visuais, modais e teclado da urna
  layouts/          layouts público e administrativo
  lib/              serviços, apuração, validações, PDF e máquina da urna
  router/           rotas e guardas de acesso
  stores/           estado Pinia
  styles/           estilos globais, urna e administração
  views/            telas públicas e administrativas
sql/                schema, RPCs, RLS, Storage e administrador inicial
tests/              testes unitários e de integração do modo demo
```

## Observações de segurança

- O eleitor não consulta nem grava diretamente nas tabelas de votos.
- As operações públicas usam RPCs `security definer` com validações no banco.
- A tabela de votos não possui políticas públicas de leitura ou escrita.
- Sessões de votação usam tokens aleatórios, expiração e consumo único.
- O registro final é atômico e idempotente para uma sessão já utilizada.
- A consulta de votantes, apuração, relatórios e auditoria exige administrador autenticado.
