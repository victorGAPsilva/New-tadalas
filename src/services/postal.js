import { fail } from './product-validation.js';

export function createPostalService({
  fetchImpl = globalThis.fetch,
  now = Date.now,
} = {}) {
  const cache = new Map(),
    pending = new Map();
  return {
    async lookup(value) {
      if (typeof value !== 'string' || !/^\d{5}-?\d{3}$/.test(value))
        throw fail('Informe um CEP com 8 dígitos.');
      const cep = value.replace('-', '');
      const cached = cache.get(cep);
      if (cached?.expires > now()) return cached.data;
      if (pending.has(cep)) return pending.get(cep);
      if (pending.size >= 6)
        throw fail(
          'Consulta de CEP ocupada. Tente novamente em instantes.',
          429,
        );
      const task = (async () => {
        let data;
        try {
          const response = await fetchImpl(
            `https://viacep.com.br/ws/${cep}/json/`,
            {
              signal: AbortSignal.timeout(5000),
              redirect: 'error',
              headers: { Accept: 'application/json' },
            },
          );
          if (!response.ok) throw new Error('ViaCEP unavailable');
          data = await response.json();
        } catch {
          throw fail(
            'Não foi possível consultar o CEP. Preencha o endereço manualmente ou tente novamente.',
            503,
          );
        }
        if (data?.erro === true || data?.erro === 'true')
          throw fail(
            'CEP não encontrado. Confira ou preencha o endereço manualmente.',
            404,
          );
        if (
          !data ||
          typeof data !== 'object' ||
          typeof data.cep !== 'string' ||
          data.cep.replace('-', '') !== cep ||
          !['logradouro', 'bairro', 'localidade', 'uf'].every(
            (key) => typeof data[key] === 'string' && data[key].length <= 150,
          ) ||
          !data.localidade ||
          !/^[A-Z]{2}$/.test(data.uf)
        )
          throw fail(
            'Resposta de CEP indisponível. Preencha o endereço manualmente.',
            503,
          );
        const address = {
          postalCode: data.cep,
          street: data.logradouro.trim(),
          neighborhood: data.bairro.trim(),
          city: data.localidade.trim(),
          state: data.uf,
        };
        for (const [key, entry] of cache)
          if (entry.expires <= now()) cache.delete(key);
        if (cache.size >= 256) cache.delete(cache.keys().next().value);
        cache.set(cep, { data: address, expires: now() + 24 * 60 * 60 * 1000 });
        return address;
      })();
      pending.set(cep, task);
      try {
        return await task;
      } finally {
        pending.delete(cep);
      }
    },
  };
}
