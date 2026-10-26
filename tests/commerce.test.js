import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { atomicJson } from '../src/services/storage.js';
import { openStore } from '../src/services/database.js';
import { hashPassword } from '../src/services/auth.js';
import { storeStatus } from '../src/services/settings.js';
import { priceLine } from '../public/js/order-model.js';
import { addItem, subtotal, restoreCart } from '../public/js/cart.js';
const password = 'Commerce-test-only-73925!';
const product = {
  name: 'Fixture combo',
  description: 'Produto isolado de teste.',
  priceCents: 2500,
  category: 'hamburgueres',
  available: true,
  featured: false,
  ingredients: ['Cebola', 'Queijo'],
  image: null,
  notes: '',
  optionGroups: [
    {
      id: 'drink',
      name: 'Bebida',
      min: 1,
      max: 1,
      options: [
        { id: 'cola', name: 'Refrigerante', priceCents: 0, available: true },
        { id: 'juice', name: 'Suco', priceCents: 200, available: true },
      ],
    },
    {
      id: 'extras',
      name: 'Adicionais',
      min: 0,
      max: 2,
      options: [
        { id: 'bacon', name: 'Bacon', priceCents: 500, available: true },
        {
          id: 'cheese',
          name: 'Queijo extra',
          priceCents: 300,
          available: false,
        },
      ],
    },
  ],
};
async function harness(run, { email = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'tadalas-commerce-'));
  await atomicJson(join(directory, 'admin.json'), {
    username: 'admin-test',
    ...(await hashPassword(password)),
  });
  await atomicJson(join(directory, 'products.json'), []);
  let now = Date.parse('2026-10-24T22:00:00Z');
  const sent = [];
  const app = createApp({
    dataDirectory: directory,
    now: () => now,
    mailer: {
      configured: email,
      missing: email ? [] : ['SMTP_HOST'],
      baseUrl: 'https://tadalas.example',
      send: async (message) => {
        sent.push(message);
      },
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  function client() {
    let cookie, csrf;
    return {
      async send(path, method = 'GET', body, headers = {}) {
        const r = await fetch(base + path, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(cookie ? { Cookie: cookie } : {}),
            ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
            ...headers,
          },
          ...(method !== 'GET' ? { body: JSON.stringify(body || {}) } : {}),
        });
        const data = await r.json();
        return {
          status: r.status,
          data: data.data,
          error: data.error,
          headers: r.headers,
        };
      },
      async login(scope, emailAddress) {
        const r = await this.send(
          `/api/${scope}/login`,
          'POST',
          scope === 'admin'
            ? { username: 'admin-test', password }
            : { email: emailAddress, password },
        );
        assert.equal(r.status, 200);
        cookie = r.headers.get('set-cookie').split(';')[0];
        csrf = r.data.csrfToken;
        return r;
      },
    };
  }
  const admin = client();
  await admin.login('admin');
  const fixture = (await admin.send('/api/admin/products', 'POST', product))
    .data;
  const orderInput = () => ({
    items: [
      {
        id: fixture.id,
        quantity: 2,
        selections: { drink: ['cola'], extras: ['bacon'] },
        removed: ['Cebola'],
        priceCents: 1,
      },
    ],
    customerName: 'Cliente fixture',
    fulfillment: { method: 'pickup' },
    payment: { method: 'pix', changeForCents: null },
    notes: 'Sem guardanapo',
    idempotencyKey: randomUUID(),
  });
  try {
    await run({
      app,
      admin,
      client,
      fixture,
      orderInput,
      directory,
      sent,
      advance: (ms) => {
        now += ms;
      },
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}
test('migração SQLite mantém legado, faz backup e não importa novamente', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tadalas-migrate-'));
  await atomicJson(join(directory, 'products.json'), [
    { ...product, id: 'legacy' },
  ]);
  await atomicJson(join(directory, 'admin.json'), {
    username: 'legacy',
    salt: 'salt',
    hash: 'hash',
  });
  try {
    let store = openStore(directory);
    assert.equal(store.list('products').length, 1);
    assert.equal(store.get('admin', 'owner').username, 'legacy');
    store.transaction(() => {
      store.put('products', 'new', { ...product, id: 'new' });
    });
    store.close();
    store = openStore(directory);
    assert.equal(store.list('products').length, 2);
    assert.equal(
      JSON.parse(await readFile(join(directory, 'products.json'), 'utf8'))
        .length,
      1,
    );
    assert.equal((await readdir(join(directory, 'backups'))).length, 1);
    store.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test('opções obrigatórias, adicionais, remoções e variantes de carrinho', () => {
  const fixture = { ...product, id: 'fixture' };
  assert.throws(() => priceLine(fixture, {}), /Bebida/);
  assert.throws(
    () => priceLine(fixture, { selections: { drink: ['cola', 'juice'] } }),
    /Bebida/,
  );
  assert.throws(
    () =>
      priceLine(fixture, {
        selections: { drink: ['cola'], extras: ['cheese'] },
      }),
    /indisponível/,
  );
  assert.throws(
    () =>
      priceLine(fixture, {
        selections: { drink: ['cola'] },
        removed: ['Desconhecido'],
      }),
    /ingredientes/,
  );
  let items = addItem([], fixture, 1, { selections: { drink: ['cola'] } });
  items = addItem(items, fixture, 2, { selections: { drink: ['juice'] } });
  assert.equal(items.length, 2);
  assert.equal(subtotal(items, [fixture]), 7900);
  const restored = restoreCart(
    { getItem: () => JSON.stringify({ items, updatedAt: Date.now() }) },
    [fixture],
  );
  assert.equal(restored.length, 2);
  assert.equal(subtotal(restored, [fixture]), 7900);
});
test('horários usam fuso da loja e intervalos após meia-noite', () => {
  const settings = {
    storeMode: 'schedule',
    timezone: 'America/Sao_Paulo',
    schedule: [{ day: 6, open: '23:00', close: '02:00' }],
  };
  assert.equal(
    storeStatus(settings, new Date('2026-10-25T04:00:00Z')).open,
    true,
  );
  assert.equal(
    storeStatus(settings, new Date('2026-10-25T06:00:00Z')).open,
    false,
  );
  assert.equal(
    storeStatus({ ...settings, storeMode: 'manual', manualOpen: false }).open,
    false,
  );
});
test('pedido persistente, idempotência, preço, taxa e evolução de status', () =>
  harness(async ({ admin, client, fixture, orderInput }) => {
    const guest = client();
    let config = (await admin.send('/api/admin/settings')).data;
    assert.equal(
      (
        await admin.send('/api/admin/settings', 'PUT', {
          ...config,
          deliveryEnabled: true,
          deliveryZones: [{ id: 'centro', name: 'Centro', feeCents: 500 }],
        })
      ).status,
      200,
    );
    const input = orderInput();
    input.fulfillment = {
      method: 'delivery',
      zoneId: 'centro',
      address: {
        street: 'Rua Teste',
        number: '10',
        neighborhood: 'Centro',
        city: 'Cidade Teste',
      },
    };
    const quote = await guest.send('/api/orders/quote', 'POST', input);
    assert.equal(quote.status, 200);
    assert.equal(quote.data.subtotalCents, 6000);
    assert.equal(quote.data.totalCents, 6500);
    const mismatched = structuredClone(input);
    mismatched.fulfillment.address.neighborhood = 'Outro bairro';
    assert.equal(
      (await guest.send('/api/orders/quote', 'POST', mismatched)).status,
      400,
    );
    assert.equal(
      (
        await guest.send('/api/orders/quote', 'POST', {
          ...input,
          payment: { method: 'cash', changeForCents: 6400 },
        })
      ).status,
      400,
    );
    const wrong = await guest.send('/api/orders', 'POST', {
      ...input,
      expectedTotalCents: 1,
    });
    assert.equal(wrong.status, 409);
    const created = await guest.send('/api/orders', 'POST', {
      ...input,
      expectedTotalCents: 6500,
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.confirmed, false);
    assert.equal(created.data.status, 'awaiting_confirmation');
    assert.match(
      new URL(created.data.whatsappUrl).searchParams.get('text'),
      /Bacon/,
    );
    assert.match(
      new URL(created.data.whatsappUrl).searchParams.get('text'),
      /Rua Teste/,
    );
    const duplicate = await guest.send('/api/orders', 'POST', {
      ...input,
      expectedTotalCents: 6500,
    });
    assert.equal(duplicate.data.id, created.data.id);
    assert.equal((await admin.send('/api/admin/orders')).data.length, 1);
    assert.equal(
      (
        await guest.send('/api/orders', 'POST', {
          ...input,
          expectedTotalCents: 6500,
          notes: 'Mudou',
        })
      ).status,
      409,
    );
    let order = created.data;
    assert.equal(
      (
        await admin.send(`/api/admin/orders/${order.id}/status`, 'PATCH', {
          version: 1,
          status: 'completed',
        })
      ).status,
      409,
    );
    for (const status of [
      'accepted',
      'preparing',
      'out_for_delivery',
      'completed',
    ]) {
      const changed = await admin.send(
        `/api/admin/orders/${order.id}/status`,
        'PATCH',
        { status, version: order.version },
      );
      assert.equal(changed.status, 200);
      order = changed.data;
    }
    assert.equal(order.confirmed, true);
    assert.equal(
      (
        await admin.send(`/api/admin/orders/${order.id}/status`, 'PATCH', {
          status: 'accepted',
          version: order.version,
        })
      ).status,
      409,
    );
    config = (await admin.send('/api/admin/settings')).data;
    assert.equal(
      (
        await admin.send('/api/admin/settings', 'PUT', {
          ...config,
          manualOpen: false,
        })
      ).status,
      200,
    );
    assert.equal(
      (await guest.send('/api/orders/quote', 'POST', orderInput())).status,
      409,
    );
    assert.equal(
      (await admin.send('/api/admin/settings', 'PUT', config)).status,
      409,
    );
    assert.equal(
      (
        await guest.send('/api/orders/quote', 'POST', {
          items: [{ id: fixture.id, quantity: 1 }],
        })
      ).status,
      409,
    );
  }));
test('histórico, repetir pedido, endereços e isolamento entre clientes', () =>
  harness(async ({ admin, client, orderInput, fixture }) => {
    const customer = client(),
      other = client();
    for (const [c, email] of [
      [customer, 'a@example.test'],
      [other, 'b@example.test'],
    ]) {
      assert.equal(
        (
          await c.send('/api/customer/register', 'POST', {
            name: 'Cliente teste',
            email,
            password,
          })
        ).status,
        201,
      );
      await c.login('customer', email);
    }
    const input = orderInput(),
      quote = (await customer.send('/api/orders/quote', 'POST', input)).data;
    const created = await customer.send('/api/orders', 'POST', {
      ...input,
      expectedTotalCents: quote.totalCents,
    });
    assert.equal(created.status, 201);
    const order = created.data;
    assert.equal((await customer.send('/api/customer/orders')).data.length, 1);
    assert.equal((await other.send('/api/customer/orders')).data.length, 0);
    assert.equal(
      (await other.send(`/api/customer/orders/${order.id}/reorder`, 'POST', {}))
        .status,
      404,
    );
    assert.equal(
      (
        await customer.send(
          `/api/customer/orders/${order.id}/reorder`,
          'POST',
          {},
        )
      ).data.items.length,
      1,
    );
    assert.equal(
      (
        await admin.send(`/api/admin/products/${fixture.id}`, 'PUT', {
          ...fixture,
          available: false,
        })
      ).status,
      200,
    );
    const repeat = await customer.send(
      `/api/customer/orders/${order.id}/reorder`,
      'POST',
      {},
    );
    assert.equal(repeat.data.items.length, 0);
    assert.equal(repeat.data.warnings.length, 1);
    const address = await customer.send('/api/customer/addresses', 'POST', {
      label: 'Casa',
      street: 'Rua Teste',
      number: '10',
      neighborhood: 'Centro',
      city: 'Cidade Teste',
    });
    assert.equal(address.status, 201);
    assert.equal(
      (
        await other.send(
          `/api/customer/addresses/${address.data.id}`,
          'DELETE',
          {},
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await customer.send(
          `/api/customer/addresses/${address.data.id}`,
          'PUT',
          { ...address.data, number: '20' },
        )
      ).status,
      200,
    );
    assert.equal(
      (await customer.send('/api/customer/addresses')).data[0].number,
      '20',
    );
    assert.equal(
      (
        await customer.send(
          `/api/customer/addresses/${address.data.id}`,
          'DELETE',
          {},
        )
      ).status,
      200,
    );
  }));
test('confirmação de e-mail e recuperação com token único revogam sessões', () =>
  harness(
    async ({ app, client, sent }) => {
      const customer = client(),
        email = 'mail@example.test';
      await customer.send('/api/customer/register', 'POST', {
        name: 'Cliente mail',
        email,
        password,
      });
      await app.locals.services.mail.flush();
      assert.equal(sent.length, 1);
      const verification = new URL(
        sent[0].text.match(/https:\/\/\S+/)[0],
      ).searchParams.get('token');
      assert.equal(
        (
          await customer.send('/api/customer/verify-email', 'POST', {
            token: verification,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await customer.send('/api/customer/verify-email', 'POST', {
            token: verification,
          })
        ).status,
        400,
      );
      await customer.login('customer', email);
      assert.equal(
        (await customer.send('/api/customer/session')).data.emailVerified,
        true,
      );
      assert.equal(
        (
          await customer.send('/api/customer/forgot-password', 'POST', {
            email,
          })
        ).status,
        202,
      );
      await app.locals.services.mail.flush();
      const token = new URL(
        sent.at(-1).text.match(/https:\/\/\S+/)[0],
      ).searchParams.get('token');
      const updated = 'New-customer-pass-73925!';
      assert.equal(
        (
          await customer.send('/api/customer/reset-password', 'POST', {
            token,
            password: updated,
          })
        ).status,
        200,
      );
      assert.equal((await customer.send('/api/customer/session')).data, null);
      assert.equal(
        (
          await customer.send('/api/customer/reset-password', 'POST', {
            token,
            password: updated,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await customer.send('/api/customer/login', 'POST', {
            email,
            password,
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await customer.send('/api/customer/login', 'POST', {
            email,
            password: updated,
          })
        ).status,
        200,
      );
    },
    { email: true },
  ));
test('recuperação expirada, resposta neutra e SMTP não configurado', () =>
  harness(
    async ({ app, client, sent, advance }) => {
      const customer = client();
      await customer.send('/api/customer/register', 'POST', {
        name: 'Cliente',
        email: 'expires@example.test',
        password,
      });
      await app.locals.services.mail.flush();
      const a = await customer.send('/api/customer/forgot-password', 'POST', {
          email: 'unknown@example.test',
        }),
        b = await customer.send('/api/customer/forgot-password', 'POST', {
          email: 'expires@example.test',
        });
      assert.deepEqual(a.data, b.data);
      await app.locals.services.mail.flush();
      const token = new URL(
        sent.at(-1).text.match(/https:\/\/\S+/)[0],
      ).searchParams.get('token');
      advance(31 * 60 * 1000);
      assert.equal(
        (
          await customer.send('/api/customer/reset-password', 'POST', {
            token,
            password,
          })
        ).status,
        400,
      );
    },
    { email: true },
  ));
test('configuração e categorias têm validação e exclusão protegida', () =>
  harness(async ({ admin, client }) => {
    const guest = client();
    assert.equal(
      (await guest.send('/api/customer/capabilities')).data.emailEnabled,
      false,
    );
    assert.equal(
      (
        await guest.send('/api/customer/forgot-password', 'POST', {
          email: 'any@example.test',
        })
      ).status,
      409,
    );
    assert.equal(
      (await admin.send('/api/admin/categories/hamburgueres', 'DELETE', {}))
        .status,
      409,
    );
    const category = await admin.send('/api/admin/categories', 'POST', {
      name: 'Categoria temporária',
    });
    assert.equal(category.status, 201);
    assert.equal(
      (
        await admin.send(`/api/admin/categories/${category.data.id}`, 'PUT', {
          name: 'Renomeada',
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await admin.send(
          `/api/admin/categories/${category.data.id}`,
          'DELETE',
          {},
        )
      ).status,
      200,
    );
    const settings = (await admin.send('/api/admin/settings')).data;
    for (const patch of [
      { schedule: [null] },
      { deliveryEnabled: true, deliveryZones: [] },
      { schedule: [{ day: 1, open: '23:00', close: '23:00' }] },
      { paymentMethods: [] },
    ])
      assert.equal(
        (
          await admin.send('/api/admin/settings', 'PUT', {
            ...settings,
            ...patch,
          })
        ).status,
        400,
      );
  }));
