import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defaultDataDirectory } from './storage.js';
import { openStore } from './database.js';
import { settingsService } from './settings.js';
import { validateProduct, fail } from './product-validation.js';
const dataUrl = new URL('../data/', import.meta.url);
const read = async (file) =>
  JSON.parse(await readFile(new URL(file, dataUrl), 'utf8'));
export function createCatalog({
  demo = false,
  whatsappNumber,
  dataDirectory = fileURLToPath(defaultDataDirectory),
  store = openStore(dataDirectory),
  now,
  deliveryReady,
} = {}) {
  const repository = {
    list: () => store.list('products'),
    mutate(operation) {
      return store.transaction(() => {
        const items = store.list('products');
        const result = operation(items);
        store.replace('products', items);
        return result;
      });
    },
  };
  const settings = settingsService(store, {
    whatsappNumber,
    now,
    deliveryReady,
  });
  const assertEditable = () => {
    if (demo)
      throw fail(
        'Desative o modo demonstrativo para administrar o catálogo real.',
        409,
      );
  };
  async function products() {
    const items = demo
      ? await read('products.demo.json')
      : await repository.list();
    const categories = store.list('categories');
    const ids = new Set();
    for (const p of items) {
      if (
        !/^[a-z0-9-]+$/.test(p.id) ||
        ids.has(p.id) ||
        typeof p.name !== 'string' ||
        !p.name.trim() ||
        typeof p.description !== 'string' ||
        !Number.isSafeInteger(p.priceCents) ||
        p.priceCents < 0 ||
        typeof p.available !== 'boolean' ||
        !categories.some((c) => c.id === p.category) ||
        !Array.isArray(p.ingredients) ||
        !p.ingredients.every((i) => typeof i === 'string') ||
        (p.image && !/^\/assets\/[a-zA-Z0-9/_.-]+$/.test(p.image))
      ) {
        throw new Error(
          'Cadastro de produtos inválido. Revise os dados locais.',
        );
      }
      ids.add(p.id);
    }
    return items;
  }
  return {
    products,
    allCategories: async () => store.list('categories'),
    async createProduct(input) {
      assertEditable();
      const data = validateProduct(input, store.list('categories'));
      return repository.mutate((items) => {
        if (items.length >= 1000)
          throw fail('O catálogo atingiu o limite de 1.000 produtos.');
        const product = {
          ...data,
          id: randomUUID(),
          version: 1,
          updatedAt: new Date().toISOString(),
        };
        items.push(product);
        return product;
      });
    },
    async updateProduct(id, input) {
      assertEditable();
      const data = validateProduct(input, store.list('categories'));
      return repository.mutate((items) => {
        const index = items.findIndex((p) => p.id === id);
        if (index < 0) throw fail('Produto não encontrado.', 404);
        if (
          !Number.isInteger(input.version) ||
          input.version !== (items[index].version || 0)
        )
          throw fail(
            'Este produto mudou em outra sessão. Atualize a lista antes de editar.',
            409,
          );
        const product = {
          ...data,
          id,
          version: input.version + 1,
          updatedAt: new Date().toISOString(),
        };
        items[index] = product;
        return product;
      });
    },
    async deleteProduct(id, version) {
      assertEditable();
      return repository.mutate((items) => {
        const index = items.findIndex((p) => p.id === id);
        if (index < 0) throw fail('Produto não encontrado.', 404);
        if (
          !Number.isInteger(version) ||
          version !== (items[index].version || 0)
        )
          throw fail(
            'Este produto mudou. Atualize a lista antes de excluir.',
            409,
          );
        items.splice(index, 1);
      });
    },
    async categories() {
      const items = await products();
      return store
        .list('categories')
        .filter((c) => items.some((p) => p.category === c.id));
    },
    async config() {
      return { ...settings.public(), demoMode: demo };
    },
    async createCategory(input) {
      const name = typeof input?.name === 'string' ? input.name.trim() : '';
      if (!name || name.length > 60)
        throw fail('Informe um nome de categoria com até 60 caracteres.');
      const category = { id: randomUUID(), name };
      store.put('categories', category.id, category);
      return category;
    },
    async updateCategory(id, input) {
      const current = store.get('categories', id);
      if (!current) throw fail('Categoria não encontrada.', 404);
      const name = typeof input?.name === 'string' ? input.name.trim() : '';
      if (!name || name.length > 60) throw fail('Nome de categoria inválido.');
      return store.put('categories', id, { id, name });
    },
    async deleteCategory(id) {
      if (store.list('products').some((p) => p.category === id))
        throw fail('Mova ou exclua os produtos desta categoria primeiro.', 409);
      if (!store.get('categories', id))
        throw fail('Categoria não encontrada.', 404);
      store.remove('categories', id);
    },
  };
}
