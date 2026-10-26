import test from 'node:test';
import assert from 'node:assert/strict';
import { carouselSlides } from '../public/js/carousel-data.js';
test('carrossel seleciona hambúrgueres e combos disponíveis e prioriza destaques', () => {
  const products = [
    { id: 'drink', name: 'Bebida', category: 'bebidas', available: true },
    {
      id: 'combo',
      name: 'Combo',
      category: 'combos',
      available: true,
      featured: false,
      image: '/assets/images/combo.jpg',
    },
    {
      id: 'gone',
      name: 'Indisponível',
      category: 'hamburgueres',
      available: false,
    },
    {
      id: 'burger',
      name: 'Burguér & especial',
      category: 'hamburgueres',
      available: true,
      featured: true,
      image: null,
    },
  ];
  const slides = carouselSlides(products);
  assert.equal(slides.length, 2);
  assert.equal(slides[0].title, 'Burguér & especial');
  assert.equal(slides[0].illustrative, true);
  assert.match(slides[0].image, /burguer-illustrative\.jpg$/);
  assert.equal(slides[1].image, '/assets/images/combo.jpg');
  assert.equal(slides[1].illustrative, false);
  assert.equal(
    new URL(slides[1].href, 'http://localhost').searchParams.get('produto'),
    'combo',
  );
  assert.equal(products[0].id, 'drink');
});
test('carrossel tem fallback ilustrativo sem ofertas inventadas e limita slides', () => {
  const fallback = carouselSlides([]);
  assert.equal(fallback.length, 2);
  assert.ok(fallback.every((s) => s.illustrative && s.href === '/cardapio/'));
  const many = Array.from({ length: 20 }, (_, i) => ({
    id: `burger-${i}`,
    name: `Produto ${i}`,
    category: 'hamburgueres',
    available: true,
  }));
  assert.equal(carouselSlides(many).length, 8);
});
