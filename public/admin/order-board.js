export const statusLabels = {
  awaiting_confirmation: 'Aguardando confirmação',
  accepted: 'Aceito',
  preparing: 'Em preparo',
  out_for_delivery: 'Saiu para entrega',
  ready_for_pickup: 'Pronto para retirada',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};
export function nextAction(order) {
  const actions = {
    awaiting_confirmation: ['accepted', 'Aceitar pedido'],
    accepted: ['preparing', 'Iniciar preparo'],
    preparing:
      order.fulfillment.method === 'delivery'
        ? ['out_for_delivery', 'Saiu para entrega']
        : ['ready_for_pickup', 'Pronto para retirada'],
    out_for_delivery: ['completed', 'Concluir pedido'],
    ready_for_pickup: ['completed', 'Concluir pedido'],
  };
  return actions[order.status] || null;
}
export function waitingTime(createdAt, now = Date.now()) {
  const minutes = Math.max(
    0,
    Math.floor((now - Date.parse(createdAt)) / 60000),
  );
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 1) return 'Agora';
  return minutes < 60
    ? `Há ${minutes} min`
    : `Há ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
