import { request } from './api.js';

const instances = new WeakMap();
export function initPostalCode({
  input,
  button,
  status,
  fields,
  onAddress = () => {},
}) {
  instances.get(input)?.destroy();
  let controller,
    timer,
    revision = 0;
  const valid = () => /^\d{5}-?\d{3}$/.test(input.value.trim());
  function cancel() {
    revision++;
    clearTimeout(timer);
    controller?.abort();
    button.removeAttribute('aria-busy');
    status.textContent = '';
  }
  async function lookup() {
    cancel();
    if (!valid()) {
      status.textContent =
        'Informe um CEP com 8 dígitos para buscar o endereço.';
      return;
    }
    const current = revision,
      cep = input.value.trim();
    const snapshot = Object.fromEntries(
      Object.entries(fields).map(([key, field]) => [key, field.value]),
    );
    controller = new AbortController();
    status.textContent = 'Consultando CEP…';
    button.setAttribute('aria-busy', 'true');
    try {
      const address = await request(`/address/${encodeURIComponent(cep)}`, {
        signal: controller.signal,
      });
      if (current !== revision || input.value.trim() !== cep || input.disabled)
        return;
      if (
        Object.entries(fields).some(
          ([key, field]) => field.value !== snapshot[key],
        )
      ) {
        status.textContent =
          'Você alterou o endereço durante a consulta. Confira os dados ou busque o CEP novamente.';
        return;
      }
      for (const [key, field] of Object.entries(fields))
        field.value = address[key] || '';
      input.value = address.postalCode;
      status.textContent =
        address.street && address.neighborhood
          ? `Endereço encontrado em ${address.city}/${address.state}. Confira os dados e informe o número.`
          : `CEP encontrado em ${address.city}/${address.state}. Complete rua e bairro que não vieram na consulta.`;
      onAddress(address);
    } catch (error) {
      if (current !== revision || error.name === 'AbortError') return;
      status.textContent = error.message;
    } finally {
      if (current === revision) button.removeAttribute('aria-busy');
    }
  }
  function typed() {
    cancel();
    if (valid()) timer = setTimeout(lookup, 500);
  }
  input.addEventListener('input', typed);
  button.addEventListener('click', lookup);
  const instance = {
    cancel,
    destroy() {
      cancel();
      input.removeEventListener('input', typed);
      button.removeEventListener('click', lookup);
    },
  };
  instances.set(input, instance);
  return instance;
}
