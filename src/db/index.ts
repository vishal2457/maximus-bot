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

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      session_id TEXT,
      prompt TEXT NOT NULL,
      author_tag TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result TEXT,
      error TEXT,
      duration INTEGER,
      platform TEXT NOT NULL DEFAULT 'discord',
      platform_thread_id TEXT,
      sdk_type TEXT NOT NULL DEFAULT 'opencode',
      worker_id TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER
    )
  `);

  runMigrations();

  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`);
  sqlite.exec(
    `CREATE INDEX IF NOT EXISTS idx_jobs_thread_id ON jobs(thread_id)`,
  );
  sqlite.exec(
    `CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at)`,
  );
  sqlite.exec(
    `CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at)`,
  );
}

function runMigrations() {
  if (!sqlite) {
    throw new Error("Database not initialized");
  }

  const jobColumns = sqlite.prepare("PRAGMA table_info(jobs)").all() as {
    name: string;
  }[];
  const jobColumnNames = new Set(jobColumns.map((c) => c.name));

  if (!jobColumnNames.has("thread_id")) {
    sqlite.exec("ALTER TABLE jobs ADD COLUMN thread_id TEXT");
    sqlite.exec(
      "UPDATE jobs SET thread_id = message_id WHERE thread_id IS NULL AND message_id IS NOT NULL",
    );
  }

  if (!jobColumnNames.has("session_id")) {
    sqlite.exec("ALTER TABLE jobs ADD COLUMN session_id TEXT");
  }

  if (!jobColumnNames.has("platform_thread_id")) {
    sqlite.exec("ALTER TABLE jobs ADD COLUMN platform_thread_id TEXT");
  }

  if (!jobColumnNames.has("sdk_type")) {
    sqlite.exec(
      "ALTER TABLE jobs ADD COLUMN sdk_type TEXT NOT NULL DEFAULT 'opencode'",
    );
  }

  if (!jobColumnNames.has("worker_id")) {
    sqlite.exec("ALTER TABLE jobs ADD COLUMN worker_id TEXT");
  }

  if (!jobColumnNames.has("retry_count")) {
    sqlite.exec(
      "ALTER TABLE jobs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0",
    );
  }

  const projectColumns = sqlite
    .prepare("PRAGMA table_info(projects)")
    .all() as {
    name: string;
  }[];
  const projectColumnNames = new Set(projectColumns.map((c) => c.name));

  if (!projectColumnNames.has("discord_category_id")) {
    sqlite.exec("ALTER TABLE projects ADD COLUMN discord_category_id TEXT");
  }

  if (!projectColumnNames.has("development_channel_id")) {
    sqlite.exec("ALTER TABLE projects ADD COLUMN development_channel_id TEXT");
  }

  if (!projectColumnNames.has("linear_issues_channel_id")) {
    sqlite.exec(
      "ALTER TABLE projects ADD COLUMN linear_issues_channel_id TEXT",
    );
  }
}
