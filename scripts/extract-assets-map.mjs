import fs from "node:fs/promises";
import path from "node:path";
const source = await fs.readFile(path.resolve("..", "solima-production", "public", "index.html"), "utf8");
const scripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
const assets = scripts.find((match) => match[1].includes("window.SOLIMA_IMG = {"));
if (!assets) throw new Error("Asset map not found in backup.");
await fs.writeFile("public/js/assets.js", `${assets[1].trim()}\n`);
console.log(`Asset map extracted: ${assets[1].length} bytes.`);
