import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { mkdir, chmod } from 'node:fs/promises';
import { openStore } from '../src/services/database.js';
import { defaultDataDirectory } from '../src/services/storage.js';
const directory = fileURLToPath(defaultDataDirectory),
  store = openStore(directory);
try {
  const folder = join(directory, 'backups');
  await mkdir(folder, { recursive: true });
  const target = join(
    folder,
    `tadalas-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`,
  );
  await store.backup(target);
  await chmod(target, 0o600);
  console.log(`Backup consistente criado em ${target}`);
} finally {
  store.close();
}
