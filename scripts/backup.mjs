import { DatabaseSync, backup } from "node:sqlite";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const directory = resolve("backups");
await mkdir(directory, { recursive: true });
const source = resolve(process.env.DB_PATH || "data/techcamp.sqlite");
const database = new DatabaseSync(source, { readOnly: true });
const target = resolve(
  directory,
  `techcamp-${new Date().toISOString().replaceAll(":", "-")}.sqlite`,
);
await backup(database, target);
database.close();
console.log(`Đã sao lưu SQLite nhất quán: ${target}`);
