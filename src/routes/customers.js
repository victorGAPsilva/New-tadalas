import { Router } from 'express';
import { fail } from '../services/product-validation.js';
import { randomUUID } from 'node:crypto';
import { validateAddress } from '../services/orders.js';
export function customerRouter({ customers, auth, store, orders, mail }) {
  const router = Router(),
    attempts = new Map();
  router.use((req, _res, next) => {
    if (req.method !== 'GET') {
      const origin = req.get('Origin');
      if (
        req.get('Sec-Fetch-Site') === 'cross-site' ||
        (origin && origin !== `${req.protocol}://${req.get('host')}`)
      )
        return next(fail('Origem não permitida.', 403));
      if (!req.is('application/json'))
        return next(fail('Envie os dados em JSON.', 415));
    }
    next();
  });
  router.get('/session', (req, res) => {
    const session = auth.session(req);
    res.json({
      data: session
        ? {
            ...session,
            emailVerified: Boolean(
              customers.findById(session.customerId)?.emailVerifiedAt,
            ),
            emailEnabled: mail.status().configured,
          }
        : null,
    });
  });
  router.get('/capabilities', (_req, res) =>
    res.json({ data: { emailEnabled: mail.status().configured } }),
  );
  const recoveryAttempts = new Map();
  function recoveryLimit(req) {
    const now = Date.now();
    for (const [key, a] of recoveryAttempts)
      if (a.until <= now) recoveryAttempts.delete(key);
    const a = recoveryAttempts.get(req.ip) || {
      count: 0,
      until: now + 15 * 60 * 1000,
    };
    if (a.count >= 5 || recoveryAttempts.size > 10000)
      throw fail('Muitas tentativas. Aguarde 15 minutos.', 429);
    a.count++;
    recoveryAttempts.set(req.ip, a);
  }
  router.post('/forgot-password', (req, res) => {
    recoveryLimit(req);
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : '';
    res.status(202).json({ data: mail.request(email, 'reset') });
  });
  router.post('/reset-password', async (req, res) => {
    recoveryLimit(req);
    res.json({ data: await mail.reset(req.body?.token, req.body?.password) });
  });
  router.post('/verify-email', (req, res) => {
    recoveryLimit(req);
    res.json({ data: mail.verify(req.body?.token) });
  });
  router.post('/register', async (req, res) => {
    const now = Date.now();
    for (const [ip, attempt] of attempts)
      if (attempt.until <= now) attempts.delete(ip);
    const attempt = attempts.get(req.ip) || {
      count: 0,
      until: now + 15 * 60 * 1000,
    };
    if (attempt.count >= 5 || attempts.size >= 10000) {
      res.set('Retry-After', '900');
      throw fail('Muitas tentativas de cadastro. Aguarde 15 minutos.', 429);
    }
    attempt.count++;
    attempts.set(req.ip, attempt);
    const customer = await customers.register(req.body);
    if (mail.status().configured) mail.request(customer.email, 'verify');
    res.status(201).json({ data: { created: true } });
  });
  router.post('/login', async (req, res) => {
    req.body = {
      username:
        typeof req.body?.email === 'string'
          ? req.body.email.trim().toLowerCase()
          : '',
      password: req.body?.password,
    };
    res.json({ data: await auth.login(req, res) });
  });
  router.post('/logout', auth.requireSession, (req, res) => {
    auth.logout(req, res);
    res.json({ data: { loggedOut: true } });
  });
  router.use(auth.requireSession);
  router.post('/resend-verification', (req, res) => {
    recoveryLimit(req);
    res
      .status(202)
      .json({ data: mail.request(req.adminSession.username, 'verify') });
  });
  router.get('/orders', (req, res) =>
    res.json({ data: orders.listCustomer(req.adminSession.customerId) }),
  );
  router.post('/orders/:id/reorder', (req, res) =>
    res.json({
      data: orders.reorder(req.adminSession.customerId, req.params.id),
    }),
  );
  router.get('/addresses', (req, res) =>
    res.json({
      data: store
        .list('addresses')
        .filter((a) => a.customerId === req.adminSession.customerId),
    }),
  );
  function saveAddress(req, id) {
    const existing = id && store.get('addresses', id);
    if (
      id &&
      (!existing || existing.customerId !== req.adminSession.customerId)
    )
      throw fail('Endereço não encontrado.', 404);
    const owned = store
      .list('addresses')
      .filter((a) => a.customerId === req.adminSession.customerId);
    if (!id && owned.length >= 5) throw fail('Salve até cinco endereços.');
    const label =
      typeof req.body?.label === 'string' ? req.body.label.trim() : '';
    if (!label || label.length > 50) throw fail('Dê um nome ao endereço.');
    const address = {
      ...validateAddress(req.body),
      id: id || randomUUID(),
      customerId: req.adminSession.customerId,
      label,
    };
    return store.put('addresses', address.id, address);
  }
  router.post('/addresses', (req, res) =>
    res.status(201).json({ data: saveAddress(req) }),
  );
  router.put('/addresses/:id', (req, res) =>
    res.json({ data: saveAddress(req, req.params.id) }),
  );
  router.delete('/addresses/:id', (req, res) => {
    const address = store.get('addresses', req.params.id);
    if (!address || address.customerId !== req.adminSession.customerId)
      throw fail('Endereço não encontrado.', 404);
    store.remove('addresses', address.id);
    res.json({ data: { deleted: true } });
  });
  router.use((_req, res) =>
    res.status(404).json({ error: { message: 'Endpoint não encontrado.' } }),
  );
  return router;
}
