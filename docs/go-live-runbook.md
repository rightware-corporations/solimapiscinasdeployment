# Runbook de entrada em produção

## Pré-requisitos Meta

Antes de ativar produção, obtenha e configure como variáveis seladas no Railway:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID` (remetente Cloud API)
- `WHATSAPP_DESTINATION_NUMBER` (destino operacional, distinto do remetente)
- `WHATSAPP_API_VERSION`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `META_APP_SECRET`
- `WHATSAPP_SUMMARY_TEMPLATE_NAME`
- `WHATSAPP_IMAGE_TEMPLATE_NAME`
- `WHATSAPP_TEMPLATE_LANGUAGE`

Os templates aprovados devem aceitar os parâmetros usados pela implementação: resumo (nome, telefone, localização, serviço, complementos e observações) e imagem (cabeçalho de imagem, categoria e posição). Confirme isto no Meta Business Manager; não são nomes nem textos inventados pelo código.

Registe `GET/POST https://<domínio>/webhooks/whatsapp` no Meta e valide o handshake. Mantenha `WHATSAPP_ENABLED=true` em produção. A aplicação recusa arrancar com configuração Meta incompleta.

## Railway

1. Crie um único serviço `solima`, uma réplica, sempre ligada e sem serverless.
2. Monte um Volume persistente em `/app/data`.
3. Defina `DATABASE_URL=file:/app/data/solima.db` e `STORAGE_ROOT=/app/data/pending-media`.
4. Defina `MEDIA_RETENTION_HOURS` e uma `PRIVACY_POLICY_VERSION` que corresponda ao texto final aprovado da política.
5. Mantenha `/health` como health check. A imagem assegura `/app/data/solima.db` e executa `prisma migrate deploy` no arranque, depois do Volume estar montado.
6. Verifique a cadeia real de proxy antes de alterar `TRUST_PROXY=false`. Faça um teste de rate limit com `X-Forwarded-For` forjado.

Recomenda-se uma janela de drenagem de 20–30 segundos em deploys para permitir que pedidos HTTP e chamadas à Meta terminem ou sejam recuperados pelo runner no próximo arranque.

## Backups, restauro e rollback

Faça backup diário e semanal do Volume e crie um backup manual antes de cada migração importante. Faça um ensaio de restauro: restaure uma cópia, inicie o serviço isolado e verifique um `LeadSubmission` conhecido e as respetivas linhas de entrega.

Rollback de código não faz rollback automático do esquema SQLite nem dos dados. Prefira migrações compatíveis; para um rollback que altere schema, restaure o backup validado em vez de apagar tabelas.

## Smoke test autorizado

Após deploy, envie um pedido de teste com uma fotografia não sensível e confirme: resposta `201`, linha de entrega, resumo, imagem, webhook assinado e limpeza do JPEG local. Não execute este passo sem autorização explícita, credenciais e templates aprovados.

## Domínio e privacidade

Confirme HTTPS/TLS, domínio público, política de privacidade final, período de conservação aprovado e contacto para direitos do titular. O valor de `PRIVACY_POLICY_VERSION` deve identificar exatamente essa política.
