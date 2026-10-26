import nodemailer from 'nodemailer';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { hashPassword } from './auth.js';
import { fail } from './product-validation.js';
export function createMailer(env = process.env) {
  const missing = ['SMTP_HOST', 'SMTP_FROM', 'PUBLIC_URL'].filter(
    (key) => !env[key],
  );
  let baseUrl;
  try {
    baseUrl = new URL(env.PUBLIC_URL);
    if (
      baseUrl.username ||
      baseUrl.password ||
      baseUrl.pathname !== '/' ||
      baseUrl.search ||
      baseUrl.hash ||
      !(
        ['https:'].includes(baseUrl.protocol) ||
        (env.NODE_ENV !== 'production' &&
          baseUrl.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(baseUrl.hostname))
      )
    )
      throw new Error();
  } catch {
    if (!missing.includes('PUBLIC_URL')) missing.push('PUBLIC_URL');
  }
  if (missing.length) return { configured: false, missing, baseUrl: null };
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === 'true',
    requireTLS: env.SMTP_SECURE !== 'true',
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
    connectionTimeout: 10000,
    socketTimeout: 15000,
    logger: false,
    debug: false,
  });
  return {
    configured: true,
    missing: [],
    baseUrl: baseUrl.origin,
    send: (message) => transport.sendMail({ from: env.SMTP_FROM, ...message }),
  };
}
export function accountMailService(
  store,
  customers,
  { mailer = createMailer(), now = Date.now } = {},
) {
  let flushing = false;
  const digest = (token) => createHash('sha256').update(token).digest('hex');
  async function flush() {
    if (!mailer.configured || flushing) return;
    flushing = true;
    try {
      const jobs = store.db
        .prepare(
          'SELECT * FROM mail_jobs WHERE next_attempt<=? AND attempts<5 ORDER BY rowid LIMIT 5',
        )
        .all(now());
      for (const job of jobs) {
        try {
          await mailer.send(JSON.parse(job.payload));
          if (!store.db.isOpen) break;
          store.db.prepare('DELETE FROM mail_jobs WHERE id=?').run(job.id);
        } catch {
          if (!store.db.isOpen) break;
          store.db
            .prepare(
              'UPDATE mail_jobs SET attempts=attempts+1,next_attempt=? WHERE id=?',
            )
            .run(now() + 60000 * (job.attempts + 1), job.id);
        }
      }
    } finally {
      flushing = false;
    }
  }
  function request(email, purpose) {
    if (!mailer.configured)
      throw fail(
        'Envio de e-mails ainda não configurado. Entre em contato com o atendimento.',
        409,
      );
    const customer = store.list('customers').find((c) => c.email === email);
    if (customer && !(purpose === 'verify' && customer.emailVerifiedAt))
      store.transaction(() => {
        const token = randomBytes(32).toString('hex'),
          duration = purpose === 'reset' ? 30 * 60 * 1000 : 24 * 60 * 60 * 1000;
        store.db
          .prepare('DELETE FROM tokens WHERE customer_id=? AND purpose=?')
          .run(customer.id, purpose);
        store.db
          .prepare('INSERT INTO tokens VALUES(?,?,?,?,0)')
          .run(digest(token), purpose, customer.id, now() + duration);
        const url = `${mailer.baseUrl}/${purpose === 'reset' ? 'recuperar' : 'verificar-email'}/?token=${token}`;
        const text =
          purpose === 'reset'
            ? `Foi solicitada uma nova senha para sua conta TADALAS BURGUER.\n\nAbra o link em até 30 minutos:\n${url}\n\nSe não foi você, ignore esta mensagem.`
            : `Confirme seu e-mail da TADALAS BURGUER pelo link abaixo (válido por 24 horas):\n${url}\n\nSe não foi você, ignore esta mensagem.`;
        store.db
          .prepare(
            'INSERT INTO mail_jobs(id,payload,next_attempt) VALUES(?,?,?)',
          )
          .run(
            randomUUID(),
            JSON.stringify({
              to: customer.email,
              subject:
                purpose === 'reset'
                  ? 'Redefinir senha — TADALAS BURGUER'
                  : 'Confirme seu e-mail — TADALAS BURGUER',
              text,
            }),
            now(),
          );
      });
    return {
      message:
        'Se houver uma conta elegível para esse e-mail, você receberá as instruções.',
    };
  }
  function readToken(token, purpose) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token))
      throw fail('Link inválido ou expirado.');
    const row = store.db
      .prepare(
        'SELECT * FROM tokens WHERE digest=? AND purpose=? AND used=0 AND expires>?',
      )
      .get(digest(token), purpose, now());
    if (!row) throw fail('Link inválido ou expirado.');
    return row;
  }
  function consume(token, purpose) {
    const changes = store.db
      .prepare(
        'UPDATE tokens SET used=1 WHERE digest=? AND purpose=? AND used=0 AND expires>?',
      )
      .run(digest(token), purpose, now()).changes;
    if (!changes) throw fail('Link inválido ou expirado.');
  }
  return {
    status: () => ({
      configured: mailer.configured,
      missing: mailer.missing || [],
    }),
    flush,
    request,
    async reset(token, password) {
      if (
        typeof password !== 'string' ||
        password.length < 12 ||
        password.length > 128
      )
        throw fail('A senha deve ter de 12 a 128 caracteres.');
      const row = readToken(token, 'reset'),
        credentials = await hashPassword(password);
      store.transaction(() => {
        consume(token, 'reset');
        const customer = customers.findById(row.customer_id);
        if (!customer) throw fail('Link inválido.');
        store.put('customers', customer.id, {
          ...customer,
          ...credentials,
          authVersion: (customer.authVersion || 0) + 1,
          emailVerifiedAt:
            customer.emailVerifiedAt || new Date(now()).toISOString(),
        });
        store.db
          .prepare(
            "DELETE FROM sessions WHERE scope='customer' AND json_extract(payload,'$.customerId')=?",
          )
          .run(customer.id);
      });
      return { message: 'Senha atualizada. Entre novamente com a nova senha.' };
    },
    verify(token) {
      return store.transaction(() => {
        const row = readToken(token, 'verify');
        consume(token, 'verify');
        const customer = customers.findById(row.customer_id);
        if (!customer) throw fail('Link inválido.');
        store.put('customers', customer.id, {
          ...customer,
          emailVerifiedAt: new Date(now()).toISOString(),
        });
        return { message: 'E-mail confirmado com sucesso.' };
      });
    },
  };
}
