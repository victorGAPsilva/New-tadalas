import { optionEditor } from './option-editor.js';
import { initOperations } from './operations.js';
import { el } from '/js/components/dom.js';
import { formatPrice } from '/js/cart.js';
const $ = (selector) => document.querySelector(selector);
const optionsEditor = optionEditor($('#option-editor'));
$('#add-option-group').addEventListener('click', optionsEditor.add);
let csrfToken,
  products = [],
  categories = [],
  editing,
  deleting,
  noticeTimer;
function lock() {
  csrfToken = null;
  products = [];
  categories = [];
  document.querySelectorAll('dialog[open]').forEach((dialog) => dialog.close());
  window.location.replace('/admin/login/?expired=1');
}
async function api(
  path,
  { method = 'GET', body, file, authProbe = false } = {},
) {
  const response = await fetch(`/api/admin${path}`, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(method !== 'GET'
        ? {
            'Content-Type': file?.type || 'application/json',
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
          }
        : {}),
    },
    ...(method !== 'GET' ? { body: file || JSON.stringify(body || {}) } : {}),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== '/login' && !authProbe) {
      lock();
    }
    throw new Error(
      result.error?.message || 'Não foi possível concluir a operação.',
    );
  }
  return result.data;
}
function notice(text) {
  clearTimeout(noticeTimer);
  $('#admin-notice').textContent = text;
  noticeTimer = setTimeout(() => ($('#admin-notice').textContent = ''), 4500);
}
function activate(session) {
  csrfToken = session.csrfToken;
  $('#account-name').textContent = session.username;
  $('#admin-loading').hidden = true;
  $('#dashboard').hidden = false;
}
async function refresh() {
  $('#dashboard-error').textContent = '';
  try {
    [products, categories] = await Promise.all([
      api('/products'),
      api('/categories'),
    ]);
    for (const id of ['product-category', 'category-filter']) {
      const select = $(`#${id}`),
        previous = select.value;
      select.replaceChildren();
      if (id === 'category-filter') {
        const option = el('option', 'Todas as categorias');
        option.value = '';
        select.append(option);
      }
      for (const category of categories) {
        const option = el('option', category.name);
        option.value = category.id;
        select.append(option);
      }
      if ([...select.options].some((option) => option.value === previous))
        select.value = previous;
    }
    render();
  } catch (error) {
    $('#dashboard-error').textContent = error.message;
  }
}
function render() {
  $('#stat-total').textContent = products.length;
  $('#stat-available').textContent = products.filter((p) => p.available).length;
  $('#stat-featured').textContent = products.filter((p) => p.featured).length;
  $('#stat-categories').textContent = new Set(
    products.map((p) => p.category),
  ).size;
  const query = $('#search').value.trim().toLocaleLowerCase('pt-BR');
  const category = $('#category-filter').value,
    status = $('#status-filter').value;
  const filtered = products.filter(
    (p) =>
      `${p.name} ${p.description}`.toLocaleLowerCase('pt-BR').includes(query) &&
      (!category || p.category === category) &&
      (!status || p.available === (status === 'available')),
  );
  const rows = $('#product-rows');
  rows.replaceChildren();
  $('#result-count').textContent =
    `${filtered.length} de ${products.length} produtos`;
  $('#empty-state').hidden = products.length > 0;
  $('.table-scroll').hidden = !products.length;
  for (const product of filtered) {
    const row = el('tr'),
      cell = el('td'),
      content = el('div', undefined, 'product-cell');
    const photo = product.image
      ? el('img')
      : el('span', 'SEM FOTO', 'product-photo-placeholder');
    if (product.image) {
      photo.src = product.image;
      photo.alt = '';
      photo.width = 60;
      photo.height = 60;
      photo.loading = 'lazy';
    }
    const name = el('div');
    name.append(el('strong', product.name));
    if (product.featured) name.append(el('small', 'Em destaque'));
    content.append(photo, name);
    cell.append(content);
    const statusCell = el('td');
    statusCell.append(
      el(
        'span',
        product.available ? 'Disponível' : 'Indisponível',
        `badge${product.available ? ' available' : ''}`,
      ),
    );
    const actions = el('td'),
      buttons = el('div', undefined, 'row-actions');
    const edit = el('button', 'Editar', 'secondary');
    edit.type = 'button';
    edit.setAttribute('aria-label', `Editar ${product.name}`);
    edit.addEventListener('click', () => openEditor(product));
    const remove = el('button', 'Excluir', 'secondary');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Excluir ${product.name}`);
    remove.addEventListener('click', () => {
      deleting = product;
      $('#delete-description').textContent =
        `Você vai excluir “${product.name}”.`;
      $('#delete-error').textContent = '';
      $('#delete-dialog').showModal();
    });
    buttons.append(edit, remove);
    actions.append(buttons);
    row.append(
      cell,
      el(
        'td',
        categories.find((c) => c.id === product.category)?.name ||
          product.category,
      ),
      el('td', formatPrice(product.priceCents)),
      statusCell,
      actions,
    );
    rows.append(row);
  }
}
function preview(image) {
  $('#photo-preview').hidden = !image;
  $('#remove-photo').hidden = !image;
  if (image) $('#photo-preview').src = image;
  else $('#photo-preview').removeAttribute('src');
}
let currentImage = null;
function openEditor(product) {
  editing = product ? { ...product } : null;
  $('#product-form').reset();
  optionsEditor.load(product?.optionGroups || []);
  $('#editor-error').textContent = '';
  $('#editor-title').textContent = product
    ? 'EDITAR PRODUTO.'
    : 'NOVO PRODUTO.';
  $('#product-id').value = product?.id || '';
  $('#product-name').value = product?.name || '';
  $('#product-description').value = product?.description || '';
  $('#product-price').value = product
    ? (product.priceCents / 100).toFixed(2).replace('.', ',')
    : '';
  $('#product-category').value = product?.category || categories[0]?.id || '';
  $('#product-ingredients').value = product?.ingredients.join('\n') || '';
  $('#product-notes').value = product?.notes || '';
  $('#product-available').checked = product?.available ?? true;
  $('#product-featured').checked = product?.featured ?? false;
  currentImage = product?.image || null;
  preview(currentImage);
  $('#product-editor').showModal();
}
$('#logout').addEventListener('click', async () => {
  try {
    await api('/logout', { method: 'POST' });
    window.location.replace('/admin/login/');
  } catch (error) {
    notice(error.message);
  }
});
$('#new-product').addEventListener('click', () => openEditor());
$('#refresh').addEventListener('click', refresh);
for (const id of ['search', 'category-filter', 'status-filter'])
  $(`#${id}`).addEventListener(id === 'search' ? 'input' : 'change', render);
document.querySelectorAll('[data-close]').forEach((button) =>
  button.addEventListener('click', () => {
    if (!$('#save-product').disabled)
      document.getElementById(button.dataset.close).close();
  }),
);
$('#product-editor').addEventListener('cancel', (event) => {
  if ($('#save-product').disabled) event.preventDefault();
});
$('#remove-photo').addEventListener('click', () => {
  currentImage = null;
  $('#product-photo').value = '';
  preview(null);
});
$('#product-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#save-product').disabled = true;
  $('#editor-error').textContent = '';
  try {
    const file = $('#product-photo').files[0];
    if (file) {
      if (
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 3 * 1024 * 1024
      )
        throw new Error('Use uma foto PNG, JPEG ou WebP de até 3 MB.');
      currentImage = (await api('/uploads', { method: 'POST', file })).image;
      $('#product-photo').value = '';
      preview(currentImage);
    }
    const value = $('#product-price').value.trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(value))
      throw new Error('Informe um preço válido, como 29,90.');
    const [whole, decimal = ''] = value.split('.');
    const body = {
      name: $('#product-name').value,
      description: $('#product-description').value,
      priceCents: Number(whole) * 100 + Number(decimal.padEnd(2, '0')),
      category: $('#product-category').value,
      ingredients: $('#product-ingredients')
        .value.split('\n')
        .map((i) => i.trim())
        .filter(Boolean),
      notes: $('#product-notes').value,
      optionGroups: optionsEditor.read(),
      available: $('#product-available').checked,
      featured: $('#product-featured').checked,
      image: currentImage,
      ...(editing ? { version: editing.version || 0 } : {}),
    };
    await api(editing ? `/products/${editing.id}` : '/products', {
      method: editing ? 'PUT' : 'POST',
      body,
    });
    $('#product-editor').close();
    notice(
      editing
        ? 'Produto atualizado no cardápio.'
        : 'Produto cadastrado no cardápio.',
    );
    await refresh();
  } catch (error) {
    $('#editor-error').textContent = error.message;
  } finally {
    $('#save-product').disabled = false;
  }
});
$('#confirm-delete').addEventListener('click', async () => {
  $('#confirm-delete').disabled = true;
  $('#delete-error').textContent = '';
  try {
    await api(`/products/${deleting.id}`, {
      method: 'DELETE',
      body: { version: deleting.version || 0 },
    });
    $('#delete-dialog').close();
    notice('Produto excluído do cardápio.');
    await refresh();
  } catch (error) {
    $('#delete-error').textContent = error.message;
  } finally {
    $('#confirm-delete').disabled = false;
  }
});
async function init() {
  try {
    activate(await api('/session', { authProbe: true }));
    await refresh();
  } catch {
    window.location.replace('/admin/login/');
  }
}
initOperations({ api, notice, onCategoriesChanged: refresh });
init();
