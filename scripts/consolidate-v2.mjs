import fs from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const htmlPath = path.join(publicDir, "index.html");
const sourceHtmlPath = path.join(rootDir, "solima-spa.backup.html");
let html = await fs.readFile(sourceHtmlPath, "utf8");

const inlineStyles = [...html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
const refactorCss = await fs.readFile(path.join(rootDir, "..", "solima-production", "public", "solima-refactor.css"), "utf8");
const v2Css = await fs.readFile(path.join(rootDir, "scripts", "v2-source.css"), "utf8");
const baseAst = postcss.parse([...inlineStyles, refactorCss].join("\n\n"));
baseAst.walkRules((rule) => {
  if (rule.selector.trim() !== "button") return;
  rule.walkDecls("all", (decl) => decl.remove());
});
const replacedLayout = new Map([
  [".hero-content", new Set(["width", "margin", "margin-inline", "padding", "display", "justify-items", "align-content", "text-align"])],
  [".hero-title", new Set(["max-width", "max-inline-size", "margin", "margin-inline", "text-align"])],
  [".hero-sub", new Set(["max-width", "max-inline-size", "margin-inline", "text-align"])],
  [".hero-ctas", new Set(["justify-content"])],
  [".hero-scroll-cue", new Set(["position", "left", "right", "bottom", "transform", "display", "justify-items", "gap", "z-index"])],
  [".hero-scene-indicator", new Set(["right", "top", "transform", "display", "min-width"])],
  [".sobre-grid", new Set(["grid-template-columns", "gap", "align-items"])],
  [".sobre-image-wrap", new Set(["aspect-ratio", "overflow"])],
  [".sobre-stat-card", new Set(["position", "right", "bottom", "left", "inset", "width", "max-width", "max-inline-size", "margin"])],
  [".sobre-stats", new Set(["width", "max-width", "margin", "margin-inline", "gap", "justify-content", "grid-template-columns"])],
  [".sobre-stat", new Set(["text-align", "padding", "border-left", "border-top"])],
  [".servicos-header", new Set(["grid-template-columns", "gap", "margin-bottom"])],
  [".projetos-intro", new Set(["min-height", "padding", "padding-block"])],
  [".visao-cols", new Set(["padding-left", "text-align", "grid-template-columns", "gap", "max-width"])],
  [".orcamento-grid", new Set(["grid-template-columns", "gap", "align-items"])]
]);
baseAst.walkRules((rule) => {
  const props = replacedLayout.get(rule.selector.trim());
  if (!props) return;
  rule.walkDecls((decl) => { if (props.has(decl.prop)) decl.remove(); });
});
const ast = postcss.parse(`${baseAst.toString()}\n\n${v2Css}`);

const legacySelector = /(?:^|[\s,])(?:\.loader-cta|\.input-float|\.choice(?:\b|:)|\.upload-box|\.upload-list)(?:\b|[\s.:#>+~[])/;
ast.walkRules((rule) => {
  if (legacySelector.test(rule.selector) && !rule.selector.includes(".choice-card") && !rule.selector.includes(".choice-grid") && !rule.selector.includes(".choice-check") && !rule.selector.includes(".choice-copy")) {
    rule.remove();
  }
});
ast.walkDecls((decl) => { decl.important = false; });

function mergeMedia(container) {
  const media = new Map();
  for (const node of [...container.nodes]) {
    if (node.type !== "atrule" || node.name !== "media") continue;
    const key = node.params.replace(/\s+/g, "").trim();
    if (!media.has(key)) media.set(key, node);
    else {
      media.get(key).append(...node.nodes.map((child) => child.clone()));
      node.remove();
    }
  }
}
mergeMedia(ast);

function dedupeRules(container) {
  const seen = new Map();
  for (const node of [...container.nodes]) {
    if (node.type === "atrule" && node.nodes) dedupeRules(node);
    if (node.type !== "rule") continue;
    const key = node.selector.trim();
    if (seen.has(key)) {
      const earlier = seen.get(key);
      node.prepend(...earlier.nodes.map((child) => child.clone()));
      earlier.remove();
    }
    seen.set(key, node);
  }
  for (const rule of seen.values()) {
    const props = new Map();
    for (const child of [...rule.nodes]) {
      if (child.type !== "decl") continue;
      if (props.has(child.prop)) props.get(child.prop).remove();
      props.set(child.prop, child);
    }
  }
}
dedupeRules(ast);
ast.walkComments((comment) => comment.remove());
ast.walkRules((rule) => {
  if (!rule.nodes?.some((node) => node.type === "decl" || node.type === "atrule")) rule.remove();
});
ast.walkAtRules("media", (media) => {
  if (!media.nodes?.some((node) => node.type === "rule" || node.type === "atrule")) media.remove();
});

const tokens = postcss.root();
const site = postcss.root();
const responsive = postcss.root();
for (const node of [...ast.nodes]) {
  if (node.type === "rule" && node.selector.trim() === ":root") tokens.append(node.clone());
  else if (node.type === "atrule" && node.name === "media") responsive.append(node.clone());
  else site.append(node.clone());
}

await fs.mkdir(path.join(publicDir, "css"), { recursive: true });
await fs.writeFile(path.join(publicDir, "css", "tokens.css"), tokens.toString());
await fs.writeFile(path.join(publicDir, "css", "site.css"), site.toString());
await fs.writeFile(path.join(publicDir, "css", "responsive.css"), responsive.toString());

const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
const assetsScript = inlineScripts.find((m) => m[1].includes("window.SOLIMA_IMG = {"));
if (!assetsScript) throw new Error("Embedded asset map not found.");
await fs.mkdir(path.join(publicDir, "js"), { recursive: true });
await fs.writeFile(path.join(publicDir, "js", "assets.js"), `${assetsScript[1].trim()}\n`);

html = html.replace(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>\s*/gi, "");
html = html.replace(/<link rel="stylesheet" href="\/solima-refactor\.css">\s*/gi, "");
html = html.replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/gsap[^>]+><\/script>\s*/gi, "");
html = html.replace(/<script>([\s\S]*?)<\/script>\s*/gi, "");
html = html.replace(/<script src="\/solima-refactor\.js" defer><\/script>\s*/gi, "");
html = html.replace(/<!-- Libraries via CDN:[\s\S]*?-->/, "<!-- Runtime libraries: Lenis + Lucide -->");
html = html.replace(/<!--([\s\S]*?)-->/g, (comment, body) => body.includes("JAVASCRIPT") ? "<!-- Production JavaScript modules -->" : comment);
html = html.replace("<!-- Portfolio image data URIs -->", "");
html = html.replace("</head>", '<link rel="stylesheet" href="/css/tokens.css">\n<link rel="stylesheet" href="/css/site.css">\n<link rel="stylesheet" href="/css/responsive.css">\n</head>');
html = html.replace(
  '<meta name="theme-color" content="#020617" />',
  '<meta name="theme-color" content="#020617" />\n<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 64 64\'%3E%3Crect width=\'64\' height=\'64\' rx=\'12\' fill=\'%23020617\'/%3E%3Cpath d=\'M12 18h10v10H12zm15 0h10v10H27zm15 0h10v10H42zM20 33h10v10H20zm15 0h10v10H35zM27 48h10v10H27z\' fill=\'%2322d3ee\'/%3E%3C/svg%3E" />'
);
html = html.replace("</body>", '<script src="/js/assets.js"></script>\n<script type="module" src="/js/app.js"></script>\n</body>');

html = html.replace(/\sstyle="[^"]*"/gi, "");
html = html.replace(/\sdata-parallax="-60"/g, "");
html = html.replace(
  '<div data-reveal-parent>\n      <div class="sobre-image-wrap">',
  '<div class="sobre-media" data-reveal-parent>\n      <div class="sobre-image-wrap">'
);
html = html.replace(
  '<img data-img-key="1" alt="Piscina premium SOLIMA" />',
  '<img class="parallax-media" data-parallax-strength="-60" data-img-key="1" alt="Piscina premium SOLIMA" />'
);
html = html.replace(
  '    <div data-reveal-parent>\n      <div class="eyebrow" data-reveal>Quem Somos</div>',
  '    <div class="sobre-copy-column" data-reveal-parent>\n      <div class="eyebrow" data-reveal>Quem Somos</div>'
);
html = html.replace(
  '<div class="container orcamento-grid">\n    <div data-reveal-parent>',
  '<div class="container orcamento-grid">\n    <div class="orcamento-copy-column" data-reveal-parent>'
);
html = html.replace(/\s*<button class="loader-cta" id="loaderEnter">[\s\S]*?<\/button>/, "");
html = html.replace('data-state="loading"', 'aria-hidden="true"');
html = html.replace('class="hero-title-morph-word is-active" data-scene="day"', 'class="hero-title-morph-word is-active scene-day" data-scene="day"');
html = html.replace('class="hero-title-morph-word"          data-scene="twilight"', 'class="hero-title-morph-word scene-twilight" data-scene="twilight"');
html = html.replace('class="hero-title-morph-word"          data-scene="detail"', 'class="hero-title-morph-word scene-detail" data-scene="detail"');
html = html.replaceAll('class="visao-title" ', 'class="visao-title" ');

await fs.writeFile(htmlPath, html);
console.log(JSON.stringify({
  inlineStyleBlocksRemoved: inlineStyles.length,
  inlineScriptsRemoved: inlineScripts.length,
  importantRemaining: (tokens.toString() + site.toString() + responsive.toString()).match(/!important/g)?.length || 0,
  cssFiles: ["tokens.css", "site.css", "responsive.css"]
}, null, 2));
