import { Router } from 'express';
import { catalogController } from '../controllers/catalog.js';
import { validateOrder } from '../services/order.js';
export function apiRouter(catalog) {
  const router = Router();
  const controller = catalogController(catalog);
  router.get('/health', (_req, res) => res.json({ data: { status: 'ok' } }));
  router.get('/products', controller.products);
  router.get('/products/:id', controller.product);
  router.get('/categories', controller.categories);
  router.get('/config/public', controller.config);
  router.post('/orders/validate', async (req, res) => {
    const order = validateOrder(req.body, await catalog.products());
    res.json({
      data: {
        ...order,
        confirmed: false,
        demoMode: (await catalog.config()).demoMode,
      },
    });
  });
  router.use((_req, res) =>
    res.status(404).json({ error: { message: 'Endpoint não encontrado.' } }),
  );
  return router;
}
