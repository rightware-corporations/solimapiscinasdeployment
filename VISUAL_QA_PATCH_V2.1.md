# SOLIMA V2.1 — Final Visual QA Patch

## Resultado

A passagem V2.1 foi aplicada sobre o projeto V2 existente, sem reconstruir a aplicação e sem remover o backend, Prisma, API, uploads, tickets, autenticação administrativa, segurança ou fluxo de pedidos.

As duas matrizes Playwright terminaram com **30/30 viewports aprovados**:

- movimento normal: 15/15;
- `prefers-reduced-motion: reduce`: 15/15;
- testes de backend: 4/4.

Os resultados consolidados estão em:

- `visual-report-v2.1/matrix-normal.json`;
- `visual-report-v2.1/matrix-reduced.json`;
- `visual-report-v2.1/matrix-summary.json`.

## Correções entregues

- Removido o reset destrutivo `button { all: unset }` e substituído por um reset explícito.
- Restaurada a grelha de Orçamento em duas colunas a partir de 1180 px.
- Corrigido o passo 3 do formulário: uploads, nota, observações, resumo, consentimento, ações e área de toque de 44 px.
- Corrigida uma colisão de especificidade que exibia o passo 3 mesmo com `hidden`.
- Corrigido o auto-scroll inicial indevido do formulário.
- Corrigida a secção Sobre e a colisão entre a legenda da imagem e o cartão “19+ anos”.
- Corrigido o hero em 844×390: título, navegação, CTAs completos, margem inferior segura e indicador “Mergulhe” oculto.
- Corrigido e centralizado o diálogo de sucesso em desktop e mobile.
- Adicionadas capturas específicas da zona de consentimento e dos detalhes de Contacto após o fecho do diálogo.
- Consolidado o CSS em ficheiros externos e removidas regras vazias, media queries duplicadas, comentários residuais e estilos inline.
- Mantida uma única implementação para formulário, loader, parallax e smooth scroll.

## QA visual executado

Viewports:

`320×568`, `360×800`, `390×844`, `430×932`, `844×390`, `768×1024`, `820×1180`, `1024×768`, `1180×820`, `1280×720`, `1366×768`, `1440×900`, `1536×864`, `1646×928`, `1920×1080`.

Os contextos móveis usam `isMobile`, `hasTouch`, user agent móvel e `deviceScaleFactor`; tablets usam toque e user agent de tablet. As capturas são screenshots reais do viewport depois do scroll, não screenshots integrais de locators altos.

As asserções cobrem:

- overflow horizontal;
- CTAs dentro do frame e com raios completos;
- margem inferior do CTA no landscape;
- título abaixo da navegação;
- indicador do hero e `cueGap: null` quando oculto;
- cursor customizado oculto em dispositivos de toque;
- legenda e cartão “19+” sem sobreposição;
- duas colunas no Orçamento desktop;
- consentimento e textos dentro do cartão;
- área do checkbox de 44×44 px, com tolerância subpixel de 0,1 px;
- modal centrado e fechado antes da secção Contacto;
- erros de consola.

## Capturas principais

Cada modo contém as pastas dos viewports obrigatórios em:

- `visual-report-v2.1/normal/`;
- `visual-report-v2.1/reduced/`.

Foram geradas capturas para hero, Sobre, Orçamento passo 1, passos 2 e 3, consentimento do passo 3, diálogo de sucesso, Contacto e detalhes de Contacto. Os viewports obrigatórios são 320×568, 390×844, 844×390, 1180×820, 1440×900 e 1920×1080.

## Auditoria estrutural

- `!important`: 0;
- `all: unset`: 0;
- regras CSS vazias: 0;
- comentários CSS residuais: 0;
- media queries duplicadas: 0;
- blocos `<style>` inline: 0;
- atributos `style` de layout: 0;
- scripts clássicos inline: 0.

O `public/index.html` carrega apenas:

- `css/tokens.css`;
- `css/site.css`;
- `css/responsive.css`;
- `js/assets.js`;
- `js/app.js`.

## Comandos de verificação

```powershell
npm install
npm run build:styles
npm test
npm run qa:normal
npm run qa:reduced
npm run qa:merge
```

Para produção, configurar as variáveis descritas em `.env.example`, executar as migrações Prisma e iniciar com `npm start`.
