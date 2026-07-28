# SOLIMA production refactor

Landing page SOLIMA preservada em HTML/CSS/JavaScript vanilla, com um backend Node/Express, Prisma/SQLite, upload real de imagens, tickets, idempotência, outbox, painel administrativo e configuração para Railway.

## Execução local

Requisitos: Node.js 22 ou superior.

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate deploy
npm start
```

Abra `http://localhost:3000`. O health check está em `/health`; o painel está em `/admin/login`.

Para criar o hash da palavra-passe administrativa:

```bash
npm run seed -- "uma-palavra-passe-forte-com-12-ou-mais-caracteres"
```

Copie apenas o hash apresentado para `ADMIN_PASSWORD_HASH`. Defina também um `SESSION_SECRET` aleatório com pelo menos 32 caracteres.

## Fluxo do pedido

O formulário tem três passos: contacto, serviço, fotografias/contexto. O browser envia `multipart/form-data` com `Idempotency-Key`. O servidor:

1. normaliza e valida os dados;
2. confirma o tipo real de cada imagem;
3. remove EXIF/GPS ao reprocessar para WebP;
4. cria thumbnails;
5. guarda pedido, ficheiros, estado inicial e evento outbox numa transação;
6. devolve HTTP 201 e um ticket `SOL-YYYYMMDD-XXXXXX`.

O WhatsApp é opcional e abre apenas depois de o pedido estar guardado.

## Storage e Railway

O modo funcional por defeito é `STORAGE_DRIVER=local`. Em Railway, monte um volume persistente em `/app/storage` e configure `STORAGE_ROOT=/app/storage`. Para múltiplas réplicas, implemente o adapter S3 usando as variáveis já documentadas em `.env.example`; uma única réplica com volume é a configuração segura atual.

O `Dockerfile` executa `prisma migrate deploy`, inicia o servidor em `PORT` e o `railway.json` verifica `/health`.

## Notificações

Com `EMAIL_NOTIFICATIONS_ENABLED=true`, configure SMTP e `NOTIFICATION_EMAIL`. O worker processa a outbox fora da transação principal e repete falhas com backoff. `WHATSAPP_MODE=link` mantém o sistema funcional sem credenciais Meta. As variáveis Cloud API estão reservadas para o adapter oficial; tokens nunca entram no frontend.

## Operação

- Testes: `npm test`
- Consolidar CSS/HTML: `npm run build:styles`
- Smoke visual: `npm run qa:smoke`
- Matriz visual completa: `npm run qa:visual`
- Consolidar resultados: `node scripts/merge-visual-results.mjs`
- Auditoria: `npm audit`
- Limpeza de pedidos encerrados: `npm run cleanup`
- Política pública: `/privacy.html`
- Backup original: `solima-spa.backup.html`

Não versionar `.env`, bases de dados locais nem uploads. Faça backup do volume antes de migrations ou operações de retenção.
