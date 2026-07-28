import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve("visual-report-v2.1");
const files = (await fs.readdir(root)).filter((name) => /^results-(normal|reduced)-\d+-\d+\.json$/.test(name));
const summary = {};

for (const motion of ["normal", "reduced"]) {
  const latest = new Map();
  const matching = [];
  for (const name of files.filter((value) => value.startsWith(`results-${motion}-`))) {
    matching.push({
      name,
      mtime: (await fs.stat(path.join(root, name))).mtimeMs,
      rows: JSON.parse(await fs.readFile(path.join(root, name), "utf8"))
    });
  }
  matching.sort((a, b) => a.mtime - b.mtime);
  for (const file of matching) for (const row of file.rows) latest.set(row.name, row);
  const rows = [...latest.values()].sort((a, b) => a.width - b.width || a.height - b.height);
  await fs.writeFile(path.join(root, `matrix-${motion}.json`), `${JSON.stringify(rows, null, 2)}\n`);
  const failures = rows.filter((row) =>
    row.horizontalOverflow > 1 ||
    row.cueOverlapsCtas ||
    !row.ctaBottomSafe ||
    !row.titleClearsNav ||
    !row.touchCursorHidden ||
    row.metadataOverlapsStat ||
    !row.actionInsideCard ||
    !row.actionRoundedBothSides ||
    !row.desktopTwoColumns ||
    !row.consentInsideCard ||
    !row.consentTouchTarget ||
    !row.textClearsCardEdges ||
    !row.submitInsideCard ||
    !row.submitRoundedBothSides ||
    row.dialogCentered === false ||
    !row.modalClosedBeforeContact ||
    row.consoleErrors.length
  );
  summary[motion] = { viewports: rows.length, failures };
}

await fs.writeFile(path.join(root, "matrix-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
process.exit(Object.values(summary).some((value) => value.viewports !== 15 || value.failures.length) ? 1 : 0);
