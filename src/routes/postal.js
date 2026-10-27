import { Router } from 'express';
import { fail } from '../services/product-validation.js';

export function postalRouter(service) {
  const router = Router(),
    attempts = new Map();
  router.get('/address/:postalCode', async (req, res) => {
    const now = Date.now();
    for (const [ip, attempt] of attempts)
      if (attempt.until <= now) attempts.delete(ip);
    const attempt = attempts.get(req.ip) || { count: 0, until: now + 60000 };
    if (attempt.count >= 30 || attempts.size >= 10000) {
      res.set('Retry-After', '60');
      throw fail('Muitas consultas de CEP. Aguarde um minuto.', 429);
    }
    attempt.count++;
    attempts.set(req.ip, attempt);
    res.json({ data: await service.lookup(req.params.postalCode) });
  });
  return router;
}
