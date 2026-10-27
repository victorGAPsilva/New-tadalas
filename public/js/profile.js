import { el } from './components/dom.js';
import { addItem, restoreCart, formatPrice } from './cart.js';
import { initPostalCode } from './postal-code.js';
const labels = {
  awaiting_confirmation: 'Aguardando confirmação',
  accepted: 'Aceito',
  preparing: 'Em preparo',
  out_for_delivery: 'Saiu para entrega',
  ready_for_pickup: 'Pronto para retirada',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};
export function initProfile(session, api) {
  const $ = (s) => document.querySelector(s);
  let editing = null;
  const fields = [
    'label',
    'street',
    'number',
    'neighborhood',
    'city',
    'complement',
    'postalCode',
  ];
  const postal = initPostalCode({
    input: $('#saved-postalCode'),
    button: $('#saved-lookup'),
    status: $('#saved-postal-status'),
    fields: {
      street: $('#saved-street'),
      neighborhood: $('#saved-neighborhood'),
      city: $('#saved-city'),
    },
  });
  function error(message) {
    $('#profile-extra-error').textContent = message;
  }
  $('#email-status').textContent = session.emailVerified
    ? 'E-mail confirmado.'
    : session.emailEnabled
      ? 'Seu e-mail ainda não foi confirmado.'
      : 'Confirmação de e-mail disponível após configurar o serviço de envio.';
  $('#resend-verification').hidden =
    session.emailVerified || !session.emailEnabled;
  $('#resend-verification').onclick = async () => {
    try {
      $('#resend-verification').disabled = true;
      const result = await api('/resend-verification', {});
      $('#email-status').textContent = result.message;
    } catch (e) {
      error(e.message);
    } finally {
      $('#resend-verification').disabled = false;
    }
  };
  async function history() {
    try {
      const orders = await api('/orders'),
        list = $('#customer-orders');
      list.replaceChildren();
      if (!orders.length)
        list.append(
          el(
            'p',
            'Você ainda não tem pedidos registrados nesta conta.',
            'muted',
          ),
        );
      for (const order of orders) {
        const card = el('article', undefined, 'ops-card');
        card.append(
          el('h3', order.number),
          el(
            'p',
            `${labels[order.status]} · ${new Date(order.createdAt).toLocaleString('pt-BR')}`,
          ),
        );
        const ul = el('ul');
        for (const item of order.items)
          ul.append(
            el(
              'li',
              `${item.quantity}x ${item.name}${item.optionsDescription?.length ? ' — ' + item.optionsDescription.join('; ') : ''}`,
            ),
          );
        card.append(
          ul,
          el(
            'p',
            `Total: ${formatPrice(order.totalCents)} · ${order.fulfillment.method === 'delivery' ? 'Entrega' : 'Retirada'}`,
          ),
        );
        const repeat = el(
          'button',
          'Adicionar novamente ao carrinho',
          'button',
        );
        repeat.type = 'button';
        repeat.onclick = async () => {
          repeat.disabled = true;
          try {
            const data = await api(`/orders/${order.id}/reorder`, {});
            if (!data.items.length)
              throw new Error(
                'Os itens deste pedido não estão disponíveis atualmente.',
              );
            let items = restoreCart(localStorage, data.products);
            for (const item of data.items)
              items = addItem(
                items,
                data.products.find((p) => p.id === item.id),
                item.quantity,
                item,
              );
            localStorage.setItem(
              'tadalas-cart-v1',
              JSON.stringify({ items, updatedAt: Date.now() }),
            );
            if (data.warnings.length)
              sessionStorage.setItem(
                'tadalas-reorder-warning',
                data.warnings.join(' '),
              );
            location.assign('/cardapio/?carrinho=1');
          } catch (e) {
            error(e.message);
            repeat.disabled = false;
          }
        };
        card.append(repeat);
        list.append(card);
      }
    } catch (e) {
      error(e.message);
    }
  }
  async function addresses() {
    try {
      const list = $('#customer-addresses'),
        values = await api('/addresses');
      list.replaceChildren();
      for (const address of values) {
        const card = el('article', undefined, 'ops-card');
        card.append(
          el('h3', address.label),
          el(
            'p',
            [
              address.street,
              address.number,
              address.neighborhood,
              address.city,
              address.complement,
              address.postalCode,
            ]
              .filter(Boolean)
              .join(', '),
          ),
        );
        const actions = el('div', undefined, 'profile-actions'),
          edit = el('button', 'Editar', 'logout-button'),
          remove = el('button', 'Excluir', 'logout-button');
        edit.type = remove.type = 'button';
        edit.onclick = () => {
          postal.cancel();
          editing = address.id;
          for (const field of fields)
            $(`#saved-${field}`).value = address[field] || '';
          $('#address-editor-title').textContent = 'EDITAR ENDEREÇO';
          $('#saved-label').focus();
        };
        remove.onclick = async () => {
          if (!confirm(`Excluir o endereço “${address.label}”?`)) return;
          try {
            await api(`/addresses/${address.id}`, {}, 'DELETE');
            await addresses();
          } catch (e) {
            error(e.message);
          }
        };
        actions.append(edit, remove);
        card.append(actions);
        list.append(card);
      }
      if (!values.length)
        list.append(el('p', 'Nenhum endereço salvo.', 'muted'));
    } catch (e) {
      error(e.message);
    }
  }
  $('#address-form').onsubmit = async (event) => {
    event.preventDefault();
    error('');
    const button = $('#save-address');
    button.disabled = true;
    try {
      const body = Object.fromEntries(
        fields.map((field) => [field, $(`#saved-${field}`).value]),
      );
      await api(
        editing ? `/addresses/${editing}` : '/addresses',
        body,
        editing ? 'PUT' : 'POST',
      );
      editing = null;
      postal.cancel();
      $('#address-form').reset();
      $('#address-editor-title').textContent = 'NOVO ENDEREÇO';
      await addresses();
    } catch (e) {
      error(e.message);
    } finally {
      button.disabled = false;
    }
  };
  $('#new-address').onclick = () => {
    postal.cancel();
    editing = null;
    $('#address-form').reset();
    $('#address-editor-title').textContent = 'NOVO ENDEREÇO';
    $('#saved-label').focus();
  };
  $('#refresh-history').onclick = history;
  history();
  addresses();
}
