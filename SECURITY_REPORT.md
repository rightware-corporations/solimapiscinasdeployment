# Relatório de segurança

> Histórico: este relatório antecede a migração para `LeadSubmission` e `WhatsAppDelivery`. Os controlos atuais estão documentados em `docs/production-architecture.md`.

## Controlos implementados

- Validação server-side com allowlists, limites e normalização Unicode NFKC.
- Telefone normalizado em E.164 com região Moçambique por defeito.
- Upload máximo de 5 fotos do local e 2 inspirações, 5 MB cada.
- Tipo real detetado a partir dos bytes; SVG e MIME falsificado são rejeitados.
- Sharp decodifica, roda e regrava WebP, removendo EXIF/GPS; thumbnails separados.
- Nomes de ficheiro sanitizados; storage keys geradas pelo servidor.
- Idempotência com unique constraint; tickets aleatórios não sequenciais.
- Queries parametrizadas via Prisma e relações com cascade explícito.
- Helmet, CSP, CORS restrito, limites de body/upload, rate limit global, de upload e login.
- Honeypot e tempo mínimo de preenchimento.
- Sessões administrativas server-side, cookie HttpOnly/SameSite=Strict/Secure em produção e CSRF em alterações.
- Password hashing bcrypt; respostas não expõem stack traces, caminhos nem chaves privadas.
- Outbox separa persistência de notificações; falha de email/WhatsApp não apaga o pedido.
- Conteúdo administrativo escapado; nenhum input do utilizador entra via `innerHTML`.
- Auditoria npm executada com zero vulnerabilidades conhecidas.

## Riscos residuais e decisões operacionais

- SQLite com volume é adequado a uma única réplica. Para escala horizontal, migrar o schema para PostgreSQL e storage para S3.
- A integração WhatsApp Cloud API está configurada por feature flag, mas exige credenciais e templates externos antes de ativação.
- O modo de email depende da segurança do servidor SMTP configurado.
- Definir um segredo de sessão forte e um hash admin antes de produção; os defaults de desenvolvimento não são apropriados.
- Restringir acesso ao volume e implementar backups cifrados.
- Agendar `npm run cleanup` e rever `UPLOAD_RETENTION_DAYS` com a política legal local.
- CAPTCHA fica desativado por padrão; ativar o adapter se métricas mostrarem abuso.

## Verificação

Os testes cobrem criação válida, telefone/serviço inválidos, idempotência, imagem real, SVG disfarçado e autenticação administrativa. Recomenda-se adicionar testes de carga, pen test independente e teste real de SMTP/Cloud API antes de ativar integrações externas.
