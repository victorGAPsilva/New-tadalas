import { createCatalog } from '../src/services/catalog.js';

const marker = 'CATALOGO_FICTICIO_TADALAS_V1';
const catalog = createCatalog();

const products = [
  {
    name: '[TESTE] Smash Tadalas',
    description:
      'Pão brioche, carne smash, cheddar cremoso, alface, tomate e molho da casa.',
    priceCents: 2990,
    category: 'hamburgueres',
    available: true,
    featured: true,
    ingredients: [
      'Pão brioche',
      'Carne smash',
      'Cheddar',
      'Alface',
      'Tomate',
      'Molho da casa',
    ],
    image: '/assets/images/burger-cutout-illustrative.webp',
    notes: `${marker} · Produto fictício para teste.`,
    optionGroups: [
      {
        id: 'adicionais-smash',
        name: 'Adicionais',
        min: 0,
        max: 2,
        options: [
          {
            id: 'bacon',
            name: 'Bacon crocante',
            priceCents: 500,
            available: true,
          },
          {
            id: 'carne-extra',
            name: 'Carne extra',
            priceCents: 900,
            available: true,
          },
          {
            id: 'cheddar-extra',
            name: 'Cheddar extra',
            priceCents: 400,
            available: true,
          },
        ],
      },
    ],
  },
  {
    name: '[TESTE] Brasa Duplo',
    description:
      'Dois smash burgers, cheddar em dobro, cebola caramelizada e molho defumado.',
    priceCents: 3890,
    category: 'hamburgueres',
    available: true,
    featured: false,
    ingredients: [
      'Pão brioche',
      'Duas carnes smash',
      'Cheddar',
      'Cebola caramelizada',
      'Molho defumado',
    ],
    image: '/assets/images/burger-cutout-illustrative.webp',
    notes: `${marker} · Produto fictício para teste.`,
    optionGroups: [],
  },
  {
    name: '[TESTE] Combo Atitude',
    description:
      'Smash Tadalas, porção de batata crocante e uma bebida à sua escolha.',
    priceCents: 4590,
    category: 'combos',
    available: true,
    featured: true,
    ingredients: ['Smash Tadalas', 'Batata crocante', 'Bebida'],
    image: '/assets/images/hero-meal-illustrative.webp',
    notes: `${marker} · Produto fictício para teste.`,
    optionGroups: [
      {
        id: 'bebida-combo',
        name: 'Escolha a bebida',
        min: 1,
        max: 1,
        options: [
          {
            id: 'cola',
            name: 'Refrigerante cola',
            priceCents: 0,
            available: true,
          },
          {
            id: 'guarana',
            name: 'Refrigerante guaraná',
            priceCents: 0,
            available: true,
          },
          {
            id: 'limonada',
            name: 'Limonada da casa',
            priceCents: 300,
            available: true,
          },
        ],
      },
    ],
  },
  {
    name: '[TESTE] Batata Crocante',
    description: 'Batatas douradas e crocantes, finalizadas com sal da casa.',
    priceCents: 1490,
    category: 'acompanhamentos',
    available: true,
    featured: false,
    ingredients: ['Batata', 'Sal da casa'],
    image: '/assets/images/fries-cutout-illustrative.webp',
    notes: `${marker} · Produto fictício para teste.`,
    optionGroups: [],
  },
  {
    name: '[TESTE] Batata Cheddar & Bacon',
    description:
      'Batata crocante coberta com cheddar cremoso e bacon em cubos.',
    priceCents: 2190,
    category: 'acompanhamentos',
    available: true,
    featured: false,
    ingredients: ['Batata', 'Cheddar', 'Bacon'],
    image: '/assets/images/fries-cutout-illustrative.webp',
    notes: `${marker} · Produto fictício para teste.`,
    optionGroups: [],
  },
  {
    name: '[TESTE] Cola Gelada',
    description: 'Refrigerante sabor cola servido bem gelado.',
    priceCents: 800,
    category: 'bebidas',
    available: true,
    featured: false,
    ingredients: [],
    image: '/assets/images/drink-cutout-illustrative.webp',
    notes: `${marker} · Produto fictício para teste.`,
    optionGroups: [],
  },
  {
    name: '[TESTE] Limonada da Casa',
    description: 'Limonada refrescante preparada com limão e gelo.',
    priceCents: 1000,
    category: 'bebidas',
    available: true,
    featured: false,
    ingredients: ['Limão', 'Água', 'Açúcar', 'Gelo'],
    image: '/assets/images/drink-cutout-illustrative.webp',
    notes: `${marker} · Produto fictício para teste.`,
    optionGroups: [],
  },
];

const existing = await catalog.products();
const existingNames = new Set(
  existing
    .filter((product) => product.notes?.includes(marker))
    .map((product) => product.name),
);
const created = [];

for (const product of products) {
  if (existingNames.has(product.name)) continue;
  created.push(await catalog.createProduct(product));
}

console.log(
  created.length
    ? `${created.length} produtos fictícios adicionados ao catálogo.`
    : 'Os produtos fictícios já estavam cadastrados; nenhuma duplicação foi criada.',
);
