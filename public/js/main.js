import { priceLine } from './order-model.js';
import { productOptions, selectedPrice } from './product-options.js';
import { initCheckout } from './checkout.js';
import { closeMenu } from './navigation.js';
import { request } from './api.js';
import {
  addItem,
  removeItem,
  setQuantity,
  subtotal,
  formatPrice,
  restoreCart,
} from './cart.js';
import { renderMenu } from './menu.js?v=2.0.0';
import { el, productImage } from './components/dom.js';
const $ = (selector) => document.querySelector(selector);
let products = [],
  items = [],
  config,
  selectedProduct,
  toastTimer,
  cartKey = 'tadalas-cart-v1';
let readSelection = () => ({});
const checkout = initCheckout({
  getItems: () => items,
  getConfig: () => config,
  toast,
});
document
  .querySelectorAll('[data-close]')
  .forEach((button) =>
    button.addEventListener('click', () =>
      document.getElementById(button.dataset.close).close(),
    ),
  );
document.querySelectorAll('dialog').forEach((dialog) =>
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        dialog.close();
    }
  }),
);
$('#year').textContent = new Date().getFullYear();
function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.add('active');
  toastTimer = setTimeout(() => $('#toast').classList.remove('active'), 3500);
}
function save(render = true) {
  try {
    localStorage.setItem(
      cartKey,
      JSON.stringify({ updatedAt: Date.now(), items }),
    );
  } catch {
    toast('Pedido mantido nesta página. Armazenamento local indisponível.');
  }
  if (render) renderCart();
  else updateTotals();
}
function updateTotals() {
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  $('#cart-count').textContent = count;
  $('#open-cart').setAttribute(
    'aria-label',
    `Abrir carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`,
  );
  const total = formatPrice(subtotal(items, products));
  $('#cart-total').textContent = total;
  $('#cart-bar-total').textContent = total;
  $('#cart-bar-count').textContent =
    `${count} ${count === 1 ? 'item' : 'itens'}`;
  $('#cart-bar').hidden = !count;
  document.body.classList.toggle('has-cart', count > 0);
  $('#checkout-error').textContent = '';
  checkout.changed();
}
function renderCart() {
  updateTotals();
  const list = $('#cart-items');
  list.replaceChildren();
  $('#cart-summary').hidden = !items.length;
  if (!items.length) {
    const empty = el('div', undefined, 'cart-empty');
    empty.append(
      el('h3', 'BATEU A FOME?'),
      el('p', 'Escolha seus favoritos no cardápio para começar seu pedido.'),
    );
    const browse = el('a', 'Explorar cardápio ↗', 'button');
    browse.href = '#cardapio';
    browse.addEventListener('click', () => $('#cart-dialog').close());
    empty.append(browse);
    list.append(empty);
  }
  for (const item of items) {
    const product = products.find((p) => p.id === item.id);
    if (!product) continue;
    const key = item.key || item.id;
    const priced = priceLine(product, item);
    const row = el('div', undefined, 'cart-item');
    const controls = el('div', undefined, 'item-controls');
    const label = el('label', 'Quantidade');
    label.htmlFor = `quantity-${crypto.randomUUID()}`;
    const quantity = el('input');
    quantity.id = label.htmlFor;
    quantity.type = 'number';
    quantity.min = '1';
    quantity.max = '99';
    quantity.step = '1';
    quantity.required = true;
    quantity.value = item.quantity;
    const amount = el('span', formatPrice(priced.priceCents * item.quantity));
    const minus = el('button', '−', 'quantity-step');
    const plus = el('button', '+', 'quantity-step');
    minus.type = plus.type = 'button';
    minus.setAttribute('aria-label', `Diminuir quantidade de ${product.name}`);
    plus.setAttribute('aria-label', `Aumentar quantidade de ${product.name}`);
    function updateQuantity(value) {
      try {
        items = setQuantity(items, key, value);
        quantity.value = value;
        quantity.removeAttribute('aria-invalid');
        amount.textContent = formatPrice(priced.priceCents * value);
        minus.disabled = value <= 1;
        plus.disabled = value >= 99;
        save(false);
      } catch {
        quantity.setAttribute('aria-invalid', 'true');
      }
    }
    minus.disabled = item.quantity <= 1;
    plus.disabled = item.quantity >= 99;
    minus.addEventListener('click', () =>
      updateQuantity(
        (items.find((i) => (i.key || i.id) === key)?.quantity || 1) - 1,
      ),
    );
    plus.addEventListener('click', () =>
      updateQuantity(
        (items.find((i) => (i.key || i.id) === key)?.quantity || 1) + 1,
      ),
    );
    quantity.addEventListener('input', () =>
      updateQuantity(Number(quantity.value)),
    );
    quantity.addEventListener('change', () => {
      if (!quantity.checkValidity()) quantity.reportValidity();
    });
    const remove = el('button', 'Remover');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remover ${product.name}`);
    remove.addEventListener('click', () => {
      items = removeItem(items, key);
      save();
      ($('#cart-items input') || $('#cart-dialog [data-close]')).focus();
    });
    controls.append(label, minus, quantity, plus, remove);
    row.append(
      el('strong', product.name),
      el('p', priced.optionsDescription.join(' · '), 'cart-unit-price'),
      el(
        'p',
        `${formatPrice(priced.priceCents)} por unidade`,
        'cart-unit-price',
      ),
      amount,
      controls,
    );
    list.append(row);
  }
  $('#cart-total').textContent = formatPrice(subtotal(items, products));
  $('#checkout-error').textContent = '';
}
function openCart() {
  closeMenu();
  renderCart();
  $('#cart-dialog').showModal();
}
$('#open-cart').addEventListener('click', openCart);
$('#cart-bar').addEventListener('click', openCart);
function addToCart(product, quantity = 1, selection = {}) {
  items = addItem(items, product, quantity, selection);
  save();
  toast('Adicionado ao carrinho.');
}
function quickAdd(product) {
  if (product.optionGroups?.length) {
    selectProduct(product);
    return;
  }
  try {
    addToCart(product);
  } catch (error) {
    toast(error.message);
  }
}
$('#clear-cart').addEventListener('click', () => {
  items = [];
  save();
  $('#cart-dialog [data-close]').focus();
  toast('Pedido limpo.');
});
function selectProduct(product) {
  selectedProduct = product;
  const detail = $('#product-detail');
  detail.replaceChildren(productImage(product));
  const title = el('h2', product.name);
  title.id = 'product-title';
  detail.append(title, el('p', product.description));
  if (product.ingredients.length)
    detail.append(el('p', `Ingredientes: ${product.ingredients.join(', ')}.`));
  if (product.notes) detail.append(el('p', product.notes));
  const options = el('div', undefined, 'product-options');
  const price = el('strong', formatPrice(product.priceCents));
  const error = el('p', '', 'option-error');
  error.setAttribute('role', 'status');
  detail.append(options, price, error);
  readSelection = productOptions(product, options, () => {
    price.textContent = selectedPrice(product, readSelection());
    error.textContent = '';
  });
  $('#product-quantity').value = 1;
  $('#product-quantity').disabled = !product.available;
  $('#add-form button[type="submit"]').disabled = !product.available;
  $('#product-dialog').showModal();
}
$('#add-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    addToCart(
      selectedProduct,
      Number($('#product-quantity').value),
      readSelection(),
    );
    $('#product-dialog').close();
  } catch (error) {
    $('.option-error').textContent = error.message;
  }
});
function applyConfig(value) {
  config = value;
  $('#demo-banner').hidden = !config.demoMode;
  document.querySelectorAll('.whatsapp-link').forEach((link) => {
    link.href = `https://wa.me/${config.whatsappNumber}`;
  });
  const contactNumber = $('#contact-number');
  if (contactNumber)
    contactNumber.textContent =
      config.whatsappNumber === '5511960217697'
        ? '+55 11 96021-7697'
        : `+${config.whatsappNumber}`;
  if (
    $('#business-details') &&
    config.instagramUrl &&
    /^https:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?$/.test(
      config.instagramUrl,
    )
  ) {
    const link = el('a', 'Instagram ↗', 'text-link');
    link.href = config.instagramUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    $('#business-details').append(link);
  }
  for (const key of ['address', 'openingHours'])
    if (config[key] && $('#business-details'))
      $('#business-details').append(el('p', config[key]));
  if (config.logoUrl && /^\/assets\/[a-zA-Z0-9/_.-]+$/.test(config.logoUrl))
    document.querySelectorAll('.brand').forEach((brand) => {
      const image = el('img');
      image.src = config.logoUrl;
      image.alt = 'TADALAS BURGUER';
      image.width = 96;
      image.height = 96;
      image.addEventListener('load', () => brand.replaceChildren(image), {
        once: true,
      });
    });
  if (
    $('#hero-art') &&
    config.heroImageUrl &&
    /^\/assets\/[a-zA-Z0-9/_.-]+$/.test(config.heroImageUrl)
  ) {
    const image = el('img');
    image.src = config.heroImageUrl;
    image.alt = 'Hambúrguer Tadalas';
    image.width = 720;
    image.height = 820;
    image.fetchPriority = 'high';
    image.addEventListener('load', () => {
      $('#hero-art').removeAttribute('aria-label');
      $('#hero-art').replaceChildren(image);
    });
  }
}
async function load() {
  try {
    const [loadedProducts, categories, publicConfig] = await Promise.all([
      request('/products'),
      request('/categories'),
      request('/config/public'),
    ]);
    products = loadedProducts;
    applyConfig(publicConfig);
    await checkout.configure(publicConfig);
    cartKey = config.demoMode ? 'tadalas-demo-cart-v1' : 'tadalas-cart-v1';
    try {
      items = restoreCart(localStorage, products, cartKey);
    } catch {
      items = [];
    }
    renderMenu(products, categories, selectProduct, quickAdd);
    renderCart();
    const requestedProduct = new URLSearchParams(location.search).get(
      'produto',
    );
    const product =
      requestedProduct && products.find((item) => item.id === requestedProduct);
    if (product) selectProduct(product);
    if (new URLSearchParams(location.search).get('carrinho') === '1')
      openCart();
    try {
      const warning = sessionStorage.getItem('tadalas-reorder-warning');
      if (warning) {
        toast(warning);
        sessionStorage.removeItem('tadalas-reorder-warning');
      }
    } catch {
      /* Optional reorder feedback. */
    }
  } catch {
    const status = $('#menu-status');
    status.replaceChildren(
      el('h3', 'NÃO DEU PARA CARREGAR.'),
      el('p', 'Tente novamente ou fale com a Tadalas pelo WhatsApp.'),
    );
    const retry = el('button', 'Tentar novamente', 'button');
    retry.addEventListener('click', load);
    status.append(retry);
    status.hidden = false;
  }
}
load();
