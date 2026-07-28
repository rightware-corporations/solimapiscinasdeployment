import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
const dbPath = process.argv[2] || path.join(process.cwd(), "prisma", "dev.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(fs.readFileSync(path.join(process.cwd(), "prisma", "migrations", "20260726170000_init", "migration.sql"), "utf8"));
db.close();
console.log(`Database initialized at ${dbPath}`);
