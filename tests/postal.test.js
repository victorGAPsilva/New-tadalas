import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPostalService } from '../src/services/postal.js';
import { createApp } from '../src/app.js';
import { initPostalCode } from '../public/js/postal-code.js';

const fixture = {
  cep: '01001-000',
  logradouro: 'Praça da Sé',
  bairro: 'Sé',
  localidade: 'São Paulo',
  uf: 'SP',
};
const response = (data) => ({ ok: true, json: async () => data });

test('ViaCEP valida formato, fixa origem, compartilha consultas e mantém cache com expiração', async () => {
  let calls = 0,
    now = 0,
    release;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  const service = createPostalService({
    now: () => now,
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(url, 'https://viacep.com.br/ws/01001000/json/');
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal);
      await waiting;
      return response(fixture);
    },
  });
  await assert.rejects(service.lookup('01001abc'), { status: 400 });
  await assert.rejects(service.lookup('https://example.com'), { status: 400 });
  assert.equal(calls, 0);
  const first = service.lookup('01001-000'),
    second = service.lookup('01001000');
  release();
  assert.deepEqual(await first, await second);
  assert.equal((await first).street, fixture.logradouro);
  assert.equal(calls, 1);
  await service.lookup('01001000');
  assert.equal(calls, 1);
  now += 24 * 60 * 60 * 1000 + 1;
  await service.lookup('01001000');
  assert.equal(calls, 2);
});

test('ViaCEP trata inexistência, CEP genérico, falha de rede e resposta inválida', async () => {
  const make = (data) =>
    createPostalService({ fetchImpl: async () => response(data) });
  await assert.rejects(make({ erro: true }).lookup('99999999'), {
    status: 404,
  });
  await assert.rejects(make({ erro: 'true' }).lookup('99999999'), {
    status: 404,
  });
  const generic = await make({ ...fixture, logradouro: '', bairro: '' }).lookup(
    '01001000',
  );
  assert.equal(generic.street, '');
  await assert.rejects(
    make({ ...fixture, cep: '02002-000' }).lookup('01001000'),
    { status: 503 },
  );
  await assert.rejects(make({}).lookup('01001000'), { status: 503 });
  await assert.rejects(
    createPostalService({
      fetchImpl: async () => {
        throw new Error('timeout');
      },
    }).lookup('01001000'),
    { status: 503 },
  );
});

test('consulta HTTP pública tem limite por IP e não depende de produtos ou login', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tadalas-postal-'));
  let calls = 0;
  const app = createApp({
    dataDirectory: directory,
    postalFetch: async () => {
      calls++;
      return response(fixture);
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const first = await fetch(`${base}/api/address/01001000`);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get('cache-control'), 'no-store');
    assert.equal((await first.json()).data.neighborhood, 'Sé');
    assert.equal((await fetch(`${base}/api/address/not-a-cep`)).status, 400);
    for (let i = 0; i < 28; i++)
      assert.equal((await fetch(`${base}/api/address/01001000`)).status, 200);
    assert.equal(calls, 1);
    const limited = await fetch(`${base}/api/address/01001000`);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), '60');
    assert.deepEqual(
      (await (await fetch(`${base}/api/products`)).json()).data,
      [],
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});

test('autopreenchimento preserva número e edição manual e ignora consultas antigas', async (t) => {
  class Field extends EventTarget {
    value = '';
    disabled = false;
    attributes = new Map();
    setAttribute(key, value) {
      this.attributes.set(key, value);
    }
    removeAttribute(key) {
      this.attributes.delete(key);
    }
  }
  const input = new Field(),
    button = new Field(),
    status = {},
    fields = {
      street: new Field(),
      neighborhood: new Field(),
      city: new Field(),
    };
  const pending = [];
  t.mock.method(
    globalThis,
    'fetch',
    () => new Promise((resolve) => pending.push(resolve)),
  );
  let changed = 0;
  const helper = initPostalCode({
    input,
    button,
    status,
    fields,
    onAddress: () => {
      changed++;
    },
  });
  t.after(() => helper.destroy());
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  const result = {
    postalCode: fixture.cep,
    street: fixture.logradouro,
    neighborhood: fixture.bairro,
    city: fixture.localidade,
    state: fixture.uf,
  };
  input.value = '01001000';
  button.dispatchEvent(new Event('click'));
  fields.street.value = 'Rua digitada pelo cliente';
  pending.shift()(response({ data: result }));
  await flush();
  assert.equal(fields.street.value, 'Rua digitada pelo cliente');
  assert.equal(changed, 0);
  button.dispatchEvent(new Event('click'));
  input.value = '02002000';
  helper.cancel();
  pending.shift()(response({ data: result }));
  await flush();
  assert.equal(fields.street.value, 'Rua digitada pelo cliente');
  input.value = '01001000';
  button.dispatchEvent(new Event('click'));
  pending.shift()(response({ data: result }));
  await flush();
  assert.equal(fields.street.value, 'Praça da Sé');
  assert.equal(fields.neighborhood.value, 'Sé');
  assert.equal(changed, 1);
  assert.equal(input.value, '01001-000');
});
