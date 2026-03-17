import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";
import { logger } from "../shared/logger";

const MIGRATIONS_TABLE = "__drizzle_migrations";

function getDbPath(): string {
  return process.env.DB_PATH
    ? path.resolve(process.cwd(), process.env.DB_PATH)
    : path.join(os.homedir(), "maximus-bot-data", "maximus.db");
}

function getMigrationsFolder(): string {
  return path.join(__dirname, "..", "..", "drizzle");
}

function ensureMigrationsTable(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )
  `);
}

function getAppliedMigrations(sqlite: Database.Database): string[] {
  const stmt = sqlite.prepare(
    `SELECT hash FROM ${MIGRATIONS_TABLE} ORDER BY created_at`,
  );
  const rows = stmt.all() as { hash: string }[];
  return rows.map((row) => row.hash);
}

function markMigrationApplied(sqlite: Database.Database, hash: string): void {
  const stmt = sqlite.prepare(
    `INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES (?, ?)`,
  );
  stmt.run(hash, Date.now());
}

export async function runMigrations(): Promise<void> {
  const dbPath = getDbPath();
  const migrationsFolder = getMigrationsFolder();

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  ensureMigrationsTable(sqlite);

  const appliedMigrations = getAppliedMigrations(sqlite);

  const files = fs
    .readdirSync(migrationsFolder)
    .filter((f) => f.endsWith(".sql"));
  files.sort();

  for (const file of files) {
    const filePath = path.join(migrationsFolder, file);
    const sql = fs.readFileSync(filePath, "utf-8");
    const hash = sql.trim();

    if (!appliedMigrations.includes(hash)) {
      logger.info(`Running migration: ${file}`);

      try {
        sqlite.exec(sql);
        markMigrationApplied(sqlite, hash);
        logger.info(`Migration completed: ${file}`);
      } catch (error) {
        logger.error(`Migration failed: ${file}`, { error });
        sqlite.close();
        throw error;
      }
    }
  }

  sqlite.close();
  logger.info("All migrations completed");
}
