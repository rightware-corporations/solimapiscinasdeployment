import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const htmlPath = path.join(root, "public", "index.html");
let html = await fs.readFile(htmlPath, "utf8");
let index = 0;
html = html.replace(/data:image\/jpeg;base64,([A-Za-z0-9+/=]+)/g, (_, data) => {
  index += 1;
  const name = `solima-embedded-${index}.jpg`;
  fs.writeFile(path.join(root, "public", "assets", name), Buffer.from(data, "base64"));
  return `/assets/${name}`;
});
await fs.writeFile(htmlPath, html);
console.log(`Extracted ${index} embedded JPEG assets.`);
