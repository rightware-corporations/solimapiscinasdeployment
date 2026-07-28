# SOLIMA — Auditoria visual V2

## Âmbito

Segunda passagem de refinamento sobre o projecto de produção existente. O backend Node/Express, Prisma, uploads, tickets, idempotência, outbox, painel administrativo e controlos de segurança foram preservados.

Referências analisadas:

- `visual-report/before/hero-before.png`;
- `visual-report/before/sobre-before.png`;
- implementação V1 de produção;
- 15 viewports reais em Chromium/Edge por Playwright.

## Diagnóstico inicial

### Hero

- O indicador “Mergulhe” estava posicionado sobre a zona dos CTAs em alturas reduzidas.
- O indicador de cenas ficava demasiado próximo da margem direita.
- O título não respeitava simultaneamente largura e altura útil; em 320 px a palavra “Transformamos” podia ser cortada.
- A cor da palavra dinâmica perdia contraste sobre alguns frames do vídeo.

### Sobre

- O cartão “19+ anos” estava deslocado para fora do media por offsets negativos.
- A composição imagem/copy não possuía uma regra única para desktop, tablet e mobile.
- Em mobile o cartão era empurrado para baixo da fotografia.

### Sistema geral

- CSS de produção inline concorria com `solima-refactor.css`.
- JavaScript inline concorria com `solima-refactor.js`.
- Existiam múltiplas camadas para loader, navegação, smooth scroll, parallax e formulário.
- Media queries e declarações de layout repetidas dificultavam a previsibilidade.
- Alguns `fieldset` do novo formulário herdavam aparência nativa.

## Critérios de aprovação

- sem overflow horizontal;
- nenhum componente crítico fora do seu frame;
- “Mergulhe” sem intersecção com os CTAs;
- cartão “19+” contido no media;
- indicador de cenas dentro do viewport;
- três passos do formulário presentes;
- zero erros de consola;
- zero estilos ou scripts inline;
- zero `!important`;
- funcionamento com pointer fino, touch e `prefers-reduced-motion`.

## Matriz executada

| Categoria | Viewports |
|---|---|
| Mobile portrait | 320×568, 360×800, 390×844, 430×932 |
| Mobile landscape | 844×390 |
| Tablet | 768×1024, 820×1180, 1024×768, 1180×820 |
| Desktop | 1280×720, 1366×768, 1440×900, 1536×864, 1646×928, 1920×1080 |

Resultado consolidado: **15/15 viewports aprovados, zero falhas**. Os valores completos estão em `visual-report/results-matrix.json`.

## Evidências

- 97 screenshots em `visual-report/matrix/`;
- comparações principais em `visual-report/before/` e `visual-report/after/`;
- estados do formulário em 390×844 e 1440×900;
- diálogo de sucesso capturado após submissão real à API.

