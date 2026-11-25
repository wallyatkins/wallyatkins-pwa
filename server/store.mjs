import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export function openStore(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), {recursive:true,mode:0o700});
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, subject TEXT NOT NULL, profile TEXT NOT NULL, token TEXT NOT NULL, checked INTEGER NOT NULL, expires INTEGER NOT NULL, csrf TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth (id TEXT PRIMARY KEY, payload TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS turns (id TEXT PRIMARY KEY, conversation TEXT NOT NULL REFERENCES conversations(id), owner TEXT NOT NULL, request_id TEXT NOT NULL, input TEXT NOT NULL, run_id TEXT, status TEXT NOT NULL, output TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, UNIQUE(owner,request_id));
    CREATE INDEX IF NOT EXISTS turns_conversation ON turns(conversation,created);
    CREATE TABLE IF NOT EXISTS preferences (owner TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  return db;
}
