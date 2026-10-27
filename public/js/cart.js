import { priceLine } from './order-model.js';
export const formatPrice = (cents) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    cents / 100,
  );
export function validQuantity(quantity) {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 99;
}
export function addItem(items, product, quantity = 1, selection = {}) {
  if (!product?.available) throw new Error('Produto indisponível.');
  const priced = priceLine(product, selection);
  const key = priced.key;
  const existing = items.find((item) => (item.key || item.id) === key);
  const total = quantity + (existing?.quantity || 0);
  if (!validQuantity(quantity) || !validQuantity(total))
    throw new Error('Use uma quantidade inteira entre 1 e 99.');
  return existing
    ? items.map((item) =>
        (item.key || item.id) === key ? { ...item, quantity: total } : item,
      )
    : [
        ...items,
        {
          id: product.id,
          quantity,
          ...(key !== product.id
            ? { key, selections: priced.selections, removed: priced.removed }
            : {}),
        },
      ];
}
export function setQuantity(items, id, quantity) {
  if (!validQuantity(quantity))
    throw new Error('Use uma quantidade inteira entre 1 e 99.');
  return items.map((item) =>
    (item.key || item.id) === id ? { ...item, quantity } : item,
  );
}
export const removeItem = (items, id) =>
  items.filter((item) => (item.key || item.id) !== id);
export const subtotal = (items, products) =>
  items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.id);
    return (
      sum + (product ? priceLine(product, item).priceCents : 0) * item.quantity
    );
  }, 0);
export function restoreCart(storage, products, key = 'tadalas-cart-v1') {
  try {
    const saved = JSON.parse(storage.getItem(key) || '{}');
    if (
      !saved ||
      !Number.isFinite(saved.updatedAt) ||
      saved.updatedAt > Date.now() ||
      Date.now() - saved.updatedAt > 86400000 ||
      !Array.isArray(saved.items)
    )
      return [];
    const seen = new Set(),
      items = [];
    for (const item of saved.items) {
      if (!item || !validQuantity(item.quantity)) continue;
      const product = products.find((p) => p.id === item.id && p.available);
      if (!product) continue;
      try {
        const price = priceLine(product, item);
        if (seen.has(price.key)) continue;
        seen.add(price.key);
        items.push({
          id: item.id,
          quantity: item.quantity,
          ...(price.key !== item.id
            ? {
                key: price.key,
                selections: price.selections,
                removed: price.removed,
              }
            : {}),
        });
      } catch {
        /* Catalog changes invalidate obsolete choices. */
      }
    }
    return items;
  } catch {
    return [];
  }
}
export function buildWhatsAppUrl(number, order) {
  if (!/^\d{10,15}$/.test(number)) throw new Error('Contato indisponível.');
  const text = [
    'Olá! Gostaria de fazer um pedido na TADALAS BURGUER.',
    '',
    ...(order.number
      ? [`Pedido: ${order.number}`, `Cliente: ${order.customerName}`, '']
      : []),
    'Itens:',
    ...order.items.map(
      (item) =>
        `${item.quantity}x ${item.name} — ${formatPrice(item.priceCents * item.quantity)} (${formatPrice(item.priceCents)} cada)${item.optionsDescription?.length ? '\n  ' + item.optionsDescription.join('; ') : ''}`,
    ),
    '',
    `Subtotal: ${formatPrice(order.subtotalCents)}`,
    ...(order.totalCents !== undefined
      ? [
          `Entrega: ${formatPrice(order.deliveryFeeCents)}`,
          `Total: ${formatPrice(order.totalCents)}`,
        ]
      : []),
    ...(order.fulfillment
      ? [
          order.fulfillment.method === 'pickup'
            ? 'Retirada na loja'
            : `Entrega: ${Object.values(order.fulfillment.address).filter(Boolean).join(', ')}${order.fulfillment.zoneName ? ' — ' + order.fulfillment.zoneName : ''}`,
          ...(order.fulfillment.deliveryPricing === 'distance'
            ? [
                `Frete por distância: ${formatPrice(order.fulfillment.rateCentsPerKm)} por km de rota (somente ida).`,
              ]
            : []),
        ]
      : []),
    ...(order.payment
      ? [
          `Pagamento no atendimento: ${{ pix: 'Pix', cash: 'Dinheiro', card: 'Cartão' }[order.payment.method]}`,
          ...(order.payment.changeForCents
            ? [`Troco para: ${formatPrice(order.payment.changeForCents)}`]
            : []),
        ]
      : []),
    ...(order.notes ? ['', `Observações: ${order.notes}`] : []),
    '',
    'Gostaria de confirmar a disponibilidade e as condições do pedido.',
  ].join('\n');
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
