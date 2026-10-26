import { request } from './api.js';
import { el } from './components/dom.js';
import { formatPrice } from './cart.js';
export function initCheckout({ getItems, getConfig, toast }) {
  const $ = (s) => document.querySelector(s);
  let session = null,
    quote = null,
    timer,
    revision = 0,
    idempotencyKey = crypto.randomUUID();
  let lastFingerprint;
  const fields = [
    'street',
    'number',
    'neighborhood',
    'city',
    'complement',
    'postalCode',
  ];
  function input() {
    return {
      items: getItems(),
      notes: $('#order-notes').value,
      customerName: $('#checkout-name').value.trim(),
      fulfillment: {
        method: $('#fulfillment-method').value,
        zoneId: $('#delivery-zone').value,
        address: Object.fromEntries(
          fields.map((key) => [key, $(`#address-${key}`).value]),
        ),
      },
      payment: {
        method: $('#payment-method').value,
        changeForCents:
          $('#payment-method').value === 'cash' && $('#change-for').value
            ? Math.round(Number($('#change-for').value.replace(',', '.')) * 100)
            : null,
      },
    };
  }
  async function calculate() {
    const current = ++revision;
    quote = null;
    $('#checkout').disabled = true;
    if (!getItems().length) return;
    if (getConfig()?.demoMode) {
      $('#checkout-error').textContent =
        'Demonstração local: pedidos não podem ser enviados.';
      return;
    }
    try {
      const result = await request('/orders/quote', {
        method: 'POST',
        body: JSON.stringify(input()),
      });
      if (current !== revision) return;
      quote = result;
      $('#delivery-total').textContent = formatPrice(result.deliveryFeeCents);
      $('#order-total').textContent = formatPrice(result.totalCents);
      $('#checkout-error').textContent = '';
      $('#checkout').disabled = false;
    } catch (error) {
      if (current === revision)
        $('#checkout-error').textContent = error.message;
    }
  }
  function changed() {
    const fingerprint = JSON.stringify(input());
    if (fingerprint !== lastFingerprint) {
      idempotencyKey = crypto.randomUUID();
      lastFingerprint = fingerprint;
    }
    quote = null;
    revision++;
    $('#checkout').disabled = true;
    clearTimeout(timer);
    timer = setTimeout(calculate, 250);
  }
  function visibility() {
    const delivery = $('#fulfillment-method').value === 'delivery';
    $('#delivery-fields').hidden = !delivery;
    $('#pickup-address').hidden = delivery;
    $('#cash-fields').hidden = $('#payment-method').value !== 'cash';
    for (const key of ['street', 'number', 'neighborhood', 'city'])
      $(`#address-${key}`).required = delivery;
  }
  $('#checkout-details').addEventListener('input', () => {
    visibility();
    changed();
  });
  $('#checkout-details').addEventListener('change', () => {
    visibility();
    changed();
  });
  $('#order-notes').addEventListener('input', changed);
  $('#saved-address').addEventListener('change', () => {
    const saved = JSON.parse(
      $('#saved-address').selectedOptions[0]?.dataset.address || 'null',
    );
    if (saved)
      for (const key of fields) $(`#address-${key}`).value = saved[key] || '';
    changed();
  });
  $('#delivery-zone').addEventListener('change', () => {
    const zone = getConfig()?.deliveryZones?.find(
      (z) => z.id === $('#delivery-zone').value,
    );
    if (zone) $('#address-neighborhood').value = zone.name;
    changed();
  });
  $('#checkout').addEventListener('click', async () => {
    if (!$('#checkout-name').reportValidity()) return;
    const invalid = [
      ...document.querySelectorAll('#cart-dialog input, #cart-dialog select'),
    ].find((node) => !node.closest('[hidden]') && !node.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    if (!quote) {
      await calculate();
      return;
    }
    const button = $('#checkout');
    const payload = input(),
      priced = quote,
      requestKey = idempotencyKey;
    const controls = [
      ...document.querySelectorAll(
        '#cart-dialog input, #cart-dialog select, #cart-dialog textarea, #cart-dialog button',
      ),
    ]
      .filter((node) => !node.hasAttribute('data-close'))
      .map((node) => ({ node, disabled: node.disabled }));
    controls.forEach(({ node }) => {
      node.disabled = true;
    });
    button.disabled = true;
    try {
      const currentSession = await request('/customer/session');
      session = currentSession;
      const order = await request('/orders', {
        method: 'POST',
        headers: session ? { 'X-CSRF-Token': session.csrfToken } : {},
        body: JSON.stringify({
          ...payload,
          expectedTotalCents: priced.totalCents,
          idempotencyKey: requestKey,
        }),
      });
      toast(`Pedido ${order.number} registrado. Confirme no WhatsApp.`);
      window.location.assign(order.whatsappUrl);
    } catch (error) {
      if (error.status === 409) {
        idempotencyKey = crypto.randomUUID();
        await calculate();
      }
      $('#checkout-error').textContent = error.message;
    } finally {
      controls.forEach(({ node, disabled }) => {
        node.disabled = disabled;
      });
      button.disabled = !quote;
    }
  });
  return {
    changed,
    async configure(config) {
      const status = $('#store-status');
      status.textContent = config.status?.message || 'Consulte o atendimento';
      status.classList.toggle('store-closed', config.status?.open === false);
      const modes = $('#fulfillment-method');
      modes.replaceChildren();
      for (const [id, name, enabled] of [
        ['pickup', 'Retirada na loja', config.pickupEnabled],
        ['delivery', 'Entrega', config.deliveryEnabled],
      ])
        if (enabled) {
          const o = el('option', name);
          o.value = id;
          modes.append(o);
        }
      $('#pickup-address').textContent =
        config.address ||
        'O endereço de retirada será confirmado pelo atendimento.';
      $('#estimate').textContent = config.estimatedMinutes
        ? `Estimativa informada pela loja: ${config.estimatedMinutes} minutos.`
        : '';
      const zones = $('#delivery-zone');
      zones.replaceChildren(el('option', 'Selecione uma região'));
      zones.firstChild.value = '';
      for (const z of config.deliveryZones || []) {
        const o = el('option', `${z.name} · ${formatPrice(z.feeCents)}`);
        o.value = z.id;
        zones.append(o);
      }
      const payment = $('#payment-method');
      payment.replaceChildren();
      for (const id of config.paymentMethods || ['pix', 'cash', 'card']) {
        const o = el(
          'option',
          { pix: 'Pix', cash: 'Dinheiro', card: 'Cartão' }[id],
        );
        o.value = id;
        payment.append(o);
      }
      visibility();
      try {
        session = await request('/customer/session');
        if (session) {
          $('#checkout-name').value = session.displayName;
          const addresses = await request('/customer/addresses');
          if (addresses.length) {
            $('#saved-address-field').hidden = false;
            for (const address of addresses) {
              const o = el('option', address.label);
              o.value = address.id;
              o.dataset.address = JSON.stringify(address);
              $('#saved-address').append(o);
            }
          }
        }
      } catch {
        /* Guest checkout remains available. */
      }
      changed();
    },
  };
}
