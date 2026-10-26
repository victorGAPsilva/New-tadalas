import { DatabaseSync } from 'node:sqlite';
export function documentsAt(file, bucket) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db
      .prepare('SELECT payload FROM documents WHERE bucket=?')
      .all(bucket)
      .map((row) => JSON.parse(row.payload));
  } finally {
    db.close();
  }
}
