import { DatabaseSync, backup } from 'node:sqlite';
import {
  mkdirSync,
  existsSync,
  readFileSync,
  copyFileSync,
  chmodSync,
} from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const source = new URL('../data/', import.meta.url);
const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
export function openStore(directory) {
  mkdirSync(directory, { recursive: true });
  const file = join(directory, 'tadalas.sqlite');
  const db = new DatabaseSync(file, { timeout: 5000 });
  chmodSync(file, 0o600);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS documents (bucket TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(bucket,id));
    CREATE UNIQUE INDEX IF NOT EXISTS customer_email ON documents(json_extract(payload,'$.email')) WHERE bucket='customers';
    CREATE TABLE IF NOT EXISTS orders (seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,customer_id TEXT,status TEXT NOT NULL,version INTEGER NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)),created_at TEXT NOT NULL,idempotency_key TEXT NOT NULL UNIQUE,request_hash TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS order_owner ON orders(customer_id,seq DESC);
    CREATE TABLE IF NOT EXISTS tokens (digest TEXT PRIMARY KEY,purpose TEXT NOT NULL,customer_id TEXT NOT NULL,expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY,scope TEXT NOT NULL,payload TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS mail_jobs (id TEXT PRIMARY KEY,payload TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL);`);
  const getStatement = db.prepare(
    'SELECT payload FROM documents WHERE bucket=? AND id=?',
  );
  const putStatement = db.prepare(
    'INSERT INTO documents(bucket,id,payload) VALUES(?,?,?) ON CONFLICT(bucket,id) DO UPDATE SET payload=excluded.payload',
  );
  const store = {
    db,
    directory,
    get(bucket, id) {
      const row = getStatement.get(bucket, id);
      return row ? JSON.parse(row.payload) : null;
    },
    list(bucket) {
      return db
        .prepare('SELECT payload FROM documents WHERE bucket=? ORDER BY rowid')
        .all(bucket)
        .map((row) => JSON.parse(row.payload));
    },
    put(bucket, id, value) {
      putStatement.run(bucket, id, JSON.stringify(value));
      return value;
    },
    remove(bucket, id) {
      return db
        .prepare('DELETE FROM documents WHERE bucket=? AND id=?')
        .run(bucket, id);
    },
    replace(bucket, values) {
      db.prepare('DELETE FROM documents WHERE bucket=?').run(bucket);
      for (const value of values) store.put(bucket, value.id, value);
    },
    transaction(action) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = action();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    backup(path) {
      return backup(db, path);
    },
    close() {
      if (db.isOpen) db.close();
    },
    sessions(scope) {
      return {
        get size() {
          return Number(
            db
              .prepare('SELECT count(*) total FROM sessions WHERE scope=?')
              .get(scope).total,
          );
        },
        get(id) {
          const row = db
            .prepare('SELECT payload FROM sessions WHERE id=? AND scope=?')
            .get(id, scope);
          return row ? JSON.parse(row.payload) : undefined;
        },
        set(id, value) {
          db.prepare('INSERT OR REPLACE INTO sessions VALUES(?,?,?,?)').run(
            id,
            scope,
            JSON.stringify(value),
            value.expires,
          );
        },
        delete(id) {
          db.prepare('DELETE FROM sessions WHERE id=? AND scope=?').run(
            id,
            scope,
          );
        },
        sweep(now) {
          db.prepare('DELETE FROM sessions WHERE expires<=?').run(now);
        },
      };
    },
  };
  if (
    !db.prepare("SELECT value FROM metadata WHERE key='legacy-import-v1'").get()
  ) {
    const legacyFiles = ['products.json', 'customers.json', 'admin.json'];
    const present = legacyFiles.filter((name) =>
      existsSync(join(directory, name)),
    );
    if (present.length) {
      const folder = join(
        directory,
        'backups',
        `legacy-${Date.now()}-${randomUUID().slice(0, 8)}`,
      );
      mkdirSync(folder, { recursive: true });
      for (const name of present)
        copyFileSync(join(directory, name), join(folder, name));
    }
    store.transaction(() => {
      for (const bucket of ['products', 'customers']) {
        const path = join(directory, `${bucket}.json`);
        const items = existsSync(path)
          ? json(path)
          : bucket === 'products'
            ? json(new URL('products.json', source))
            : [];
        if (!Array.isArray(items))
          throw new Error(`Arquivo legado inválido: ${bucket}.json`);
        for (const item of items) store.put(bucket, item.id, item);
      }
      if (existsSync(join(directory, 'admin.json')))
        store.put('admin', 'owner', json(join(directory, 'admin.json')));
      store.replace('categories', json(new URL('categories.json', source)));
      store.put('settings', 'public', {
        ...json(new URL('config.json', source)),
        version: 1,
        storeMode: 'manual',
        manualOpen: true,
        timezone: 'America/Sao_Paulo',
        schedule: [],
        pickupEnabled: true,
        deliveryEnabled: false,
        deliveryZones: [],
        paymentMethods: ['pix', 'cash', 'card'],
        estimatedMinutes: null,
      });
      db.prepare("INSERT INTO metadata VALUES('legacy-import-v1',?)").run(
        new Date().toISOString(),
      );
    });
  }
  return store;
}
