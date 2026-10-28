import { Router } from 'express';
import { fail } from '../services/product-validation.js';

export function signInRouter({ store, adminAuth, customerAuth, mail }) {
  const router = Router(),
    attempts = new Map();
  const customerDetails = (session) => ({
    ...session,
    emailVerified: Boolean(
      store.get('customers', session.customerId)?.emailVerifiedAt,
    ),
    emailEnabled: mail.status().configured,
  });
  router.get('/session', (req, res) => {
    const admin = adminAuth.session(req);
    if (admin)
      return res.json({
        data: { ...admin, role: 'admin', redirectTo: '/admin/' },
      });
    const customer = customerAuth.session(req);
    res.json({
      data: customer
        ? {
            ...customerDetails(customer),
            role: 'customer',
            redirectTo: '/conta/',
          }
        : null,
    });
  });
  router.post('/login', async (req, res) => {
    const origin = req.get('Origin');
    if (
      req.get('Sec-Fetch-Site') === 'cross-site' ||
      (origin && origin !== `${req.protocol}://${req.get('host')}`)
    )
      throw fail('Origem não permitida.', 403);
    if (!req.is('application/json')) throw fail('Envie os dados em JSON.', 415);
    const now = Date.now();
    for (const [ip, entry] of attempts)
      if (entry.until <= now) attempts.delete(ip);
    const attempt = attempts.get(req.ip) || {
      count: 0,
      until: now + 15 * 60 * 1000,
    };
    if (attempt.count >= 5 || attempts.size >= 10000) {
      res.set('Retry-After', '900');
      throw fail(
        'Muitas tentativas. Aguarde 15 minutos e tente novamente.',
        429,
      );
    }
    attempt.count++;
    attempts.set(req.ip, attempt);
    const identifier =
      typeof req.body?.identifier === 'string'
        ? req.body.identifier.trim()
        : '';
    const admin = store.get('admin', 'owner');
    // Only a server-owned account chooses the role; never use a role from the body.
    const isAdmin = Boolean(admin && identifier === admin.username);
    req.body = {
      username: isAdmin ? identifier : identifier.toLowerCase(),
      password: req.body?.password,
    };
    const session = await (isAdmin ? adminAuth : customerAuth).login(req, res);
    attempts.delete(req.ip);
    res.json({
      data: {
        ...(isAdmin ? session : customerDetails(session)),
        role: isAdmin ? 'admin' : 'customer',
        redirectTo: isAdmin ? '/admin/' : '/conta/',
      },
    });
  });
  return router;
}
