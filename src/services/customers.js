import { randomUUID } from 'node:crypto';
import { openStore } from './database.js';
import { hashPassword } from './auth.js';
import { fail } from './product-validation.js';
export function customerService(directory, store = openStore(directory)) {
  let pending = Promise.resolve();
  let queued = 0;
  return {
    async find(email) {
      return store.list('customers').find((c) => c.email === email);
    },
    findById: (id) => store.get('customers', id),
    async register(input) {
      const email =
        typeof input?.email === 'string'
          ? input.email.trim().toLowerCase()
          : '';
      const name = typeof input?.name === 'string' ? input.name.trim() : '';
      const password = input?.password;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100)
        throw fail('Informe um e-mail válido, com até 100 caracteres.');
      if (!name || name.length > 80)
        throw fail('Informe seu nome, com até 80 caracteres.');
      if (
        typeof password !== 'string' ||
        password.length < 12 ||
        password.length > 128
      )
        throw fail('Sua senha deve ter de 12 a 128 caracteres.');
      if (queued >= 3)
        throw fail('Cadastro ocupado. Tente novamente em instantes.', 429);
      queued++;
      const task = pending.then(async () => {
        const customers = store.list('customers');
        if (customers.some((c) => c.email === email))
          throw fail(
            'Não foi possível cadastrar esse e-mail. Se você já tem conta, entre com sua senha.',
            409,
          );
        if (customers.length >= 10000)
          throw fail('Cadastro temporariamente indisponível.', 429);
        const account = {
          id: randomUUID(),
          name,
          email,
          ...(await hashPassword(password)),
          createdAt: new Date().toISOString(),
        };
        store.put('customers', account.id, account);
        return { id: account.id, name, email };
      });
      pending = task.catch(() => {});
      return task.finally(() => {
        queued--;
      });
    },
  };
}
