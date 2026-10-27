import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
const run = promisify(execFile);

test('volume configurado preserva dados entre processos e recebe o backup consistente', async () => {
  const volume = await mkdtemp(join(tmpdir(), 'tadalas-volume-'));
  const env = {
    ...process.env,
    DATA_DIRECTORY: join(volume, 'database'),
    UPLOAD_DIRECTORY: join(volume, 'uploads'),
  };
  const script = `
    import { createApp } from './src/app.js';
    import { defaultUploadDirectory } from './src/services/storage.js';
    import { fileURLToPath } from 'node:url';
    import { resolve } from 'node:path';
    import { mkdir, writeFile, readFile } from 'node:fs/promises';
    const app=createApp(), store=app.locals.services.store;
    try {
      if (process.env.VOLUME_TEST_WRITE==='true') {
        store.put('volume-test','marker',{retained:true});
        await mkdir(defaultUploadDirectory,{recursive:true});
        await writeFile(new URL('marker.txt',defaultUploadDirectory),'retained');
      } else {
        if(!store.get('volume-test','marker')?.retained) throw new Error('Database was not retained');
        if(await readFile(new URL('marker.txt',defaultUploadDirectory),'utf8')!=='retained') throw new Error('Upload was not retained');
      }
      if(resolve(fileURLToPath(defaultUploadDirectory))!==resolve(process.env.UPLOAD_DIRECTORY)) throw new Error('Unexpected upload directory');
    } finally { store.close(); }
  `;
  try {
    await run(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...env, VOLUME_TEST_WRITE: 'true' },
    });
    await run(process.execPath, ['--input-type=module', '-e', script], { env });
    await run(process.execPath, ['scripts/backup-db.js'], { env });
    const folder = join(env.DATA_DIRECTORY, 'backups');
    const backups = (await readdir(folder)).filter((name) =>
      name.endsWith('.sqlite'),
    );
    assert.equal(backups.length, 1);
    const db = new DatabaseSync(join(folder, backups[0]), { readOnly: true });
    try {
      assert.equal(
        db.prepare('PRAGMA integrity_check').get().integrity_check,
        'ok',
      );
      const row = db
        .prepare(
          "SELECT payload FROM documents WHERE bucket='volume-test' AND id='marker'",
        )
        .get();
      assert.equal(JSON.parse(row.payload).retained, true);
    } finally {
      db.close();
    }
  } finally {
    await rm(volume, { recursive: true, force: true });
  }
});
