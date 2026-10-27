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
  const quoteAttempts = new Map();
  router.post('/orders/quote', async (req, res) => {
    const now = Date.now();
    for (const [ip, entry] of quoteAttempts)
      if (entry.until <= now) quoteAttempts.delete(ip);
    const entry = quoteAttempts.get(req.ip) || { count: 0, until: now + 60000 };
    if (entry.count >= 30 || quoteAttempts.size >= 10000)
      throw fail('Muitos cálculos. Aguarde um minuto.', 429);
    entry.count++;
    quoteAttempts.set(req.ip, entry);
    res.json({ data: await orders.quote(req.body) });
  });
  router.post('/orders', async (req, res) => {
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
    const order = await orders.create(req.body, session?.customerId || null);
    res.status(201).json({
      data: {
        ...order,
        whatsappUrl: buildWhatsAppUrl(settings.public().whatsappNumber, order),
      },
    });
  });
  return router;
}
