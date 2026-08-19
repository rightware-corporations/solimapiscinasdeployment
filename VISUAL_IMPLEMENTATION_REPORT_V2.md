# SOLIMA — Relatório de implementação visual V2

> Histórico: este relatório antecede a arquitetura de leads e pode mencionar administração, tickets ou WhatsApp legado. Consulte `README.md` e `docs/` para o estado atual.

## Resultado

A landing page foi refinada sem reconstrução e sem remoção de funcionalidades de produção.

### Hero

- composição centralizada e dimensionada por largura e altura útil;
- palavra dinâmica com contraste reforçado no mobile;
- CTAs centrados e empilhados no mobile;
- “Mergulhe” centralizado, em fluxo no portrait e oculto apenas em landscape abaixo de 500 px de altura;
- indicador de cenas completo em desktop largo, compacto entre 1180–1439 px e removido quando não há espaço seguro;
- parallax limitado, aplicado apenas ao media e desactivado com reduced motion.

### Sobre

- grid desktop equilibrado;
- copy, eyebrow e estatísticas centralizadas;
- bloco de leitura limitado a uma largura confortável;
- cartão “19+” ancorado dentro da fotografia em todos os breakpoints;
- sem offsets negativos.

### Secções comerciais e formulário

- títulos, subtítulos, introduções, cartões e CTAs centralizados;
- labels, campos, conteúdo digitado, listas técnicas e resumos mantidos à esquerda;
- `fieldset` normalizado;
- botões limitados ao cartão em mobile;
- touch, foco visível e reduced motion preservados;
- submissão real continua a gerar ticket e diálogo de sucesso.

## Consolidação do código

Arquivos finais:

- `public/css/tokens.css`;
- `public/css/site.css`;
- `public/css/responsive.css`;
- `public/js/app.js`;
- `public/js/navigation.js`;
- `public/js/motion.js`;
- `public/js/quote-form.js`;
- `public/js/assets.js`.

Removido/substituído:

- 2 blocos `<style>` de produção em `index.html`;
- 2 blocos `<script>` inline;
- todos os atributos `style` usados para layout;
- `public/solima-refactor.css`;
- `public/solima-refactor.js`;
- carregamento antigo de GSAP;
- botão manual do loader;
- implementações antigas e concorrentes do formulário, loader, parallax e smooth scroll;
- event listeners pertencentes ao DOM antigo.

Estado final:

- `!important`: 0;
- estilos inline: 0;
- scripts inline: 0;
- referências a `solima-refactor.*`: 0;
- implementação de Lenis: 1;
- loop RAF do smooth scroll: 1;
- loader: 1;
- formulário: 1;
- parallax: 1.

## Verificação

Comandos executados:

```bash
npm run build:styles
npm test
npm run qa:smoke
node scripts/visual-qa.mjs --offset=0 --limit=2
node scripts/merge-visual-results.mjs
```

Resultados:

- compilação/consolidação: aprovada;
- verificações de sintaxe Node/JavaScript: aprovadas;
- backend e segurança: 4/4 testes aprovados;
- smoke visual: aprovado;
- matriz visual: 15/15 viewports, zero falhas;
- console do browser: zero erros.

## Operação

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm start
```

Abra `http://localhost:3000`. O projecto mantém `/health`, `/privacy.html` e `/admin/login`.

