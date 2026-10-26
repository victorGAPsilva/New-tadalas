import { el } from './components/dom.js';
import { formatPrice } from './cart.js';
import { priceLine } from './order-model.js';
export function productOptions(product, container, onChange) {
  container.replaceChildren();
  for (const group of product.optionGroups || []) {
    const fieldset = el('fieldset', undefined, 'option-group');
    fieldset.append(
      el('legend', `${group.name} · escolha ${group.min} a ${group.max}`),
    );
    for (const option of group.options) {
      const label = el('label', undefined, 'option-row'),
        input = el('input');
      input.type = 'checkbox';
      input.dataset.group = group.id;
      input.value = option.id;
      input.disabled = !option.available;
      input.addEventListener('change', onChange);
      label.append(
        input,
        el(
          'span',
          `${option.name} ${option.priceCents ? '+ ' + formatPrice(option.priceCents) : '· incluso'}${!option.available ? ' (indisponível)' : ''}`,
        ),
      );
      fieldset.append(label);
    }
    container.append(fieldset);
  }
  if (product.ingredients.length) {
    const fieldset = el('fieldset', undefined, 'option-group');
    fieldset.append(el('legend', 'Retirar ingredientes (opcional)'));
    for (const ingredient of product.ingredients) {
      const label = el('label', undefined, 'option-row'),
        input = el('input');
      input.type = 'checkbox';
      input.dataset.remove = 'true';
      input.value = ingredient;
      input.addEventListener('change', onChange);
      label.append(input, el('span', `Sem ${ingredient}`));
      fieldset.append(label);
    }
    container.append(fieldset);
  }
  return () => {
    const selections = {},
      removed = [];
    container.querySelectorAll('input:checked').forEach((input) => {
      if (input.dataset.remove) removed.push(input.value);
      else (selections[input.dataset.group] ??= []).push(input.value);
    });
    return { selections, removed };
  };
}
export function selectedPrice(product, selection) {
  try {
    return formatPrice(priceLine(product, selection).priceCents);
  } catch {
    return 'Selecione as opções obrigatórias';
  }
}
