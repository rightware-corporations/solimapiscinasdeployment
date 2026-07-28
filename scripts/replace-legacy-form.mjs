import fs from "node:fs/promises";
const file = "public/index.html";
let html = await fs.readFile(file, "utf8");
const start = html.indexOf('    <div class="orcamento-form-card" data-reveal>');
const endMarker = "    </div>\r\n  </div>\r\n</section>\r\n\r\n<!-- ═══════════ CONTACTO ═══════════ -->";
let end = html.indexOf(endMarker, start);
let newline = "\r\n";
if (end < 0) {
  newline = "\n";
  end = html.indexOf(endMarker.replaceAll("\r\n", "\n"), start);
}
if (start < 0 || end < 0) throw new Error("Legacy form boundaries not found.");
const replacement = `    <div class="orcamento-form-card" data-reveal aria-live="polite">${newline}      <noscript>Active o JavaScript para enviar um pedido de orçamento.</noscript>${newline}    </div>${newline}`;
html = html.slice(0, start) + replacement + html.slice(end + (`    </div>${newline}`).length);
await fs.writeFile(file, html);
console.log("Legacy five-step form removed.");
