import { Router, raw } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fail } from '../services/product-validation.js';
export function adminRouter({
  catalog,
  auth,
  uploadDirectory,
  settings,
  orders,
  mail,
  demo = false,
}) {
  const router = Router();
  // JSON and custom CSRF headers, plus origin checks, protect cookie-authenticated writes.
  router.use((req, _res, next) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
      const origin = req.get('Origin');
      if (
        req.get('Sec-Fetch-Site') === 'cross-site' ||
        (origin && origin !== `${req.protocol}://${req.get('host')}`)
      )
        return next(fail('Origem não permitida.', 403));
      if (req.path !== '/uploads' && !req.is('application/json'))
        return next(fail('Envie os dados em JSON.', 415));
    }
    next();
  });
  router.get('/status', async (_req, res) =>
    res.json({ data: { configured: await auth.isConfigured() } }),
  );
  router.post('/login', async (req, res) =>
    res.json({ data: await auth.login(req, res) }),
  );
  router.use(auth.requireSession);
  router.use((req, _res, next) => {
    if (demo && !['GET', 'HEAD'].includes(req.method) && req.path !== '/logout')
      return next(fail('Alterações bloqueadas no modo de demonstração.', 403));
    next();
  });
  router.get('/session', (req, res) =>
    res.json({
      data: {
        username: req.adminSession.username,
        csrfToken: req.adminSession.csrf,
        expiresAt: req.adminSession.expires,
      },
    }),
  );
  router.post('/logout', (req, res) => {
    auth.logout(req, res);
    res.json({ data: { loggedOut: true } });
  });
  router.get('/products', async (_req, res) =>
    res.json({ data: await catalog.products() }),
  );
  router.get('/categories', async (_req, res) =>
    res.json({ data: await catalog.allCategories() }),
  );
  router.post('/categories', async (req, res) =>
    res.status(201).json({ data: await catalog.createCategory(req.body) }),
  );
  router.put('/categories/:id', async (req, res) =>
    res.json({ data: await catalog.updateCategory(req.params.id, req.body) }),
  );
  router.delete('/categories/:id', async (req, res) => {
    await catalog.deleteCategory(req.params.id);
    res.json({ data: { deleted: true } });
  });
  router.get('/settings', (_req, res) =>
    res.json({ data: { ...settings.get(), emailStatus: mail.status() } }),
  );
  router.put('/settings', (req, res) =>
    res.json({ data: settings.update(req.body) }),
  );
  router.get('/orders', (req, res) =>
    res.json({ data: orders.listAdmin(req.query.status || '') }),
  );
  router.patch('/orders/:id/status', (req, res) =>
    res.json({ data: orders.status(req.params.id, req.body) }),
  );
  router.post('/products', async (req, res) =>
    res.status(201).json({ data: await catalog.createProduct(req.body) }),
  );
  router.put('/products/:id', async (req, res) =>
    res.json({ data: await catalog.updateProduct(req.params.id, req.body) }),
  );
  router.delete('/products/:id', async (req, res) => {
    await catalog.deleteProduct(req.params.id, req.body?.version);
    res.json({ data: { deleted: true } });
  });
  router.post(
    '/uploads',
    raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: '3mb' }),
    async (req, res) => {
      const bytes = req.body;
      if (!Buffer.isBuffer(bytes) || bytes.length < 24)
        throw fail('Envie uma imagem PNG, JPEG ou WebP de até 3 MB.');
      let ext;
      if (
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        ext = 'png';
      else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
        ext = 'jpg';
      else if (
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP'
      )
        ext = 'webp';
      if (!ext)
        throw fail(
          'Formato inválido. SVG e arquivos executáveis não são aceitos.',
        );
      await mkdir(uploadDirectory, { recursive: true });
      const filename = `${randomUUID()}.${ext}`;
      await writeFile(new URL(filename, uploadDirectory), bytes, {
        flag: 'wx',
      });
      res.status(201).json({ data: { image: `/assets/uploads/${filename}` } });
    },
  );
  router.use((_req, res) =>
    res
      .status(404)
      .json({ error: { message: 'Endpoint administrativo não encontrado.' } }),
  );
  return router;
}
