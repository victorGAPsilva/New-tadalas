import { readFile, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
export const defaultDataDirectory = new URL('../../var/', import.meta.url);
export async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}
export async function atomicJson(file, data) {
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(data, null, 2) + '\n', {
      mode: 0o600,
    });
    await rename(temp, file);
  } finally {
    await unlink(temp).catch(() => {});
  }
}
export function productRepository(directory, seed) {
  const file = join(directory, 'products.json');
  let pending = Promise.resolve();
  async function list() {
    return readJson(file, await seed());
  }
  return {
    list,
    mutate(operation) {
      const task = pending.then(async () => {
        const products = await list();
        const result = operation(products);
        await atomicJson(file, products);
        return result;
      });
      pending = task.catch(() => {});
      return task;
    },
  };
}
