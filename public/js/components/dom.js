export function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function productImage(product) {
  if (!product.image)
    return el('div', 'Fotografia em breve', 'product-placeholder');
  const image = el('img');
  image.src = product.image;
  image.alt = product.name;
  image.width = 640;
  image.height = 480;
  image.loading = 'lazy';
  image.addEventListener(
    'error',
    () =>
      image.replaceWith(
        el('div', 'Fotografia indisponível', 'product-placeholder'),
      ),
    { once: true },
  );
  return image;
}
