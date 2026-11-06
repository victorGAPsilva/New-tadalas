import { el } from './components/dom.js';
import { formatPrice } from './cart.js';

// Editorial highlights always use the same live catalog as the ordering page.
export function renderHomeProducts(products, categories) {
  const grid = document.querySelector('#home-products');
  const status = document.querySelector('#home-catalog-status');
  const selected = products
    .filter((product) => product.available)
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, 4);
  grid.replaceChildren();
  grid.hidden = !selected.length;
  status.hidden = Boolean(selected.length);
  if (!selected.length) {
    status.querySelector('h3').textContent = 'Novidades estão a caminho.';
    status.querySelector('p').textContent =
      'Nosso cardápio está sendo preparado. Fale com a gente para saber o que vem por aí.';
    return;
  }
  for (const product of selected) {
    const card = el('a', undefined, 'home-product');
    card.href = `/cardapio/?produto=${encodeURIComponent(product.id)}#menu-selection`;
    const media = el('div', undefined, 'home-product-media');
    const image = el('img');
    image.alt = product.name;
    image.width = 400;
    image.height = 300;
    image.loading = 'lazy';
    function placeholder() {
      media.classList.add('photo-pending');
      image.src = '/assets/images/tadalas-logo.png';
      image.alt = '';
      media.replaceChildren(image, el('span', 'FOTO EM BREVE'));
    }
    if (product.image) {
      image.src = product.image;
      image.addEventListener('error', placeholder, { once: true });
      media.append(image);
    } else placeholder();
    const category =
      categories.find((item) => item.id === product.category)?.name ||
      'Cardápio Tadalas';
    const price = `${product.optionGroups?.some((group) => group.min > 0) ? 'A partir de ' : ''}${formatPrice(product.priceCents)}`;
    card.append(
      media,
      el('p', category),
      el('h3', product.name),
      el('strong', price),
      el('span', 'Escolher meu pedido →'),
    );
    grid.append(card);
  }
}
