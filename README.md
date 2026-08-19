# SOLIMA Piscinas

SOLIMA é uma landing page de conversão para pedidos de construção, modernização e manutenção de piscinas. O visitante envia um único formulário; a API aceita o pedido de forma durável e entrega o resumo e as fotografias à operação SOLIMA pela WhatsApp Business Cloud API.

## Estrutura

- `apps/web`: landing page vanilla preservada e formulário de três passos.
- `apps/api`: Express, Prisma/SQLite, processamento Sharp, fila de entregas e webhook Meta.
- `apps/api/prisma`: cadeia de migrações SQLite.
- `legacy`: implementação anterior isolada, não exposta pela aplicação atual. Não a execute.

## Desenvolvimento local

1. Copie `.env.example` para `.env` e configure pelo menos `DATABASE_URL`, `STORAGE_ROOT`, `PRIVACY_POLICY_VERSION` e um destino de teste para `WHATSAPP_DESTINATION_NUMBER`.
2. Execute `npm ci`.
3. Execute `npm run prisma:generate` e `npm run prisma:migrate`.
4. Execute `npm run dev` e abra `http://localhost:3000`.

Com `WHATSAPP_ENABLED=false`, o processo local usa o adaptador falso; não envia mensagens reais. Produção falha no arranque caso a configuração Meta obrigatória não exista.

## Testes e QA

```sh
npm test
npm run prisma:validate
npm run prisma:generate
npm run qa:normal
npm run qa:reduced
```

Os testes incluem a cadeia completa de migrações, idempotência concorrente, validação de upload, entrega falsa e autenticação de webhook. Consulte [a arquitetura de produção](docs/production-architecture.md) e o [runbook](docs/go-live-runbook.md) antes de qualquer deploy.

## Variáveis de produção

Em Railway, use `DATABASE_URL=file:/app/data/solima.db` e `STORAGE_ROOT=/app/data/pending-media`, num Volume montado em `/app/data`. Os valores Meta são secretos e devem ser definidos como variáveis seladas no serviço, nunca no Git ou no Dockerfile.
