import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, "../../votes.db");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS votes (
        vote_key   TEXT NOT NULL,
        asset_code TEXT NOT NULL,
        issuer     TEXT NOT NULL,
        target     TEXT NOT NULL,
        admin_key  TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (vote_key, admin_key)
      );
    `);
  }
  return db;
}

export interface VoteRow {
  assetCode: string;
  issuer: string;
  target: string;
  voters: string[];
}

export function recordVote(assetCode: string, issuer: string, target: string, adminKey: string): number {
  const db = getDb();
  const key = `${assetCode}:${issuer}:${target}`;
  db.prepare(
    `INSERT OR IGNORE INTO votes (vote_key, asset_code, issuer, target, admin_key) VALUES (?,?,?,?,?)`
  ).run(key, assetCode, issuer, target, adminKey);
  const row = db.prepare(`SELECT COUNT(*) as cnt FROM votes WHERE vote_key = ?`).get(key) as { cnt: number };
  return row.cnt;
}

export function getVotes(assetCode: string, issuer: string, target: string): VoteRow | null {
  const db = getDb();
  const key = `${assetCode}:${issuer}:${target}`;
  const rows = db.prepare(`SELECT admin_key FROM votes WHERE vote_key = ?`).all(key) as { admin_key: string }[];
  if (!rows.length) return null;
  return { assetCode, issuer, target, voters: rows.map((r) => r.admin_key) };
}

export function clearVotes(assetCode: string, issuer: string, target: string): void {
  const key = `${assetCode}:${issuer}:${target}`;
  getDb().prepare(`DELETE FROM votes WHERE vote_key = ?`).run(key);
}

export function listProposals(): VoteRow[] {
  const db = getDb();
  const keys = db.prepare(`SELECT DISTINCT vote_key, asset_code, issuer, target FROM votes`).all() as {
    vote_key: string; asset_code: string; issuer: string; target: string;
  }[];
  return keys.map((k) => {
    const voters = (db.prepare(`SELECT admin_key FROM votes WHERE vote_key = ?`).all(k.vote_key) as { admin_key: string }[]).map((r) => r.admin_key);
    return { assetCode: k.asset_code, issuer: k.issuer, target: k.target, voters };
  });
}
