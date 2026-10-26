import { priceLine } from '../../public/js/order-model.js';
export function validateOrder(input, products) {
  if (
    !input ||
    !Array.isArray(input.items) ||
    !input.items.length ||
    input.items.length > 50
  )
    throw Object.assign(new Error('Adicione de 1 a 50 itens ao pedido.'), {
      status: 400,
    });
  const seen = new Set();
  const items = input.items.map((item) => {
    if (!item || typeof item.id !== 'string')
      throw Object.assign(new Error('Item inválido no pedido.'), {
        status: 400,
      });
    const product = products.find((p) => p.id === item.id);
    if (!product || !product.available)
      throw Object.assign(
        new Error('Um produto não está mais disponível. Atualize o cardápio.'),
        { status: 409 },
      );
    const custom = priceLine(product, item);
    if (
      seen.has(custom.key) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    )
      throw Object.assign(
        new Error(
          'Quantidade inválida. Use um inteiro entre 1 e 99, sem itens repetidos.',
        ),
        { status: 400 },
      );
    seen.add(custom.key);
    return {
      id: product.id,
      name: product.name,
      quantity: item.quantity,
      ...custom,
    };
  });
  const notes = input.notes ?? '';
  if (typeof notes !== 'string' || notes.length > 500)
    throw Object.assign(
      new Error('As observações devem ter até 500 caracteres.'),
      { status: 400 },
    );
  return {
    items,
    notes: notes.trim(),
    subtotalCents: items.reduce(
      (sum, item) => sum + item.priceCents * item.quantity,
      0,
    ),
  };
}
