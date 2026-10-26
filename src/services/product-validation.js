export const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
export function validateProduct(input, categories) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw fail('Dados de produto inválidos.');
  const text = (key, max, required = false) => {
    if (
      typeof input[key] !== 'string' ||
      input[key].trim().length > max ||
      (required && !input[key].trim())
    )
      throw fail(`Confira o campo ${key}: limite de ${max} caracteres.`);
    return input[key].trim();
  };
  const name = text('name', 100, true);
  const description = text('description', 1000, true);
  if (
    !Number.isSafeInteger(input.priceCents) ||
    input.priceCents < 1 ||
    input.priceCents > 10000000
  )
    throw fail('O preço deve estar entre R$ 0,01 e R$ 100.000,00.');
  if (!categories.some((c) => c.id === input.category))
    throw fail('Selecione uma categoria válida.');
  if (
    typeof input.available !== 'boolean' ||
    typeof input.featured !== 'boolean'
  )
    throw fail('Disponibilidade e destaque devem ser verdadeiros ou falsos.');
  if (
    !Array.isArray(input.ingredients) ||
    input.ingredients.length > 40 ||
    !input.ingredients.every(
      (i) => typeof i === 'string' && i.trim().length > 0 && i.length <= 100,
    )
  )
    throw fail('Informe até 40 ingredientes, com até 100 caracteres cada.');
  const image = input.image || null;
  if (
    image !== null &&
    (typeof image !== 'string' ||
      !/^\/assets\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|avif)$/i.test(
        image,
      ))
  )
    throw fail('Use uma imagem PNG, JPEG, WebP ou AVIF local válida.');
  const notes = input.notes === undefined ? '' : text('notes', 500);
  const optionGroups = input.optionGroups || [];
  if (!Array.isArray(optionGroups) || optionGroups.length > 5)
    throw fail('Cadastre até cinco grupos de personalização.');
  const groupIds = new Set();
  const groups = optionGroups.map((g) => {
    if (
      !g ||
      typeof g.id !== 'string' ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(g.id) ||
      groupIds.has(g.id) ||
      typeof g.name !== 'string' ||
      !g.name.trim() ||
      g.name.length > 80 ||
      !Array.isArray(g.options) ||
      !g.options.length ||
      g.options.length > 20 ||
      !Number.isInteger(g.min) ||
      !Number.isInteger(g.max) ||
      g.min < 0 ||
      g.max < 1 ||
      g.min > g.max ||
      g.max > g.options.length
    )
      throw fail('Confira o nome e os limites dos grupos de personalização.');
    groupIds.add(g.id);
    const ids = new Set();
    return {
      id: g.id,
      name: g.name.trim(),
      min: g.min,
      max: g.max,
      options: g.options.map((o) => {
        if (
          !o ||
          typeof o.id !== 'string' ||
          !/^[a-zA-Z0-9-]{1,80}$/.test(o.id) ||
          ids.has(o.id) ||
          typeof o.name !== 'string' ||
          !o.name.trim() ||
          o.name.length > 80 ||
          !Number.isInteger(o.priceCents) ||
          o.priceCents < 0 ||
          o.priceCents > 1000000 ||
          typeof o.available !== 'boolean'
        )
          throw fail('Confira as opções e os preços adicionais.');
        ids.add(o.id);
        return {
          id: o.id,
          name: o.name.trim(),
          priceCents: o.priceCents,
          available: o.available,
        };
      }),
    };
  });
  return {
    name,
    description,
    priceCents: input.priceCents,
    category: input.category,
    available: input.available,
    featured: input.featured,
    ingredients: input.ingredients.map((i) => i.trim()),
    image,
    notes,
    optionGroups: groups,
  };
}
