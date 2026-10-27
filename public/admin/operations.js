import { el } from '/js/components/dom.js';
import { formatPrice } from '/js/cart.js';
export const statusLabels = {
  awaiting_confirmation: 'Aguardando confirmação',
  accepted: 'Aceito',
  preparing: 'Em preparo',
  out_for_delivery: 'Saiu para entrega',
  ready_for_pickup: 'Pronto para retirada',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};
const next = {
  awaiting_confirmation: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'ready_for_pickup', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'],
  ready_for_pickup: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
export function initOperations({ api, notice, onCategoriesChanged }) {
  const $ = (s) => document.querySelector(s);
  let settings,
    active = 'catalog',
    poll;
  const error = (message) => ($('#ops-error').textContent = message);
  async function loadOrders() {
    try {
      const orders = await api(
          `/orders?status=${encodeURIComponent($('#ops-status').value)}`,
        ),
        list = $('#ops-orders');
      list.replaceChildren();
      $('#ops-order-count').textContent =
        `${orders.length} pedidos exibidos (até os 100 mais recentes)`;
      if (!orders.length)
        list.append(el('p', 'Nenhum pedido para este filtro.', 'muted'));
      for (const order of orders) {
        const card = el('article', undefined, 'ops-card');
        card.append(
          el('h3', `${order.number} · ${statusLabels[order.status]}`),
          el(
            'p',
            `${order.customerName} · ${new Date(order.createdAt).toLocaleString('pt-BR')} · ${order.fulfillment.method === 'delivery' ? 'Entrega' : 'Retirada'}`,
          ),
        );
        const ul = el('ul');
        for (const item of order.items)
          ul.append(
            el(
              'li',
              `${item.quantity}x ${item.name} · ${formatPrice(item.priceCents * item.quantity)}${item.optionsDescription?.length ? ' — ' + item.optionsDescription.join('; ') : ''}`,
            ),
          );
        card.append(
          ul,
          el(
            'p',
            `Total: ${formatPrice(order.totalCents)} · Entrega: ${formatPrice(order.deliveryFeeCents)}`,
          ),
        );
        if (order.fulfillment.address)
          card.append(
            el(
              'p',
              `Endereço: ${Object.values(order.fulfillment.address).filter(Boolean).join(', ')} · ${order.fulfillment.zoneName}`,
            ),
          );
        card.append(
          el(
            'p',
            `Pagamento: ${{ pix: 'Pix', cash: 'Dinheiro', card: 'Cartão' }[order.payment.method]}${order.payment.changeForCents ? ' · troco para ' + formatPrice(order.payment.changeForCents) : ''}`,
          ),
        );
        if (order.notes) card.append(el('p', `Observações: ${order.notes}`));
        const allowed = next[order.status].filter(
          (status) =>
            !(
              (status === 'out_for_delivery' &&
                order.fulfillment.method !== 'delivery') ||
              (status === 'ready_for_pickup' &&
                order.fulfillment.method !== 'pickup')
            ),
        );
        if (allowed.length) {
          const row = el('div', undefined, 'ops-row'),
            select = el('select');
          select.setAttribute('aria-label', `Novo status de ${order.number}`);
          for (const value of allowed) {
            const o = el('option', statusLabels[value]);
            o.value = value;
            select.append(o);
          }
          const button = el('button', 'Atualizar status', 'button');
          button.type = 'button';
          button.addEventListener('click', async () => {
            button.disabled = true;
            try {
              await api(`/orders/${order.id}/status`, {
                method: 'PATCH',
                body: { status: select.value, version: order.version },
              });
              notice('Status atualizado.');
              await loadOrders();
            } catch (e) {
              error(e.message);
              button.disabled = false;
            }
          });
          row.append(select, button);
          card.append(row);
        }
        list.append(card);
      }
    } catch (e) {
      error(e.message);
    }
  }
  function scheduleRow(slot = { day: 0, open: '', close: '' }) {
    const row = el('div', undefined, 'ops-row'),
      day = el('select');
    [
      'Domingo',
      'Segunda',
      'Terça',
      'Quarta',
      'Quinta',
      'Sexta',
      'Sábado',
    ].forEach((name, i) => {
      const o = el('option', name);
      o.value = i;
      day.append(o);
    });
    day.value = slot.day;
    day.setAttribute('aria-label', 'Dia da semana');
    const open = el('input'),
      close = el('input');
    open.type = close.type = 'time';
    open.value = slot.open;
    close.value = slot.close;
    open.setAttribute('aria-label', 'Abertura');
    close.setAttribute('aria-label', 'Fechamento');
    const remove = el('button', 'Remover', 'secondary');
    remove.type = 'button';
    remove.addEventListener('click', () => row.remove());
    row.append(day, open, close, remove);
    row.read = () => ({
      day: Number(day.value),
      open: open.value,
      close: close.value,
    });
    $('#ops-schedule').append(row);
  }
  function zoneRow(zone = { id: crypto.randomUUID(), name: '', feeCents: 0 }) {
    const row = el('div', undefined, 'ops-row'),
      name = el('input'),
      fee = el('input');
    name.value = zone.name;
    name.placeholder = 'Bairro / região atendida';
    name.setAttribute('aria-label', 'Nome da região');
    fee.value = (zone.feeCents / 100).toFixed(2).replace('.', ',');
    fee.inputMode = 'decimal';
    fee.setAttribute('aria-label', 'Taxa de entrega em reais');
    const remove = el('button', 'Remover', 'secondary');
    remove.type = 'button';
    remove.addEventListener('click', () => row.remove());
    row.append(name, fee, remove);
    row.read = () => ({
      id: zone.id,
      name: name.value,
      feeCents: Math.round(Number(fee.value.replace(',', '.')) * 100),
    });
    $('#ops-zones').append(row);
  }
  async function loadSettings() {
    try {
      settings = await api('/settings');
      for (const key of [
        'brand',
        'whatsappNumber',
        'instagramUrl',
        'address',
        'openingHours',
        'timezone',
        'estimatedMinutes',
        'logoUrl',
      ])
        $(`#setting-${key}`).value = settings[key] ?? '';
      $('#ops-logo-preview').src =
        settings.logoUrl || '/assets/images/tadalas-logo.png';
      $('#setting-storeMode').value = settings.storeMode;
      $('#setting-deliveryPricing').value = settings.deliveryPricing || 'zones';
      $('#ops-delivery-status').textContent = settings.deliveryRouteConfigured
        ? 'Serviço de rotas configurado.'
        : 'Frete por km pendente: configure GOOGLE_ROUTES_API_KEY no ambiente do servidor. A entrega por distância fica indisponível ao cliente até essa configuração.';
      for (const key of ['manualOpen', 'pickupEnabled', 'deliveryEnabled'])
        $(`#setting-${key}`).checked = settings[key];
      for (const m of ['pix', 'cash', 'card'])
        $(`#setting-payment-${m}`).checked =
          settings.paymentMethods.includes(m);
      $('#ops-schedule').replaceChildren();
      settings.schedule.forEach(scheduleRow);
      $('#ops-zones').replaceChildren();
      settings.deliveryZones.forEach(zoneRow);
      $('#ops-mail-status').textContent = settings.emailStatus.configured
        ? 'Envio de e-mail configurado.'
        : `Envio de e-mail pendente: configure ${settings.emailStatus.missing.join(', ')} no .env do servidor.`;
    } catch (e) {
      error(e.message);
    }
  }
  async function loadCategories() {
    try {
      const categories = await api('/categories'),
        list = $('#ops-categories');
      list.replaceChildren();
      for (const category of categories) {
        const row = el('div', undefined, 'ops-row'),
          input = el('input');
        input.value = category.name;
        input.maxLength = 60;
        input.setAttribute('aria-label', 'Nome da categoria');
        const save = el('button', 'Salvar', 'secondary'),
          remove = el('button', 'Excluir', 'secondary');
        save.type = remove.type = 'button';
        save.addEventListener('click', async () => {
          try {
            await api(`/categories/${category.id}`, {
              method: 'PUT',
              body: { name: input.value },
            });
            notice('Categoria atualizada.');
            await onCategoriesChanged();
          } catch (e) {
            error(e.message);
          }
        });
        remove.addEventListener('click', async () => {
          if (!confirm(`Excluir a categoria “${category.name}”?`)) return;
          try {
            await api(`/categories/${category.id}`, { method: 'DELETE' });
            await loadCategories();
            await onCategoriesChanged();
          } catch (e) {
            error(e.message);
          }
        });
        row.append(input, save, remove);
        list.append(row);
      }
    } catch (e) {
      error(e.message);
    }
  }
  document.querySelectorAll('[data-admin-panel]').forEach((button) =>
    button.addEventListener('click', () => {
      active = button.dataset.adminPanel;
      error('');
      document
        .querySelectorAll('[data-admin-panel]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      $('#catalog-panel').hidden = active !== 'catalog';
      $('#orders-panel').hidden = active !== 'orders';
      $('#settings-panel').hidden = active !== 'settings';
      $('#categories-panel').hidden = active !== 'categories';
      if (active === 'orders') loadOrders();
      if (active === 'settings') loadSettings();
      if (active === 'categories') loadCategories();
    }),
  );
  $('#ops-order-refresh').addEventListener('click', loadOrders);
  $('#ops-status').addEventListener('change', loadOrders);
  $('#ops-add-schedule').addEventListener('click', () => scheduleRow());
  $('#ops-add-zone').addEventListener('click', () => zoneRow());
  $('#ops-category-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api('/categories', {
        method: 'POST',
        body: { name: $('#ops-category-name').value },
      });
      $('#ops-category-name').value = '';
      await loadCategories();
      await onCategoriesChanged();
    } catch (e) {
      error(e.message);
    }
  });
  $('#ops-logo-file').addEventListener('change', async () => {
    const file = $('#ops-logo-file').files[0];
    if (!file) return;
    try {
      if (file.size > 3 * 1024 * 1024)
        throw new Error('A imagem deve ter até 3 MB.');
      $('#setting-logoUrl').value = (
        await api('/uploads', { method: 'POST', file })
      ).image;
      $('#ops-logo-preview').src = $('#setting-logoUrl').value;
      notice('Imagem enviada. Salve as configurações para aplicar.');
    } catch (e) {
      error(e.message);
    }
  });
  $('#ops-settings-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    error('');
    const button = $('#ops-save-settings');
    button.disabled = true;
    try {
      const body = { version: settings.version };
      for (const key of [
        'brand',
        'whatsappNumber',
        'instagramUrl',
        'address',
        'openingHours',
        'timezone',
        'estimatedMinutes',
        'logoUrl',
      ])
        body[key] = $(`#setting-${key}`).value;
      for (const key of ['manualOpen', 'pickupEnabled', 'deliveryEnabled'])
        body[key] = $(`#setting-${key}`).checked;
      body.storeMode = $('#setting-storeMode').value;
      body.deliveryPricing = $('#setting-deliveryPricing').value;
      body.schedule = [...$('#ops-schedule').children].map((r) => r.read());
      body.deliveryZones = [...$('#ops-zones').children].map((r) => r.read());
      body.paymentMethods = ['pix', 'cash', 'card'].filter(
        (m) => $(`#setting-payment-${m}`).checked,
      );
      await api('/settings', { method: 'PUT', body });
      notice('Configurações aplicadas.');
      await loadSettings();
    } catch (e) {
      error(e.message);
    } finally {
      button.disabled = false;
    }
  });
  poll = setInterval(() => {
    if (
      active === 'orders' &&
      !document.hidden &&
      !$('#orders-panel').contains(document.activeElement)
    )
      loadOrders();
  }, 15000);
  window.addEventListener('pagehide', () => clearInterval(poll));
  return { refresh: loadOrders };
}
