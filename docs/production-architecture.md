# Arquitetura de produção

## Fluxo

`Browser → POST /api/leads → staging JPEG → SQLite transaction → WhatsAppDelivery queue → Cloud API`.

`POST /api/leads` exige `Idempotency-Key` UUID e `multipart/form-data`. A API valida e normaliza os campos, calcula um fingerprint determinístico (incluindo hashes SHA-256 dos ficheiros originais), processa imagens em série e grava numa única transação o `LeadSubmission`, complementos, média e entregas. Só então devolve `201`; uma repetição com o mesmo fingerprint devolve `200`. Uma mesma chave com conteúdo diferente devolve `409`.

Não existe sucesso condicionado à disponibilidade imediata da Meta. Uma falha temporária do fornecedor deixa uma entrega `RETRY` durável e o visitante continua a ver “Pedido recebido”.

## Modelo de dados

```text
LeadSubmission 1──N LeadSubmissionExtra
LeadSubmission 1──N LeadMedia
LeadSubmission 1──N WhatsAppDelivery
LeadMedia       0──1 WhatsAppDelivery
```

`WhatsAppDelivery` é a outbox persistente. A sequência `0` é o resumo e cada fotografia recebe uma sequência posterior, preservando a ordem. Estados de entrega: `PENDING`, `PROCESSING`, `RETRY`, `ACCEPTED`, `SENT`, `DELIVERED`, `READ`, `FAILED`. O agregado do pedido é `RECEIVED`, `DELIVERING`, `ACCEPTED`, `PARTIAL` ou `FAILED`.

## Média e retenção

Os uploads brutos vivem temporariamente em `/tmp`, nunca são estado de negócio e são removidos ao terminar o pedido. Apenas JPEGs processados, sem metadados incorporados, são guardados no `STORAGE_ROOT`. Cada imagem é validada por assinatura, limitada a 5 MB e 40 milhões de píxeis, auto-rodada e redimensionada.

Depois de a Meta aceitar uma mensagem de imagem, a aplicação grava `ACCEPTED` e o ID da mensagem antes de eliminar o JPEG local. Nenhum ficheiro requerido por uma entrega `PENDING`, `PROCESSING` ou `RETRY` é removido. A limpeza retenta eliminações pendentes e média de entregas `FAILED` depois de `MEDIA_RETENTION_HOURS`.

## Entregas e falhas

O runner é acionado logo após o commit e faz uma varredura de recuperação a cada poucos minutos. Não há worker separado, Redis ou fila em memória. O retry é limitado e usa atrasos explícitos: imediato, 30 s, 2 min, 10 min, 30 min e 2 h. Uma falha terminal bloqueia sequências posteriores para preservar ordem; a equipa deve resolver a entrega falhada.

O sistema fornece idempotência interna forte e entrega externa robusta pelo menos uma vez. Não afirma exatamente-uma-vez na Meta: uma falha entre a aceitação remota e a persistência local pode, em teoria, produzir uma duplicação no retry.

## HTTP e segurança

Superfície pública: `GET /`, `GET /privacy.html`, `POST /api/leads`, `GET/POST /webhooks/whatsapp` e `GET /health`. A aplicação não monta admin, tickets nem rota pública de estado.

O webhook POST conserva bytes brutos, valida `X-Hub-Signature-256` por HMAC-SHA256 com comparação timing-safe e aplica estados de forma monotónica. Helmet, CSP, IDs de pedido, limites de upload, erros sem detalhes internos e conteúdo estático separado do Volume protegem as fronteiras. CORS não é usado: a aplicação é same-origin. `TRUST_PROXY` permanece `false` até a cadeia Railway/edge ser verificada, evitando que `X-Forwarded-For` forjado altere o rate limit.

## Topologia

Uma única instância Railway, sempre ligada, com um Volume em `/app/data`. SQLite e média pendente residem nesse Volume; `/tmp` só recebe uploads transitórios. O health check valida SQLite e acesso ao armazenamento, sem chamar a Meta. Os assets não versionados usam `no-cache` para não servir JavaScript/CSS antigos.
