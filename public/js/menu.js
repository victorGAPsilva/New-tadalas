import { el } from './components/dom.js';
import { formatPrice } from './cart.js';
import { animateElement, revealElements } from './motion.js';

function visual(product) {
  const media = el('div', undefined, 'menu-visual');
  function placeholder() {
    media.classList.add('menu-visual-placeholder');
    const logo = el('img');
    logo.src = '/assets/images/tadalas-logo.png';
    logo.alt = '';
    logo.width = 240;
    logo.height = 240;
    logo.loading = 'lazy';
    media.replaceChildren(logo, el('span', 'FOTO EM BREVE', 'menu-photo-note'));
  }
  if (product.image) {
    const img = el('img');
    img.src = product.image;
    img.alt = product.name;
    img.width = 720;
    img.height = 540;
    img.loading = 'lazy';
    img.addEventListener('error', placeholder, { once: true });
    media.append(img);
  } else placeholder();
  return media;
}

function productCard(product, category, onSelect, onAdd, spotlight = false) {
  const card = el(
    'article',
    undefined,
    spotlight ? 'menu-feature' : 'product-card',
  );
  card.classList.toggle('is-unavailable', !product.available);
  const mediaButton = el('button', undefined, 'menu-media-button');
  mediaButton.type = 'button';
  mediaButton.setAttribute(
    'aria-label',
    `Ver foto e detalhes de ${product.name}`,
  );
  mediaButton.addEventListener('click', () => onSelect(product));
  mediaButton.append(visual(product));
  const media = el('div', undefined, 'menu-card-media');
  media.append(mediaButton);
  if (product.featured && !spotlight)
    media.append(el('span', 'EM DESTAQUE', 'menu-card-badge'));
  if (!product.available)
    media.append(
      el('span', 'INDISPONÍVEL', 'menu-card-badge unavailable-badge'),
    );
  const content = el('div', undefined, 'menu-card-content');
  const label = el(
    'p',
    spotlight ? 'EM DESTAQUE / TADALAS' : category,
    'menu-card-kicker',
  );
  const heading = el('h3', product.name);
  const description = el('p', product.description, 'menu-card-description');
  const price = el(
    'strong',
    formatPrice(product.priceCents),
    'menu-card-price',
  );
  const details = el(
    'button',
    'Ver ingredientes e detalhes ↗',
    'menu-details-button',
  );
  details.type = 'button';
  details.setAttribute('aria-label', `Ver detalhes de ${product.name}`);
  details.addEventListener('click', () => onSelect(product));
  const bottom = el('div', undefined, 'menu-card-bottom');
  bottom.append(price);
  const add = el(
    'button',
    product.available
      ? product.optionGroups?.length
        ? 'Montar pedido'
        : 'Adicionar'
      : 'Indisponível',
    'button menu-add',
  );
  add.type = 'button';
  add.disabled = !product.available;
  add.setAttribute(
    'aria-label',
    product.available && product.optionGroups?.length
      ? `Escolher opções de ${product.name}`
      : `${product.available ? 'Adicionar' : 'Indisponível:'} ${product.name}${product.available ? ' ao carrinho' : ''}`,
  );
  const plus = el('span', '+');
  plus.setAttribute('aria-hidden', 'true');
  if (product.available) add.append(plus);
  add.addEventListener('click', () => {
    if (!onAdd) return onSelect(product);
    const added = onAdd(product);
    if (added) {
      animateElement(add, [
        { backgroundColor: '#ffe1c4', transform: 'scale(.96)' },
        { backgroundColor: '#ff6a00', transform: 'scale(1)' },
      ]);
    }
  });
  bottom.append(add);
  content.append(label, heading, description, details, bottom);
  card.append(media, content);
  return card;
}

export function renderMenu(products, categories, onSelect, onAdd) {
  const $ = (selector) => document.querySelector(selector);
  const grid = $('#products'),
    controls = $('#categories'),
    spotlight = $('#menu-spotlight');
  let category = 'all';
  const search = $('#menu-search'),
    available = $('#menu-available');
  // Rebinding replaces previous callbacks after a catalog refresh.
  search.value = '';
  available.checked = false;
  $('#menu-status').hidden = products.length > 0;
  $('#menu-tools').hidden = !products.length;
  $('#menu-results-heading').hidden = !products.length;
  $('#menu-order-note').hidden = !products.length;
  controls.replaceChildren();
  const buttons = [];
  let stopReveals = () => {};
  const nameOf = (id) => categories.find((c) => c.id === id)?.name || '';
  const normalize = (value) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR');
  function render() {
    stopReveals();
    const query = normalize(search.value.trim());
    const filtered = [...products]
      .sort((a, b) => Number(b.featured) - Number(a.featured))
      .filter(
        (p) =>
          (category === 'all' || p.category === category) &&
          (!available.checked || p.available) &&
          normalize(
            [p.name, p.description, ...(p.ingredients || [])].join(' '),
          ).includes(query),
      );
    const featured =
      !query && category === 'all' && !available.checked
        ? filtered.find((p) => p.featured && p.available)
        : null;
    spotlight.replaceChildren();
    spotlight.hidden = !featured;
    if (featured)
      spotlight.append(
        productCard(featured, nameOf(featured.category), onSelect, onAdd, true),
      );
    grid.replaceChildren();
    for (const product of filtered.filter((p) => p !== featured))
      grid.append(
        productCard(product, nameOf(product.category), onSelect, onAdd),
      );
    grid.hidden = !grid.children.length;
    $('#menu-no-results').hidden = !products.length || filtered.length > 0;
    $('#menu-category-title').textContent =
      category === 'all'
        ? 'DO SEU JEITO.'
        : nameOf(category).toLocaleUpperCase('pt-BR') + '.';
    $('#menu-result-count').textContent =
      `${filtered.length} ${filtered.length === 1 ? 'opção no cardápio' : 'opções no cardápio'}`;
    buttons.forEach(({ button, id }) =>
      button.setAttribute('aria-pressed', String(category === id)),
    );
    stopReveals = revealElements([...spotlight.children, ...grid.children]);
  }
  if (products.length)
    for (const c of [{ id: 'all', name: 'Tudo na mesa' }, ...categories]) {
      const button = el('button', undefined, 'category-button');
      button.type = 'button';
      const count = products.filter(
        (p) => c.id === 'all' || p.category === c.id,
      ).length;
      button.append(
        el('span', c.name),
        el('span', String(count), 'category-count'),
      );
      button.addEventListener('click', () => {
        category = c.id;
        render();
      });
      buttons.push({ button, id: c.id });
      controls.append(button);
    }
  search.oninput = render;
  available.onchange = render;
  $('#menu-reset').onclick = () => {
    category = 'all';
    search.value = '';
    available.checked = false;
    render();
    search.focus();
  };
  render();
}
