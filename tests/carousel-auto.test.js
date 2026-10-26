import test from 'node:test';
import assert from 'node:assert/strict';
import { initHeroCarousel } from '../public/js/hero-carousel.js';

test('carrossel avança a cada 4 segundos e continua após navegação manual', (t) => {
  class Element {
    children = [];
    listeners = {};
    attributes = {};
    addEventListener(name, callback) {
      this.listeners[name] = callback;
    }
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
    append(child) {
      this.children.push(child);
    }
    replaceChildren() {
      this.children = [];
    }
    contains() {
      return false;
    }
  }
  const selectors = [
    'carousel-image',
    'carousel-prev',
    'carousel-next',
    'carousel-pause',
    'carousel-dots',
    'carousel-title',
    'carousel-category',
    'carousel-link',
    'carousel-illustrative',
    'carousel-position',
    'carousel-slide',
    'carousel-status',
  ];
  const nodes = Object.fromEntries(
    selectors.map((id) => [`#${id}`, new Element()]),
  );
  const root = new Element();
  root.querySelector = (selector) => nodes[selector];
  const previous = Object.fromEntries(
    ['document', 'matchMedia', 'IntersectionObserver', 'window'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  globalThis.document = {
    querySelector: () => root,
    createElement: () => new Element(),
    hidden: false,
    addEventListener: () => {},
  };
  globalThis.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
  });
  globalThis.IntersectionObserver = class {
    observe() {}
  };
  globalThis.window = { IntersectionObserver: globalThis.IntersectionObserver };
  t.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    initHeroCarousel();
    assert.equal(nodes['#carousel-title'].textContent, 'HAMBÚRGUERES.');
    t.mock.timers.tick(4000);
    assert.equal(nodes['#carousel-title'].textContent, 'COMBOS.');
    nodes['#carousel-next'].listeners.click();
    assert.equal(nodes['#carousel-title'].textContent, 'HAMBÚRGUERES.');
    t.mock.timers.tick(4000);
    assert.equal(nodes['#carousel-title'].textContent, 'COMBOS.');
    nodes['#carousel-pause'].listeners.click();
    t.mock.timers.tick(8000);
    assert.equal(nodes['#carousel-title'].textContent, 'COMBOS.');
    nodes['#carousel-pause'].listeners.click();
    t.mock.timers.tick(4000);
    assert.equal(nodes['#carousel-title'].textContent, 'HAMBÚRGUERES.');
  } finally {
    t.mock.timers.reset();
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
