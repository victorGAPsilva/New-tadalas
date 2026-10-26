import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addItem,
  removeItem,
  setQuantity,
  subtotal,
  formatPrice,
  restoreCart,
  buildWhatsAppUrl,
} from '../public/js/cart.js';
const product = {
  id: 'test',
  name: 'Teste & especial',
  available: true,
  priceCents: 2550,
};
test('adiciona, agrupa, altera e remove itens sem mutar estado', () => {
  const empty = [];
  const once = addItem(empty, product, 2);
  const twice = addItem(once, product, 1);
  assert.deepEqual(empty, []);
  assert.equal(twice[0].quantity, 3);
  assert.equal(subtotal(twice, [product]), 7650);
  assert.equal(setQuantity(twice, 'test', 4)[0].quantity, 4);
  assert.deepEqual(removeItem(twice, 'test'), []);
});
test('rejeita quantidades inválidas e produtos indisponíveis', () => {
  for (const quantity of [0, -1, 100, 1.5, NaN, '2', Infinity]) {
    assert.throws(() => addItem([], product, quantity), /quantidade/);
    assert.throws(
      () => setQuantity([{ id: 'test', quantity: 1 }], 'test', quantity),
      /quantidade/,
    );
  }
  assert.throws(() => addItem([{ id: 'test', quantity: 99 }], product, 1));
  assert.throws(
    () => addItem([], { ...product, available: false }),
    /indisponível/,
  );
});
test('formata reais e codifica a mensagem de WhatsApp sem perder acentos ou símbolos', () => {
  assert.equal(formatPrice(2550).replace(/\s/g, ' '), 'R$ 25,50');
  const url = new URL(
    buildWhatsAppUrl('5511960217697', {
      items: [{ ...product, quantity: 2 }],
      subtotalCents: 5100,
      notes: 'Sem cebola & molho à parte',
    }),
  );
  assert.equal(url.host, 'wa.me');
  assert.match(url.searchParams.get('text'), /2x Teste & especial/);
  assert.match(url.searchParams.get('text'), /Sem cebola & molho à parte/);
  assert.match(url.searchParams.get('text'), /confirmar a disponibilidade/);
  assert.throws(() => buildWhatsAppUrl('invalid', { items: [] }), /Contato/);
});
test('recuperação remove dados expirados, inválidos, duplicados e indisponíveis', () => {
  const storage = (value) => ({ getItem: () => value });
  assert.deepEqual(restoreCart(storage('broken'), [product]), []);
  assert.deepEqual(
    restoreCart(
      storage(
        JSON.stringify({
          updatedAt: Date.now() - 90000000,
          items: [{ id: 'test', quantity: 1 }],
        }),
      ),
      [product],
    ),
    [],
  );
  const value = JSON.stringify({
    updatedAt: Date.now(),
    items: [
      null,
      { id: 'test', quantity: 2 },
      { id: 'test', quantity: 3 },
      { id: 'missing', quantity: 1 },
    ],
  });
  assert.deepEqual(restoreCart(storage(value), [product]), [
    { id: 'test', quantity: 2 },
  ]);
  assert.deepEqual(
    restoreCart(storage(value), [{ ...product, available: false }]),
    [],
  );
});
