const invalid = (message) => Object.assign(new Error(message), { status: 400 });
export function selectionKey(id, selections = {}, removed = []) {
  const groups = Object.keys(selections)
    .sort()
    .filter((key) => selections[key].length)
    .map((key) => [key, [...selections[key]].sort()]);
  const exclusions = [...removed].sort();
  return groups.length || exclusions.length
    ? `${id}:${JSON.stringify([groups, exclusions])}`
    : id;
}
export function priceLine(product, input = {}) {
  const selections = input.selections || {},
    removed = input.removed || [];
  if (
    typeof selections !== 'object' ||
    Array.isArray(selections) ||
    !Array.isArray(removed) ||
    removed.length > 40 ||
    new Set(removed).size !== removed.length ||
    removed.some((i) => !product.ingredients?.includes(i))
  )
    throw invalid('Confira os ingredientes removidos.');
  const groups = product.optionGroups || [];
  if (Object.keys(selections).some((id) => !groups.some((g) => g.id === id)))
    throw invalid('Uma personalização não está mais disponível.');
  let priceCents = product.priceCents;
  const optionsDescription = [];
  const normalized = {};
  for (const group of groups) {
    const ids = selections[group.id] || [];
    if (
      !Array.isArray(ids) ||
      new Set(ids).size !== ids.length ||
      ids.length < group.min ||
      ids.length > group.max
    )
      throw invalid(
        `Escolha de ${group.min} a ${group.max} opções em ${group.name}.`,
      );
    normalized[group.id] = [...ids].sort();
    for (const id of ids) {
      const option = group.options.find((o) => o.id === id);
      if (!option || !option.available)
        throw invalid(`Uma opção de ${group.name} está indisponível.`);
      priceCents += option.priceCents;
      optionsDescription.push(`${group.name}: ${option.name}`);
    }
  }
  if (removed.length) optionsDescription.push(`Sem: ${removed.join(', ')}`);
  return {
    priceCents,
    selections: normalized,
    removed: [...removed].sort(),
    optionsDescription,
    key: selectionKey(product.id, normalized, removed),
  };
}
