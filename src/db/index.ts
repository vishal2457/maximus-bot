import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqlite: Database.Database | null = null;

export function getDb() {
  if (db) {
    return db;
  }

  const dbPath = process.env.DB_PATH
    ? path.resolve(process.cwd(), process.env.DB_PATH)
    : path.join(os.homedir(), "maximus-bot-data", "maximus.db");

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  sqlite = new Database(dbPath);
  db = drizzle(sqlite);

  return db;
}

export function getSqlite() {
  if (sqlite) {
    return sqlite;
  }
  getDb();
  return sqlite;
}
