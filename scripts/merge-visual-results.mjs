import fs from "node:fs/promises";
import path from "node:path";

const reportDir = path.resolve("visual-report");
const names = (await fs.readdir(reportDir))
  .filter((name) => /^results-matrix(?:-.+)?\.json$/.test(name) && name !== "results-matrix.json");
const files = await Promise.all(names.map(async (name) => ({
  name,
  mtime: (await fs.stat(path.join(reportDir, name))).mtimeMs,
  rows: JSON.parse(await fs.readFile(path.join(reportDir, name), "utf8"))
})));
files.sort((a, b) => a.mtime - b.mtime);

const latest = new Map();
for (const file of files) {
  for (const row of file.rows) latest.set(row.name, row);
}
const results = [...latest.values()].sort((a, b) => a.width - b.width || a.height - b.height);
await fs.writeFile(path.join(reportDir, "results-matrix.json"), `${JSON.stringify(results, null, 2)}\n`);

const failures = results.filter((row) =>
  row.horizontalOverflow > 1 ||
  row.cueOverlapsCtas ||
  !row.statInsideMedia ||
  !row.sceneInsideViewport ||
  row.formSteps !== 3 ||
  row.consoleErrors.length
);
console.log(JSON.stringify({ sourceFiles: files.length, viewports: results.length, failures }, null, 2));
process.exit(failures.length || results.length !== 15 ? 1 : 0);
