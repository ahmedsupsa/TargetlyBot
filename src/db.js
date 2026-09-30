import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

export function createStore(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    city TEXT DEFAULT '',
    category TEXT DEFAULT '',
    url TEXT DEFAULT '',
    tags TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`);
  return {
    add(target) {
      const stmt = db.prepare('INSERT INTO targets (name,city,category,url,tags,notes,status) VALUES (@name,@city,@category,@url,@tags,@notes,@status)');
      const result = stmt.run({ status:'new', city:'', category:'', url:'', tags:'', notes:'', ...target });
      return db.prepare('SELECT * FROM targets WHERE id=?').get(result.lastInsertRowid);
    },
    search(query) {
      const q = `%${query}%`;
      return db.prepare('SELECT * FROM targets WHERE name LIKE ? OR city LIKE ? OR category LIKE ? OR tags LIKE ? OR notes LIKE ? ORDER BY updated_at DESC LIMIT 20').all(q,q,q,q,q);
    },
    list(limit=20) { return db.prepare('SELECT * FROM targets ORDER BY id DESC LIMIT ?').all(limit); },
    stats() { return db.prepare('SELECT COUNT(*) AS total FROM targets').get(); }
  };
}
