import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atomicJson } from '../src/services/storage.js';
async function withServer(options, run) {
  const directory = await mkdtemp(join(tmpdir(), 'tadalas-api-'));
  await atomicJson(join(directory, 'products.json'), []);
  const server = createApp({ dataDirectory: directory, ...options }).listen(
    0,
    '127.0.0.1',
  );
  await once(server, 'listening');
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}
test('API pública, segurança, catálogo vazio e erros', async () =>
  withServer({}, async (base) => {
    for (const path of [
      '/api/health',
      '/api/products',
      '/api/categories',
      '/api/config/public',
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200);
      assert.ok((await response.json()).data);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('x-powered-by'), null);
      assert.ok(response.headers.get('content-security-policy'));
    }
    assert.deepEqual(
      (await (await fetch(base + '/api/products')).json()).data,
      [],
    );
    assert.equal((await fetch(base + '/api/products/missing')).status, 404);
    assert.equal((await fetch(base + '/api/nope')).status, 404);
    assert.equal((await fetch(base + '/missing')).status, 404);
    const config = (await (await fetch(base + '/api/config/public')).json())
      .data;
    assert.equal(config.demoMode, false);
    assert.equal(config.whatsappNumber, '5511960217697');
    assert.equal(config.PORT, undefined);
    const response = await fetch(base + '/api/orders/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad',
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error.message, /JSON/);
  }));
test('validação usa preço cadastrado e rejeita itens inválidos', async () =>
  withServer({ demo: true }, async (base) => {
    const send = (body) =>
      fetch(base + '/api/orders/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    assert.equal((await send({ items: [null] })).status, 400);
    const response = await send({
      items: [{ id: 'exemplo-local', quantity: 2, priceCents: 1 }],
      notes: '  Sem extras  ',
    });
    assert.equal(response.status, 200);
    const order = (await response.json()).data;
    assert.equal(order.subtotalCents, 5000);
    assert.equal(order.confirmed, false);
    assert.equal(order.notes, 'Sem extras');
    assert.equal(order.demoMode, true);
    for (const quantity of [0, 100, 1.2, '2'])
      assert.equal(
        (await send({ items: [{ id: 'exemplo-local', quantity }] })).status,
        400,
      );
    assert.equal((await send({ items: [] })).status, 400);
    assert.equal(
      (await send({ items: [{ id: 'exemplo-indisponivel', quantity: 1 }] }))
        .status,
      409,
    );
    assert.equal(
      (await send({ items: [{ id: 'missing', quantity: 1 }] })).status,
      409,
    );
    assert.equal(
      (
        await send({
          items: [{ id: 'exemplo-local', quantity: 1 }],
          notes: 'x'.repeat(501),
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await send({
          items: [
            { id: 'exemplo-local', quantity: 1 },
            { id: 'exemplo-local', quantity: 1 },
          ],
        })
      ).status,
      400,
    );
    assert.equal(
      (await (await fetch(base + '/api/categories')).json()).data.length,
      2,
    );
    assert.equal(
      (await fetch(base + '/api/products/exemplo-local')).status,
      200,
    );
  }));
test('HTML e todos os recursos locais referenciados existem', async () =>
  withServer({}, async (base) => {
    const response = await fetch(base);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /lang="pt-BR"/);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    for (const match of html.matchAll(/(?:href|src)="(\/[^"]+)"/g))
      assert.equal((await fetch(base + match[1])).status, 200, match[1]);
    for (const match of html.matchAll(/href="#([^"]+)"/g))
      assert.ok(html.includes(`id="${match[1]}"`), match[1]);
  }));
test('páginas separadas de cardápio, login, conta e administração', async () =>
  withServer({}, async (base) => {
    for (const path of [
      '/',
      '/cardapio/',
      '/login/',
      '/conta/',
      '/admin/login/',
    ]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      const html = await response.text();
      if (!path.startsWith('/admin/'))
        assert.doesNotMatch(html, /href="\/admin(?:\/|\?|")/);
      for (const match of html.matchAll(/(?:href|src)="(\/[^"]+)"/g))
        assert.equal((await fetch(base + match[1])).status, 200, match[1]);
      for (const match of html.matchAll(/href="#([^"]+)"/g))
        assert.ok(html.includes(`id="${match[1]}"`), match[1]);
    }
    const menu = await (await fetch(base + '/cardapio/')).text();
    assert.equal((menu.match(/<h1\b/g) || []).length, 1);
    assert.ok(!menu.includes('id="sobre"'));
    assert.ok(menu.includes('id="checkout"'));
    for (const path of ['/cardapio', '/login', '/conta', '/admin/login']) {
      const response = await fetch(base + path, { redirect: 'manual' });
      assert.equal(response.status, 308);
      assert.equal(response.headers.get('location'), path + '/');
    }
  }));
