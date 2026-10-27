import { el } from '/js/components/dom.js';
import { formatPrice } from '/js/cart.js';
import { nextAction, statusLabels, waitingTime } from './order-board.js';

export function initOrdersPanel({ api, notice }) {
  const $ = (selector) => document.querySelector(selector);
  let page = 1,
    view = 'active',
    revision = 0,
    searchTimer,
    busy = false;
  const error = (text) => {
    $('#orders-error').textContent = text;
  };
  function card(order) {
    const article = el(
      'article',
      undefined,
      `order-ticket order-${order.status}`,
    );
    article.dataset.orderId = order.id;
    const head = el('div', undefined, 'order-ticket-head'),
      title = el('div');
    title.append(
      el(
        'p',
        order.fulfillment.method === 'delivery' ? 'ENTREGA' : 'RETIRADA',
        'order-kind',
      ),
      el('h3', order.number),
    );
    head.append(title, el('span', statusLabels[order.status], 'order-status'));
    const time = el(
      'time',
      `${new Date(order.createdAt).toLocaleString('pt-BR')} · ${waitingTime(order.createdAt)}`,
      'order-time',
    );
    time.dateTime = order.createdAt;
    article.append(head, el('p', order.customerName, 'order-customer'), time);
    const preview = el(
      'p',
      order.items.map((item) => `${item.quantity}× ${item.name}`).join(' · '),
      'order-preview',
    );
    article.append(preview);
    const details = el('details', undefined, 'order-details');
    details.append(el('summary', 'Ver itens, endereço e pagamento'));
    const items = el('ul');
    for (const item of order.items) {
      const line = el('li');
      line.append(
        el(
          'strong',
          `${item.quantity}× ${item.name} · ${formatPrice(item.priceCents * item.quantity)}`,
        ),
      );
      if (item.optionsDescription?.length)
        line.append(el('p', item.optionsDescription.join(' · ')));
      items.append(line);
    }
    details.append(items);
    const address = order.fulfillment.address;
    details.append(
      el(
        'p',
        address
          ? `Endereço: ${[address.street, address.number, address.neighborhood, address.city, address.postalCode, address.complement].filter(Boolean).join(', ')}`
          : `Retirada: ${order.fulfillment.pickupAddress || 'Confirme o local com o cliente.'}`,
      ),
    );
    details.append(
      el(
        'p',
        `Pagamento no atendimento: ${{ pix: 'Pix', cash: 'Dinheiro', card: 'Cartão' }[order.payment.method]}${order.payment.changeForCents ? ' · troco para ' + formatPrice(order.payment.changeForCents) : ''}`,
      ),
    );
    details.append(
      el(
        'p',
        `Subtotal: ${formatPrice(order.subtotalCents)} · Entrega: ${formatPrice(order.deliveryFeeCents)}`,
      ),
    );
    article.append(details);
    if (order.notes)
      article.append(el('p', `Observações: ${order.notes}`, 'order-notes'));
    const footer = el('div', undefined, 'order-ticket-total');
    footer.append(
      el('span', 'Total do pedido'),
      el('strong', formatPrice(order.totalCents)),
    );
    article.append(footer);
    const action = nextAction(order);
    if (action) {
      const controls = el('div', undefined, 'order-actions');
      for (const [status, label] of [action, ['cancelled', 'Cancelar']]) {
        const button = el(
          'button',
          label,
          status === 'cancelled' ? 'secondary order-cancel' : 'button',
        );
        button.type = 'button';
        button.setAttribute('aria-label', `${label} · ${order.number}`);
        button.addEventListener('click', async () => {
          if (busy) return;
          if (
            status === 'cancelled' &&
            !confirm(
              `Cancelar o pedido ${order.number} de ${order.customerName}? Esta ação encerra o pedido.`,
            )
          )
            return;
          busy = true;
          controls.querySelectorAll('button').forEach((node) => {
            node.disabled = true;
          });
          error('');
          try {
            await api(`/orders/${order.id}/status`, {
              method: 'PATCH',
              body: { status, version: order.version },
            });
            notice(`${order.number}: ${statusLabels[status]}.`);
            await refresh();
            const updated = [...$('#ops-orders').children].find(
              (node) => node.dataset.orderId === order.id,
            );
            (
              updated?.querySelector('button') || $('#ops-order-refresh')
            ).focus();
          } catch (e) {
            if (e.status === 409) await refresh();
            error(e.message);
          } finally {
            busy = false;
            controls.querySelectorAll('button').forEach((node) => {
              node.disabled = false;
            });
          }
        });
        controls.append(button);
      }
      article.append(controls);
    }
    return article;
  }
  async function refresh({ background = false } = {}) {
    if (
      background &&
      (busy ||
        document.hidden ||
        $('#orders-panel').contains(document.activeElement))
    )
      return;
    const current = ++revision;
    $('#ops-orders').setAttribute('aria-busy', 'true');
    if (!background) $('#ops-order-count').textContent = 'Carregando pedidos…';
    try {
      const params = new URLSearchParams({
        view,
        q: $('#orders-search').value.trim(),
        page: String(page),
      });
      const data = await api(`/orders/dashboard?${params}`);
      if (current !== revision) return;
      page = data.page;
      error('');
      const count = data.counts;
      $('#orders-new-count').textContent = count.awaiting_confirmation;
      $('#orders-preparing-count').textContent =
        count.accepted + count.preparing;
      $('#orders-dispatch-count').textContent =
        count.out_for_delivery + count.ready_for_pickup;
      $('#orders-completed-count').textContent = count.completed;
      $('#ops-orders').replaceChildren(...data.orders.map(card));
      $('#orders-empty').hidden = data.orders.length > 0;
      $('#ops-order-count').textContent =
        `${data.total} ${data.total === 1 ? 'pedido encontrado' : 'pedidos encontrados'} · Página ${data.page} de ${data.pages}`;
      $('#orders-page').textContent = `${data.page} / ${data.pages}`;
      $('#orders-prev').disabled = page <= 1;
      $('#orders-next').disabled = page >= data.pages;
      $('#orders-updated').textContent =
        `Atualizado às ${new Date().toLocaleTimeString('pt-BR')} · atualização automática a cada 15 s enquanto você não estiver interagindo com o painel.`;
    } catch (e) {
      if (current === revision) {
        error(`Não foi possível atualizar os pedidos. ${e.message}`);
        $('#ops-order-count').textContent =
          'Atualização pendente. Use Atualizar pedidos para tentar novamente.';
      }
    } finally {
      if (current === revision)
        $('#ops-orders').setAttribute('aria-busy', 'false');
    }
  }
  $('#ops-order-refresh').addEventListener('click', () => refresh());
  $('#orders-search').addEventListener('input', () => {
    revision++;
    page = 1;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refresh, 300);
  });
  document.querySelectorAll('[data-order-view]').forEach((button) =>
    button.addEventListener('click', () => {
      view = button.dataset.orderView;
      page = 1;
      document
        .querySelectorAll('[data-order-view]')
        .forEach((node) =>
          node.setAttribute('aria-pressed', String(node === button)),
        );
      refresh();
    }),
  );
  $('#orders-prev').addEventListener('click', () => {
    if (page > 1) {
      page--;
      refresh();
    }
  });
  $('#orders-next').addEventListener('click', () => {
    page++;
    refresh();
  });
  return { refresh };
}
