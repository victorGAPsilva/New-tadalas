import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { documentsAt } from './database-inspect.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
const password = 'Customer-only-test-61738!';
test('conta de cliente: cadastro, login, isolamento de permissões, CSRF e logout', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tadalas-customer-test-'));
  let now = Date.now();
  const server = createApp({ dataDirectory: directory, now: () => now }).listen(
    0,
    '127.0.0.1',
  );
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie, csrf;
  const send = (path, body, headers = {}) =>
    fetch(base + path, {
      ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        ...headers,
      },
    });
  try {
    assert.equal(
      (await (await send('/api/customer/session')).json()).data,
      null,
    );
    assert.equal(
      (
        await send('/api/customer/register', {
          name: 'Teste',
          email: 'customer@example.test',
          password: 'short',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await send('/api/customer/register', {
          name: 'Cliente de teste',
          email: 'Customer@Example.test',
          password,
          role: 'admin',
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await send('/api/customer/register', {
          name: 'Outro nome',
          email: 'customer@example.test',
          password,
        })
      ).status,
      409,
    );
    const stored = JSON.stringify(
      documentsAt(join(directory, 'tadalas.sqlite'), 'customers'),
    );
    assert.ok(!stored.includes(password));
    assert.ok(JSON.parse(stored)[0].salt);
    assert.equal(JSON.parse(stored)[0].role, undefined);
    assert.equal(
      (
        await send('/api/customer/login', {
          email: 'customer@example.test',
          password: 'wrong',
        })
      ).status,
      401,
    );
    const login = await send('/api/customer/login', {
      email: 'customer@example.test',
      password,
    });
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie'), /tadalas_customer=/);
    assert.match(login.headers.get('set-cookie'), /HttpOnly/);
    cookie = login.headers.get('set-cookie').split(';')[0];
    const session = (await login.json()).data;
    csrf = session.csrfToken;
    assert.equal(session.displayName, 'Cliente de teste');
    assert.equal(session.hash, undefined);
    assert.equal((await send('/api/admin/products')).status, 401);
    assert.equal(
      (await send('/api/customer/logout', {}, { 'X-CSRF-Token': 'bad' }))
        .status,
      403,
    );
    assert.equal((await send('/api/customer/logout', {})).status, 200);
    assert.equal(
      (await (await send('/api/customer/session')).json()).data,
      null,
    );
    const nextLogin = await send('/api/customer/login', {
      email: 'customer@example.test',
      password,
    });
    cookie = nextLogin.headers.get('set-cookie').split(';')[0];
    now += 9 * 60 * 60 * 1000;
    assert.equal(
      (await (await send('/api/customer/session')).json()).data,
      null,
    );
    assert.equal((await send('/var/customers.json')).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
