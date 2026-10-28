import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { atomicJson } from '../src/services/storage.js';
import { hashPassword } from '../src/services/auth.js';
import { createApp } from '../src/app.js';
const password = 'Unified-login-fixture-379214!';
async function harness(run, username = 'owner-admin') {
  const directory = await mkdtemp(join(tmpdir(), 'tadalas-signin-'));
  await atomicJson(join(directory, 'admin.json'), {
    username,
    ...(await hashPassword(password)),
  });
  const app = createApp({
    dataDirectory: directory,
    mailer: { configured: false, missing: ['SMTP_HOST'] },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  function client() {
    let cookie;
    return {
      async send(path, body, headers = {}) {
        const response = await fetch(base + path, {
          method: body ? 'POST' : 'GET',
          headers: {
            ...(cookie ? { Cookie: cookie } : {}),
            'Content-Type': 'application/json',
            ...headers,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const result = await response.json();
        const nextCookie = response.headers.get('set-cookie');
        if (nextCookie) cookie = nextCookie.split(';')[0];
        return {
          status: response.status,
          headers: response.headers,
          ...result,
        };
      },
    };
  }
  try {
    await run({ client, base, username });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}

test('login comum autentica administrador sem e-mail e mantém cookie, CSRF e logout próprios', () =>
  harness(async ({ client, username }) => {
    const admin = client();
    assert.equal((await admin.send('/api/auth/session')).data, null);
    const denied = await admin.send('/api/auth/login', {
      identifier: username,
      password: 'wrong',
      role: 'admin',
    });
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get('set-cookie'), null);
    const logged = await admin.send('/api/auth/login', {
      identifier: ` ${username} `,
      password,
    });
    assert.equal(logged.status, 200);
    assert.equal(logged.data.role, 'admin');
    assert.equal(logged.data.redirectTo, '/admin/');
    assert.match(logged.headers.get('set-cookie'), /tadalas_admin=/);
    assert.match(logged.headers.get('set-cookie'), /HttpOnly/);
    assert.match(logged.headers.get('set-cookie'), /SameSite=Strict/);
    assert.equal((await admin.send('/api/admin/session')).status, 200);
    assert.equal((await admin.send('/api/customer/orders')).status, 401);
    assert.equal((await admin.send('/api/auth/session')).data.role, 'admin');
    assert.equal((await admin.send('/api/admin/logout', {})).status, 403);
    assert.equal(
      (
        await admin.send(
          '/api/admin/logout',
          {},
          { 'X-CSRF-Token': logged.data.csrfToken },
        )
      ).status,
      200,
    );
    assert.equal((await admin.send('/api/auth/session')).data, null);
  }));

test('login comum normaliza e-mail de cliente e ignora permissão administrativa enviada no corpo', () =>
  harness(async ({ client }) => {
    const customer = client();
    assert.equal(
      (
        await customer.send('/api/customer/register', {
          name: 'Cliente fixture',
          email: 'client@example.test',
          password,
          role: 'admin',
        })
      ).status,
      201,
    );
    const logged = await customer.send('/api/auth/login', {
      identifier: ' CLIENT@EXAMPLE.TEST ',
      password,
      role: 'admin',
    });
    assert.equal(logged.status, 200);
    assert.equal(logged.data.role, 'customer');
    assert.equal(logged.data.redirectTo, '/conta/');
    assert.equal(logged.data.emailVerified, false);
    assert.equal(logged.data.emailEnabled, false);
    assert.match(logged.headers.get('set-cookie'), /tadalas_customer=/);
    assert.equal(
      (await customer.send('/api/auth/session')).data.role,
      'customer',
    );
    assert.equal(
      (await customer.send('/api/admin/orders/dashboard')).status,
      401,
    );
    assert.equal(
      (
        await customer.send(
          '/api/customer/logout',
          {},
          { 'X-CSRF-Token': logged.data.csrfToken },
        )
      ).status,
      200,
    );
    assert.equal((await customer.send('/api/auth/session')).data, null);
  }));

test('login comum protege origem, formato, limite de tentativas e reserva identificador administrativo', () =>
  harness(async ({ client, username }) => {
    const guest = client();
    assert.equal(
      (
        await guest.send(
          '/api/auth/login',
          { identifier: username, password },
          { Origin: 'https://other.example' },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await guest.send(
          '/api/auth/login',
          { identifier: username, password },
          { 'Content-Type': 'text/plain' },
        )
      ).status,
      415,
    );
    assert.equal(
      (
        await guest.send('/api/customer/register', {
          name: 'Fixture',
          email: username.toUpperCase(),
          password,
        })
      ).status,
      409,
    );
    for (let i = 0; i < 5; i++)
      assert.equal(
        (
          await guest.send('/api/auth/login', {
            identifier: username,
            password: 'wrong',
          })
        ).status,
        401,
      );
    assert.equal(
      (await guest.send('/api/auth/login', { identifier: username, password }))
        .status,
      429,
    );
    assert.equal(
      (await guest.send('/api/admin/login', { username, password })).status,
      429,
    );
    assert.equal((await guest.send('/api/auth/session')).data, null);
  }, 'owner@example.test'));
