# 🚀 Comandos de Instalação - Sistema de Fretes

Execute os comandos abaixo **na ordem**:

## 1. Criar arquivo .env

Crie um arquivo chamado `.env` na raiz do projeto com este conteúdo:

```env
DATABASE_URL="postgresql://neondb_owner:npg_kPoBu6Fr7zAi@ep-frosty-rice-acglszy5-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="gere-uma-chave-ou-use-qualquer-string-longa-aqui-temporariamente"
NODE_ENV="development"
```

**Importante:** Substitua o NEXTAUTH_SECRET por uma chave gerada ou use temporariamente qualquer string longa.

## 2. Instalar dependências

```bash
npm install
```

## 3. Gerar Prisma Client

```bash
npm run db:generate
```

## 4. Criar tabelas no banco (Push Schema)

```bash
npm run db:push
```

## 5. Popular banco com dados iniciais

```bash
npm run db:seed
```

## 6. Iniciar servidor de desenvolvimento

```bash
npm run dev
```

## 7. Acessar o sistema

- URL: http://localhost:3000
- Email: admin@sistema.com
- Senha: admin123

---

## ⚠️ Se der erro

### Erro de conexão com banco:
- Verifique se a DATABASE_URL está correta no .env
- Verifique sua conexão com internet (Neon é online)

### Erro no npm install:
- Delete a pasta `node_modules` se existir
- Delete o arquivo `package-lock.json` se existir
- Execute novamente: `npm install`

### Erro no db:push:
- Execute: `npm run db:generate` primeiro
- Depois: `npm run db:push`

---

## 🎯 Resumo Rápido (Copy & Paste)

```bash
# Após criar o arquivo .env:
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```
