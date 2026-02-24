import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_DATABASE_URL = "file:./prisma/dev.db";

let cachedDb: DatabaseSync | null = null;

function resolveSqliteFilePath(databaseUrl: string): string {
  if (databaseUrl.startsWith("file://")) {
    return fileURLToPath(databaseUrl);
  }

  if (databaseUrl.startsWith("file:")) {
    const relativePath = databaseUrl.slice("file:".length);
    return path.resolve(process.cwd(), relativePath);
  }

  return path.resolve(process.cwd(), databaseUrl);
}

function ensureDirectoryForFile(filePath: string) {
  const directoryPath = path.dirname(filePath);
  mkdirSync(directoryPath, { recursive: true });
}

function initializeSchema(database: DatabaseSync) {
  database.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('review', 'generate')),
      pinned INTEGER NOT NULL DEFAULT 0,
      response_language TEXT NOT NULL CHECK (response_language IN ('ko', 'en')),
      review_code TEXT NOT NULL,
      review_language TEXT NOT NULL CHECK (review_language IN ('typescript', 'javascript', 'python', 'java', 'kotlin')),
      review_filename TEXT NOT NULL,
      review_files_json TEXT NOT NULL,
      generate_prompt TEXT NOT NULL,
      generate_language TEXT NOT NULL CHECK (generate_language IN ('typescript', 'javascript', 'python', 'java', 'kotlin')),
      generate_style TEXT NOT NULL CHECK (generate_style IN ('clean', 'fast', 'explain')),
      active_run_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('review', 'generate')),
      status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'cancelled')),
      result_json TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_threads_updated_at
      ON threads(updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_runs_thread_created_at
      ON runs(thread_id, created_at DESC);
  `);
}

export function getSqliteDb(): DatabaseSync {
  if (cachedDb) {
    return cachedDb;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
  const filePath = resolveSqliteFilePath(databaseUrl);
  ensureDirectoryForFile(filePath);

  const database = new DatabaseSync(filePath);
  initializeSchema(database);
  cachedDb = database;
  return database;
}
