# 🚚 Sistema de Cotação de Fretes - Next.js

Sistema completo e moderno para cotação e gestão de fretes, desenvolvido com as melhores tecnologias web.

## 🚀 Tecnologias

- **Framework:** Next.js 14 (App Router)
- **Linguagem:** TypeScript
- **Banco de Dados:** MySQL/PostgreSQL com Prisma ORM
- **UI:** shadcn/ui + TailwindCSS + Lucide Icons
- **Autenticação:** NextAuth.js
- **Gerenciamento de Estado:** TanStack Query
- **Gráficos:** Recharts
- **Validação:** Zod + React Hook Form

## 📋 Pré-requisitos

- Node.js 18+ 
- MySQL 8+ ou PostgreSQL 14+
- npm/pnpm/yarn

## 🔧 Instalação

### 1. Clone o repositório

```bash
cd sistema-fretes-nextjs
```

### 2. Instale as dependências

```bash
npm install
# ou
pnpm install
# ou
yarn install
```

### 3. Configure as variáveis de ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# Database (escolha MySQL ou PostgreSQL)
DATABASE_URL="mysql://user:password@localhost:3306/sistema_frete"
# ou
DATABASE_URL="postgresql://user:password@localhost:5432/sistema_frete"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="gere-uma-chave-secreta-forte-aqui"

# App
NODE_ENV="development"
```

**Gerar NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 4. Configure o banco de dados

```bash
# Gerar cliente Prisma
npm run db:generate

# Criar tabelas no banco
npm run db:push

# Ou rodar migrations (recomendado para produção)
npm run db:migrate

# Popular banco com dados iniciais
npm run db:seed
```

### 5. Execute o projeto

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

## 👤 Acesso Padrão

Após rodar o seed:
- **Email:** admin@sistema.com
- **Senha:** admin123

## 📁 Estrutura do Projeto

```
sistema-fretes-nextjs/
├── app/                        # Next.js App Router
│   ├── (auth)/                # Rotas públicas (login, registro)
│   ├── (dashboard)/           # Rotas protegidas
│   │   ├── dashboard/         # Dashboard principal
│   │   ├── produtos/          # CRUD Produtos
│   │   ├── transportadoras/   # CRUD Transportadoras
│   │   ├── cotacoes/          # Cotações
│   │   └── regioes/           # Regiões e preços
│   ├── api/                   # API Routes
│   │   ├── auth/              # NextAuth endpoints
│   │   └── v1/                # API versionada
│   ├── layout.tsx             # Layout global
│   └── globals.css            # Estilos globais
├── components/                # Componentes React
│   ├── ui/                    # shadcn/ui components
│   ├── forms/                 # Formulários
│   ├── tables/                # Tabelas de dados
│   └── charts/                # Gráficos
├── lib/                       # Bibliotecas e utilitários
│   ├── prisma.ts              # Cliente Prisma
│   ├── auth.ts                # Configuração NextAuth
│   ├── cotacao/               # Motor de cotação
│   │   ├── calculator.ts      # Cálculo de fretes
│   │   └── types.ts           # Tipos TypeScript
│   └── utils.ts               # Funções utilitárias
├── prisma/
│   ├── schema.prisma          # Schema do banco
│   ├── seed.ts                # Dados iniciais
│   └── migrations/            # Migrations
├── types/                     # TypeScript type definitions
└── public/                    # Arquivos estáticos
```

## 🎯 Funcionalidades

### ✅ Gestão
- CRUD completo de Produtos (nome, SKU, dimensões, peso)
- CRUD completo de Transportadoras
- Configuração de Regiões com faixas de CEP
- Tabelas de Preço por peso e região
- Taxas configuráveis (GRIS, Despacho, Pedágio, TAS, TDA, TDE, TRF, etc)

### ✅ Cotações
- Cotação manual via interface web
- Cotação via API REST
- Comparação automática entre transportadoras
- Cálculo de cubagem por transportadora
- Aplicação de taxas e impostos
- Histórico completo de cotações
- Cross-docking baseado em estoque

### ✅ Dashboard
- Estatísticas em tempo real
- Gráficos interativos (Recharts)
- Top produtos mais cotados
- Métricas de hoje vs. histórico
- Design moderno (shadcn/ui)

### ✅ API REST
- Endpoint de cotação (`/api/v1/cotacao`)
- Versionamento de API
- Logs de requisições
- Suporte a marketplaces (Mercado Livre, Shopee, Anymarket)

### ✅ Segurança
- Autenticação com NextAuth.js
- Sessões JWT
- Passwords hasheadas com bcrypt
- Validação client + server (Zod)
- Type-safe queries (Prisma)

## 🗺️ Rotas Principais

```
/ → Redireciona para /dashboard ou /login

Autenticação:
  /login                     → Login
  /registro                  → Registro

Dashboard:
  /dashboard                 → Dashboard principal
  
Produtos:
  /produtos                  → Listagem
  /produtos/novo             → Novo produto
  /produtos/[id]/editar      → Editar produto
  /produtos/[id]/cubagem     → Configurar cubagem
  
Transportadoras:
  /transportadoras           → Listagem
  /transportadoras/novo      → Nova transportadora
  /transportadoras/[id]/editar    → Editar
  /transportadoras/[id]/regioes   → Gerenciar regiões
  
Regiões:
  /regioes/novo              → Nova região
  /regioes/[id]/editar       → Editar região
  /regioes/[id]/precos       → Tabela de preços
  /regioes/[id]/taxas        → Configurar taxas
  
Cotações:
  /cotacoes                  → Nova cotação
  /cotacoes/historico        → Histórico
  /cotacoes/[id]             → Detalhes

API:
  POST /api/v1/cotacao       → Cotar frete via API
```

## 🧪 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia servidor de desenvolvimento

# Build
npm run build            # Build para produção
npm run start            # Inicia servidor de produção

# Banco de Dados
npm run db:generate      # Gera cliente Prisma
npm run db:push          # Sincroniza schema (dev)
npm run db:migrate       # Cria migration
npm run db:studio        # Abre Prisma Studio
npm run db:seed          # Popula banco com dados iniciais

# Linting
npm run lint             # Roda ESLint
```

## 🎨 Componentes shadcn/ui Instalados

Para adicionar novos componentes:

```bash
npx shadcn-ui@latest add [component-name]
```

Componentes já instalados:
- Button
- Card
- Input
- Label
- Select
- Dialog
- Dropdown Menu
- Toast/Toaster
- Tabs
- Separator
- Avatar

## 📊 Banco de Dados

### Schema Principal

O sistema utiliza as seguintes tabelas:

- `usuarios` - Usuários do sistema
- `transportadoras` - Transportadoras cadastradas
- `transportadora_regioes` - Regiões de atendimento
- `transportadora_regiao_precos` - Faixas de peso e preços
- `transportadora_regiao_kg_adicional` - Valor por kg excedente
- `transportadora_regiao_taxas` - Todas as taxas configuráveis
- `produtos` - Produtos cadastrados
- `produto_transportadora_cubagem` - Cubagem específica por transportadora
- `cotacoes_log` - Histórico de cotações
- `cotacoes_log_produtos` - Produtos de cada cotação

## 🚀 Deploy

### Vercel (Recomendado)

```bash
npm install -g vercel
vercel
```

### Docker

```bash
docker build -t sistema-fretes .
docker run -p 3000:3000 sistema-fretes
```

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Proprietário - Todos os direitos reservados

## 🎯 Roadmap

### Em Desenvolvimento
- [ ] Dashboard com métricas avançadas
- [ ] Exportação de cotações em PDF
- [ ] Sistema de notificações
- [ ] API com rate limiting

### Futuro
- [ ] App mobile (React Native)
- [ ] Integração com Correios
- [ ] Multi-tenancy
- [ ] BI e Analytics avançado
- [ ] Webhooks para integrações

---

**Desenvolvido com ❤️ usando Next.js e shadcn/ui**
