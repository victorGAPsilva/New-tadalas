import express from 'express';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { createCatalog } from './services/catalog.js';
import { apiRouter } from './routes/api.js';
import { errorHandler } from './middleware/errors.js';
import { createAuth } from './services/auth.js';
import {
  defaultDataDirectory,
  defaultUploadDirectory,
} from './services/storage.js';
import { adminRouter } from './routes/admin.js';
import { customerService } from './services/customers.js';
import { customerRouter } from './routes/customers.js';
import { openStore } from './services/database.js';
import { settingsService } from './services/settings.js';
import { orderService } from './services/orders.js';
import { accountMailService } from './services/mail.js';
import { commerceRouter } from './routes/commerce.js';
import { createPostalService } from './services/postal.js';
import { postalRouter } from './routes/postal.js';
import { createDeliveryService } from './services/delivery.js';
import { signInRouter } from './routes/sign-in.js';
export function createApp(options = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (options.trustProxy) app.set('trust proxy', options.trustProxy);
  const directory =
    options.dataDirectory || fileURLToPath(defaultDataDirectory);
  const store = openStore(directory);
  const delivery = options.deliveryService || createDeliveryService();
  const settings = settingsService(store, {
    ...options,
    deliveryReady: delivery.configured,
  });
  const catalog = createCatalog({
    ...options,
    store,
    deliveryReady: delivery.configured,
  });
  const uploadDirectory = options.uploadDirectory || defaultUploadDirectory;
  const auth = createAuth({
    dataDirectory: options.dataDirectory || fileURLToPath(defaultDataDirectory),
    secureCookies:
      options.secureCookies ?? process.env.NODE_ENV === 'production',
    now: options.now,
    accountLookup: async () => store.get('admin', 'owner'),
    sessionRepository: store.sessions('admin'),
    sessionValid: (session) =>
      (store.get('admin', 'owner')?.authVersion || 0) === session.authVersion,
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'"],
          fontSrc: ["'self'"],
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
  app.use(express.json({ limit: '128kb' }));
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  const customers = customerService(
    options.dataDirectory || fileURLToPath(defaultDataDirectory),
    store,
  );
  const customerAuth = createAuth({
    cookieLabel: 'customer',
    sessionLimit: 1000,
    now: options.now,
    secureCookies:
      options.secureCookies ?? process.env.NODE_ENV === 'production',
    accountLookup: async (email) => {
      const customer = await customers.find(email);
      return customer ? { ...customer, username: customer.email } : null;
    },
    sessionRepository: store.sessions('customer'),
    sessionValid: (session) => {
      const c = customers.findById(session.customerId);
      return Boolean(c) && (c.authVersion || 0) === session.authVersion;
    },
  });
  const orders = orderService(store, settings, { ...options, delivery });
  const mail = accountMailService(store, customers, options);
  app.locals.services = { store, settings, catalog, customers, orders, mail };
  app.use(
    '/api/auth',
    signInRouter({ store, adminAuth: auth, customerAuth, mail }),
  );
  app.use(
    '/api/customer',
    customerRouter({ customers, auth: customerAuth, store, orders, mail }),
  );
  app.use(
    '/api/admin',
    adminRouter({
      catalog,
      auth,
      uploadDirectory,
      settings,
      orders,
      mail,
      demo: Boolean(options.demo),
    }),
  );
  app.use(
    '/assets/uploads',
    express.static(fileURLToPath(uploadDirectory), {
      maxAge: '1h',
      dotfiles: 'deny',
    }),
  );
  app.use(
    '/api',
    postalRouter(
      createPostalService({ fetchImpl: options.postalFetch, now: options.now }),
    ),
    commerceRouter({ orders, customerAuth, settings }),
    apiRouter(catalog),
  );
  app.get(
    [
      '/cardapio',
      '/login',
      '/conta',
      '/admin/login',
      '/recuperar',
      '/verificar-email',
    ],
    (req, res, next) => {
      if (req.path.endsWith('/')) return next();
      res.redirect(308, `${req.path}/${req.url.slice(req.path.length)}`);
    },
  );
  app.use(
    express.static(fileURLToPath(new URL('../public', import.meta.url)), {
      maxAge: '1h',
      setHeaders(res, path) {
        if (/\.(html|js|css)$/.test(path)) res.set('Cache-Control', 'no-cache');
      },
    }),
  );
  app.use((_req, res) =>
    res.status(404).type('text').send('Página não encontrada.'),
  );
  app.use(errorHandler);
  const listen = app.listen.bind(app);
  app.listen = (...args) => {
    const server = listen(...args);
    server.once('close', () => {
      clearInterval(app.locals.mailTimer);
      store.close();
    });
    return server;
  };
  return app;
}
