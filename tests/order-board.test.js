import test from 'node:test';
import assert from 'node:assert/strict';
import { nextAction, waitingTime } from '../public/admin/order-board.js';
import { transitions } from '../src/services/orders.js';

test('ações da central respeitam transições e diferenciam entrega e retirada', () => {
  for (const method of ['delivery', 'pickup']) {
    for (const status of Object.keys(transitions)) {
      const action = nextAction({ status, fulfillment: { method } });
      if (['completed', 'cancelled'].includes(status))
        assert.equal(action, null);
      else assert.ok(transitions[status].includes(action[0]));
      if (status === 'preparing')
        assert.equal(
          action[0],
          method === 'delivery' ? 'out_for_delivery' : 'ready_for_pickup',
        );
    }
  }
});
test('tempo de espera não fica negativo e aceita pedidos de mais de uma hora', () => {
  const now = Date.parse('2026-10-27T20:00:00Z');
  assert.equal(waitingTime('2026-10-27T20:01:00Z', now), 'Agora');
  assert.equal(waitingTime('2026-10-27T19:55:00Z', now), 'Há 5 min');
  assert.equal(waitingTime('2026-10-27T18:55:00Z', now), 'Há 1 h 5 min');
  assert.equal(waitingTime('invalid', now), '');
});
