import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";
import * as schema from "./project.schema";

const DB_PATH =
  process.env.DB_PATH ||
  path.join(os.homedir(), "maximus-bot-data", "maximus.db");

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

  initializeSchema();

  return db;
}

function initializeSchema() {
  if (!sqlite) {
    throw new Error("Database not initialized");
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      folder TEXT NOT NULL,
      discord_category_id TEXT,
      development_channel_id TEXT,
      linear_issues_channel_id TEXT,
      linear_project_id TEXT,
      linear_project_name TEXT
    )
  `);
}
