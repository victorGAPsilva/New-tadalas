const samples = {
  hamburgueres: '/assets/images/carousel-burguer-illustrative.jpg',
  combos: '/assets/images/carousel-combo-illustrative.jpg',
};
export function carouselSlides(products = []) {
  const selected = products
    .filter((p) => p.available && Object.hasOwn(samples, p.category))
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, 8);
  if (!selected.length)
    return [
      {
        title: 'HAMBÚRGUERES.',
        category: 'PRA SUA FOME',
        image: samples.hamburgueres,
        illustrative: true,
        href: '/cardapio/',
      },
      {
        title: 'COMBOS.',
        category: 'A EXPERIÊNCIA COMPLETA',
        image: samples.combos,
        illustrative: true,
        href: '/cardapio/',
      },
    ];
  return selected.map((p) => ({
    title: p.name,
    category: p.category === 'combos' ? 'COMBOS' : 'HAMBÚRGUERES',
    image: p.image || samples[p.category],
    illustrative: !p.image,
    fallbackImage: samples[p.category],
    href: `/cardapio/?produto=${encodeURIComponent(p.id)}#menu-selection`,
  }));
}
