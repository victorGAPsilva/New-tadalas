import { randomUUID, createHash } from 'node:crypto';
import { validateOrder } from './order.js';
import { fail } from './product-validation.js';
export const transitions = {
  awaiting_confirmation: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'ready_for_pickup', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'],
  ready_for_pickup: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
export function validateAddress(address) {
  if (!address || typeof address !== 'object')
    throw fail('Informe o endereço de entrega.');
  const result = {};
  for (const key of [
    'street',
    'number',
    'neighborhood',
    'city',
    'complement',
    'postalCode',
  ]) {
    const value = address[key] ?? '';
    if (typeof value !== 'string' || value.length > 150)
      throw fail('Confira o endereço.');
    result[key] = value.trim();
  }
  for (const key of ['street', 'number', 'neighborhood', 'city'])
    if (!result[key]) throw fail('Preencha rua, número, bairro e cidade.');
  if (result.postalCode && !/^\d{5}-?\d{3}$/.test(result.postalCode))
    throw fail('Confira o CEP.');
  return result;
}
export function orderService(
  store,
  settings,
  { demo = false, now = Date.now } = {},
) {
  const decode = (row) =>
    row
      ? {
          ...JSON.parse(row.payload),
          seq: row.seq,
          status: row.status,
          version: row.version,
        }
      : null;
  const find = (id) =>
    decode(store.db.prepare('SELECT * FROM orders WHERE id=?').get(id));
  function quote(input) {
    const config = settings.public();
    if (!config.status.open)
      throw fail('A loja está fechada ou com pedidos pausados.', 409);
    const order = validateOrder(input, store.list('products'));
    if (
      input.payment !== undefined &&
      (!input.payment || typeof input.payment !== 'object')
    )
      throw fail('Confira a forma de pagamento.');
    const method = input.fulfillment?.method || 'pickup';
    let address = null,
      zone = null;
    if (!['pickup', 'delivery'].includes(method))
      throw fail('Escolha entrega ou retirada.');
    if (method === 'pickup' && !config.pickupEnabled)
      throw fail('Retirada indisponível.', 409);
    if (method === 'delivery') {
      if (!config.deliveryEnabled) throw fail('Entrega indisponível.', 409);
      zone = config.deliveryZones.find(
        (z) => z.id === input.fulfillment?.zoneId,
      );
      if (!zone) throw fail('Selecione uma região atendida.');
      address = validateAddress(input.fulfillment.address);
      const normalize = (value) =>
        value
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .trim()
          .toLowerCase();
      if (normalize(address.neighborhood) !== normalize(zone.name))
        throw fail(
          'Selecione a região de entrega correspondente ao bairro informado.',
        );
    }
    const deliveryFeeCents = zone?.feeCents || 0;
    const payment = input.payment?.method || config.paymentMethods[0];
    if (!config.paymentMethods.includes(payment))
      throw fail('Forma de pagamento indisponível.');
    const totalCents = order.subtotalCents + deliveryFeeCents;
    const changeForCents = input.payment?.changeForCents ?? null;
    if (
      changeForCents !== null &&
      (payment !== 'cash' ||
        !Number.isSafeInteger(changeForCents) ||
        changeForCents < totalCents ||
        changeForCents > 10000000)
    )
      throw fail('O valor para troco deve cobrir o total do pedido.');
    return {
      ...order,
      deliveryFeeCents,
      totalCents,
      fulfillment: {
        method,
        zoneId: zone?.id || null,
        zoneName: zone?.name || null,
        address,
        pickupAddress: method === 'pickup' ? config.address : null,
      },
      payment: { method: payment, changeForCents },
      estimatedMinutes: config.estimatedMinutes,
      confirmed: false,
    };
  }
  return {
    quote,
    create(input, customerId = null) {
      if (!input || typeof input !== 'object')
        throw fail('Informe os dados do pedido.');
      if (demo)
        throw fail('Pedidos demonstrativos não podem ser enviados.', 409);
      if (
        typeof input.idempotencyKey !== 'string' ||
        !/^[a-zA-Z0-9-]{20,100}$/.test(input.idempotencyKey)
      )
        throw fail('Recarregue o carrinho antes de finalizar.');
      const hash = createHash('sha256')
        .update(JSON.stringify({ input, customerId }))
        .digest('hex');
      return store.transaction(() => {
        const previous = store.db
          .prepare('SELECT * FROM orders WHERE idempotency_key=?')
          .get(input.idempotencyKey);
        if (previous) {
          if (
            previous.request_hash !== hash ||
            previous.customer_id !== customerId
          )
            throw fail(
              'A tentativa de pedido mudou. Atualize o carrinho.',
              409,
            );
          return decode(previous);
        }
        const priced = quote(input);
        if (input.expectedTotalCents !== priced.totalCents)
          throw fail(
            'Os valores mudaram. Confira o total atualizado antes de continuar.',
            409,
          );
        const name =
          typeof input.customerName === 'string'
            ? input.customerName.trim()
            : '';
        if (!name || name.length > 80)
          throw fail('Informe seu nome, com até 80 caracteres.');
        const order = {
          ...priced,
          id: randomUUID(),
          customerName: name,
          createdAt: new Date(now()).toISOString(),
          status: 'awaiting_confirmation',
          version: 1,
        };
        const row = store.db
          .prepare(
            'INSERT INTO orders(id,customer_id,status,version,payload,created_at,idempotency_key,request_hash) VALUES(?,?,?,?,?,?,?,?)',
          )
          .run(
            order.id,
            customerId,
            order.status,
            1,
            JSON.stringify(order),
            order.createdAt,
            input.idempotencyKey,
            hash,
          );
        order.number = `TB-${String(row.lastInsertRowid).padStart(6, '0')}`;
        store.db
          .prepare('UPDATE orders SET payload=? WHERE id=?')
          .run(JSON.stringify(order), order.id);
        return { ...order, seq: Number(row.lastInsertRowid) };
      });
    },
    listAdmin(status = '') {
      if (status && !Object.hasOwn(transitions, status))
        throw fail('Status inválido.');
      return store.db
        .prepare(
          `SELECT * FROM orders ${status ? 'WHERE status=?' : ''} ORDER BY seq DESC LIMIT 100`,
        )
        .all(...(status ? [status] : []))
        .map(decode);
    },
    listCustomer(customerId) {
      return store.db
        .prepare(
          'SELECT * FROM orders WHERE customer_id=? ORDER BY seq DESC LIMIT 50',
        )
        .all(customerId)
        .map(decode);
    },
    status(id, input) {
      return store.transaction(() => {
        const order = find(id);
        if (!order) throw fail('Pedido não encontrado.', 404);
        if (order.version !== input.version)
          throw fail('O pedido mudou. Atualize a lista.', 409);
        if (!transitions[order.status].includes(input.status))
          throw fail('Esta mudança de status não é permitida.', 409);
        if (
          (input.status === 'out_for_delivery' &&
            order.fulfillment.method !== 'delivery') ||
          (input.status === 'ready_for_pickup' &&
            order.fulfillment.method !== 'pickup')
        )
          throw fail('Status incompatível com a modalidade.', 400);
        const updated = {
          ...order,
          status: input.status,
          version: order.version + 1,
          updatedAt: new Date(now()).toISOString(),
          confirmed: !['awaiting_confirmation', 'cancelled'].includes(
            input.status,
          ),
        };
        store.db
          .prepare('UPDATE orders SET status=?,version=?,payload=? WHERE id=?')
          .run(updated.status, updated.version, JSON.stringify(updated), id);
        return updated;
      });
    },
    reorder(customerId, id) {
      const row = store.db
        .prepare('SELECT * FROM orders WHERE id=? AND customer_id=?')
        .get(id, customerId);
      if (!row) throw fail('Pedido não encontrado.', 404);
      const order = decode(row),
        products = store.list('products'),
        items = [],
        warnings = [];
      for (const item of order.items) {
        const product = products.find((p) => p.id === item.id);
        if (!product?.available) {
          warnings.push(`${item.name} não está disponível.`);
          continue;
        }
        try {
          validateOrder({ items: [item] }, products);
          items.push({
            id: item.id,
            quantity: item.quantity,
            selections: item.selections,
            removed: item.removed,
          });
        } catch {
          warnings.push(`Revise as opções de ${item.name}.`);
        }
      }
      return { items, products, warnings };
    },
  };
}
