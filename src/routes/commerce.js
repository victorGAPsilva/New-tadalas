import { Router } from 'express';
import { fail } from '../services/product-validation.js';
import { buildWhatsAppUrl } from '../../public/js/cart.js';
export function commerceRouter({ orders, customerAuth, settings }) {
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
  router.post('/orders/quote', (req, res) =>
    res.json({ data: orders.quote(req.body) }),
  );
  router.post('/orders', (req, res) => {
    const now = Date.now();
    for (const [ip, attempt] of attempts)
      if (attempt.until <= now) attempts.delete(ip);
    const attempt = attempts.get(req.ip) || {
      count: 0,
      until: now + 15 * 60 * 1000,
    };
    if (attempt.count >= 30 || attempts.size > 10000)
      throw fail('Muitas tentativas de pedido. Aguarde alguns minutos.', 429);
    attempt.count++;
    attempts.set(req.ip, attempt);
    const session = customerAuth.session(req);
    if (session && req.get('X-CSRF-Token') !== session.csrfToken)
      throw fail('Recarregue sua sessão antes de finalizar.', 403);
    const order = orders.create(req.body, session?.customerId || null);
    res.status(201).json({
      data: {
        ...order,
        whatsappUrl: buildWhatsAppUrl(settings.public().whatsappNumber, order),
      },
    });
  });
  return router;
}
