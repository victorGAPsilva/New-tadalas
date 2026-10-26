import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { atomicJson } from '../src/services/storage.js';
import { hashPassword } from '../src/services/auth.js';
import { documentsAt } from './database-inspect.js';
const password = 'Only-for-automated-tests-4829!';
const fixture = {
  name: 'Produto de teste',
  description: 'Fixture isolada; não é produto real.',
  priceCents: 2990,
  category: 'hamburgueres',
  available: true,
  featured: true,
  ingredients: ['Teste'],
  image: null,
  notes: '',
};
async function withAdmin(run, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'tadalas-admin-'));
  await atomicJson(join(directory, 'admin.json'), {
    username: 'test-admin',
    ...(await hashPassword(password)),
  });
  let time = Date.now();
  const server = createApp({
    dataDirectory: directory,
    uploadDirectory: pathToFileURL(join(directory, 'uploads') + '/'),
    now: () => time,
    ...options,
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie, csrf;
  const send = async (path, { method = 'GET', body, headers = {}, raw } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(method !== 'GET'
          ? {
              'Content-Type': 'application/json',
              ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
            }
          : {}),
        ...headers,
      },
      ...(method !== 'GET' ? { body: raw || JSON.stringify(body || {}) } : {}),
    });
  async function login() {
    const response = await send('/api/admin/login', {
      method: 'POST',
      body: { username: 'test-admin', password },
    });
    cookie = response.headers.get('set-cookie')?.split(';')[0];
    csrf = (await response.json()).data?.csrfToken;
    return response;
  }
  try {
    await run({
      send,
      login,
      directory,
      expire: () => {
        time += 9 * 60 * 60 * 1000;
      },
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}
test('autenticação, proteção CSRF, expiração e logout', async () =>
  withAdmin(async ({ send, login, expire }) => {
    assert.equal((await send('/api/admin/products')).status, 401);
    assert.equal(
      (await send('/api/admin/products', { method: 'POST', body: fixture }))
        .status,
      401,
    );
    assert.equal(
      (
        await send('/api/admin/login', {
          method: 'POST',
          body: { username: 'test-admin', password: 'incorrect' },
        })
      ).status,
      401,
    );
    const response = await login();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /HttpOnly/);
    assert.match(response.headers.get('set-cookie'), /SameSite=Strict/);
    assert.equal((await send('/api/admin/session')).status, 200);
    assert.equal(
      (
        await send('/api/admin/products', {
          method: 'POST',
          body: fixture,
          headers: { 'X-CSRF-Token': 'invalid' },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await send('/api/admin/products', {
          method: 'POST',
          body: fixture,
          headers: { Origin: 'https://evil.example' },
        })
      ).status,
      403,
    );
    assert.equal(
      (await send('/api/admin/logout', { method: 'POST' })).status,
      200,
    );
    assert.equal((await send('/api/admin/session')).status, 401);
    await login();
    expire();
    assert.equal((await send('/api/admin/session')).status, 401);
  }));
test('CRUD persiste catálogo, impede conflito e integra disponibilidade com pedidos', async () =>
  withAdmin(async ({ send, login, directory }) => {
    await login();
    const response = await send('/api/admin/products', {
      method: 'POST',
      body: fixture,
    });
    assert.equal(response.status, 201);
    const product = (await response.json()).data;
    assert.equal(product.version, 1);
    assert.ok(
      documentsAt(join(directory, 'tadalas.sqlite'), 'products').some(
        (p) => p.id === product.id,
      ),
    );
    assert.ok(
      (await (await send('/api/products')).json()).data.some(
        (p) => p.id === product.id,
      ),
    );
    let order = await send('/api/orders/validate', {
      method: 'POST',
      body: { items: [{ id: product.id, quantity: 2, priceCents: 1 }] },
    });
    assert.equal((await order.json()).data.subtotalCents, 5980);
    const changed = { ...product, priceCents: 3500, available: false };
    assert.equal(
      (
        await send(`/api/admin/products/${product.id}`, {
          method: 'PUT',
          body: changed,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await send(`/api/admin/products/${product.id}`, {
          method: 'PUT',
          body: changed,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await send('/api/orders/validate', {
          method: 'POST',
          body: { items: [{ id: product.id, quantity: 1 }] },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await send(`/api/admin/products/${product.id}`, {
          method: 'DELETE',
          body: { version: 1 },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await send(`/api/admin/products/${product.id}`, {
          method: 'DELETE',
          body: { version: 2 },
        })
      ).status,
      200,
    );
    assert.equal((await send(`/api/products/${product.id}`)).status, 404);
    for (const body of [
      { ...fixture, priceCents: -1 },
      { ...fixture, category: 'unknown' },
      { ...fixture, image: '/assets/../private.png' },
      { ...fixture, image: 'https://evil.example/script.svg' },
      { ...fixture, name: '' },
    ])
      assert.equal(
        (await send('/api/admin/products', { method: 'POST', body })).status,
        400,
      );
  }));
test('upload autenticado rejeita arquivos inseguros e login tem limite de tentativas', async () =>
  withAdmin(async ({ send, login, directory }) => {
    await login();
    assert.equal(
      (
        await send('/api/admin/uploads', {
          method: 'POST',
          raw: '<svg/>',
          headers: { 'Content-Type': 'image/svg+xml' },
        })
      ).status,
      400,
    );
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=',
      'base64',
    );
    const response = await send('/api/admin/uploads', {
      method: 'POST',
      raw: png,
      headers: { 'Content-Type': 'image/png' },
    });
    assert.equal(response.status, 201);
    const image = (await response.json()).data.image;
    assert.match(image, /^\/assets\/uploads\/[a-f0-9-]+\.png$/);
    const publicImage = await send(image);
    assert.equal(publicImage.status, 200);
    assert.match(publicImage.headers.get('content-type'), /image\/png/);
    assert.deepEqual(
      await readFile(join(directory, 'uploads', image.split('/').at(-1))),
      png,
    );
    for (let i = 0; i < 5; i++)
      assert.equal(
        (
          await send('/api/admin/login', {
            method: 'POST',
            body: { username: 'test-admin', password: 'wrong' },
          })
        ).status,
        401,
      );
    assert.equal(
      (
        await send('/api/admin/login', {
          method: 'POST',
          body: { username: 'test-admin', password },
        })
      ).status,
      429,
    );
  }));
test('cookies Secure em produção e arquivos privados não são públicos', async () =>
  withAdmin(
    async ({ send, login }) => {
      const response = await login();
      assert.match(response.headers.get('set-cookie'), /__Host-tadalas_admin=/);
      assert.match(response.headers.get('set-cookie'), /; Secure/);
      assert.equal((await send('/var/admin.json')).status, 404);
      assert.equal((await send('/var/products.json')).status, 404);
      assert.equal((await send('/admin/')).status, 200);
      assert.equal((await send('/admin/admin.js')).status, 200);
    },
    { secureCookies: true },
  ));
