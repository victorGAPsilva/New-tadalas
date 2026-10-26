import 'dotenv/config';
import { createApp } from './app.js';
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const demo = process.env.DEMO_MODE === 'true';
if (
  demo &&
  (!['127.0.0.1', 'localhost', '::1'].includes(host) ||
    process.env.NODE_ENV === 'production')
)
  throw new Error('Demonstração permitida somente em ambiente local.');
const app = createApp({
  demo,
  whatsappNumber: process.env.WHATSAPP_NUMBER,
  trustProxy: process.env.TRUST_PROXY_HOPS
    ? Number(process.env.TRUST_PROXY_HOPS)
    : false,
});
app.locals.mailTimer = setInterval(
  () =>
    app.locals.services.mail
      .flush()
      .catch(() => console.error('Falha no processamento de e-mail.')),
  10000,
);
app.locals.mailTimer.unref();
const server = app.listen(port, host, () =>
  console.log(
    `TADALAS BURGUER: http://${host}:${port}${demo ? ' (DEMONSTRAÇÃO LOCAL)' : ''}`,
  ),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close());
