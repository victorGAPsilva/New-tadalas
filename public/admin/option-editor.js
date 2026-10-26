import { el } from '/js/components/dom.js';
export function optionEditor(container) {
  function field(label, value, type = 'text') {
    const wrap = el('label', label),
      input = el('input');
    input.type = type;
    input.value = value;
    wrap.append(input);
    return { wrap, input };
  }
  function optionRow(
    group,
    option = {
      id: crypto.randomUUID(),
      name: '',
      priceCents: 0,
      available: true,
    },
  ) {
    const row = el('div', undefined, 'option-editor-row');
    row.dataset.option = option.id;
    const name = field('Nome da opção', option.name),
      price = field(
        'Valor adicional em R$',
        (option.priceCents / 100).toFixed(2).replace('.', ','),
      );
    price.input.inputMode = 'decimal';
    const available = field('Disponível', '', 'checkbox');
    available.input.checked = option.available;
    available.wrap.className = 'ops-checkbox';
    const remove = el('button', 'Remover opção', 'secondary');
    remove.type = 'button';
    remove.addEventListener('click', () => row.remove());
    row.append(name.wrap, price.wrap, available.wrap, remove);
    row.read = () => ({
      id: option.id,
      name: name.input.value,
      priceCents: Math.round(Number(price.input.value.replace(',', '.')) * 100),
      available: available.input.checked,
    });
    group.append(row);
  }
  function groupRow(
    group = { id: crypto.randomUUID(), name: '', min: 0, max: 1, options: [] },
  ) {
    const box = el('div', undefined, 'option-editor-group');
    box.dataset.group = group.id;
    const name = field('Nome do grupo (ex.: Adicionais ou Bebida)', group.name),
      min = field('Mínimo de escolhas', group.min, 'number'),
      max = field('Máximo de escolhas', group.max, 'number');
    min.input.min = '0';
    max.input.min = '1';
    const limits = el('div', undefined, 'ops-grid');
    limits.append(min.wrap, max.wrap);
    box.append(name.wrap, limits);
    const rows = el('div');
    for (const option of group.options) optionRow(rows, option);
    box.append(rows);
    const add = el('button', '+ Adicionar opção', 'secondary');
    add.type = 'button';
    add.addEventListener('click', () => optionRow(rows));
    const remove = el('button', 'Remover grupo', 'secondary');
    remove.type = 'button';
    remove.addEventListener('click', () => box.remove());
    const actions = el('div', undefined, 'ops-row');
    actions.append(add, remove);
    box.append(actions);
    box.read = () => ({
      id: group.id,
      name: name.input.value,
      min: Number(min.input.value),
      max: Number(max.input.value),
      options: [...rows.children].map((row) => row.read()),
    });
    container.append(box);
  }
  return {
    load(groups = []) {
      container.replaceChildren();
      groups.forEach(groupRow);
    },
    add: () => groupRow(),
    read: () => [...container.children].map((box) => box.read()),
  };
}
