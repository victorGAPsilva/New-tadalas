import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { readJson } from './storage.js';
import { fail } from './product-validation.js';
const derive = promisify(scrypt);
const parameters = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
let activeDerivations = 0;
async function passwordKey(password, salt) {
  if (activeDerivations >= 2)
    throw fail('Servidor ocupado. Tente novamente em alguns instantes.', 429);
  activeDerivations++;
  try {
    return await derive(password, salt, 64, parameters);
  } finally {
    activeDerivations--;
  }
}
const digest = (token) => createHash('sha256').update(token).digest('hex');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await passwordKey(password, salt)).toString('hex');
  return { salt, hash };
}
export async function checkPassword(password, credentials) {
  const actual = await passwordKey(password, credentials.salt);
  const expected = Buffer.from(credentials.hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function createAuth({
  dataDirectory,
  secureCookies = false,
  now = Date.now,
  accountLookup,
  cookieLabel = 'admin',
  sessionLimit = 100,
  sessionRepository,
  sessionValid,
} = {}) {
  const sessions = sessionRepository || new Map(),
    attempts = new Map();
  const lifetime = 8 * 60 * 60 * 1000;
  const cookieName = `${secureCookies ? '__Host-' : ''}tadalas_${cookieLabel}`;
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    secure: secureCookies,
    path: '/',
  };
  let verifying = 0;
  function cleanup() {
    if (sessions.sweep) sessions.sweep(now());
    else
      for (const [id, session] of sessions)
        if (session.expires <= now()) sessions.delete(id);
    for (const [ip, attempt] of attempts)
      if (attempt.until <= now()) attempts.delete(ip);
  }
  function sessionFor(req) {
    cleanup();
    const cookie = req.headers.cookie
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${cookieName}=`));
    const token = cookie?.slice(cookieName.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const session = sessions.get(digest(token));
    if (session && sessionValid && !sessionValid(session)) {
      sessions.delete(session.id);
      return null;
    }
    return session || null;
  }
  return {
    async isConfigured() {
      if (accountLookup) return Boolean(await accountLookup());
      return Boolean(await readJson(join(dataDirectory, 'admin.json'), null));
    },
    async login(req, res) {
      cleanup();
      const ip = req.ip;
      const attempt = attempts.get(ip) || {
        count: 0,
        until: now() + 15 * 60 * 1000,
      };
      if (attempt.count >= 5 || verifying >= 2 || attempts.size >= 10000) {
        res.set('Retry-After', '900');
        throw fail(
          'Muitas tentativas. Aguarde 15 minutos e tente novamente.',
          429,
        );
      }
      attempt.count++;
      attempts.set(ip, attempt);
      const { username, password } = req.body || {};
      if (
        typeof username !== 'string' ||
        typeof password !== 'string' ||
        username.length > 100 ||
        password.length > 128
      )
        throw fail('Usuário ou senha inválidos.', 401);
      const admin = accountLookup
        ? await accountLookup(username)
        : await readJson(join(dataDirectory, 'admin.json'), null);
      if (verifying >= 2)
        throw fail(
          'Servidor ocupado. Tente novamente em alguns instantes.',
          429,
        );
      // Unknown customer accounts still perform scrypt before returning a generic failure.
      if (!admin && accountLookup) {
        verifying++;
        try {
          await checkPassword(password, {
            salt: '00000000000000000000000000000000',
            hash: '00'.repeat(64),
          });
        } finally {
          verifying--;
        }
        throw fail('Usuário ou senha inválidos.', 401);
      }
      if (!admin)
        throw fail(
          'Administrador ainda não configurado. Execute npm run admin:create no servidor.',
          503,
        );
      if (verifying >= 2)
        throw fail(
          'Servidor ocupado. Tente novamente em alguns instantes.',
          429,
        );
      verifying++;
      let valid;
      try {
        valid = await checkPassword(password, admin);
      } finally {
        verifying--;
      }
      if (!valid || username !== admin.username)
        throw fail('Usuário ou senha inválidos.', 401);
      attempts.delete(ip);
      if (sessions.size >= sessionLimit)
        throw fail('Limite de sessões atingido. Tente mais tarde.', 429);
      const previous = sessionFor(req);
      if (previous) sessions.delete(previous.id);
      const token = randomBytes(32).toString('hex');
      const session = {
        id: digest(token),
        username,
        displayName: admin.name || username,
        customerId: admin.id || null,
        authVersion: admin.authVersion || 0,
        csrf: randomBytes(32).toString('hex'),
        expires: now() + lifetime,
      };
      sessions.set(session.id, session);
      res.cookie(cookieName, token, { ...cookieOptions, maxAge: lifetime });
      return {
        username,
        displayName: session.displayName,
        customerId: session.customerId,
        csrfToken: session.csrf,
        expiresAt: session.expires,
      };
    },
    session(req) {
      const session = sessionFor(req);
      return session
        ? {
            username: session.username,
            displayName: session.displayName,
            customerId: session.customerId,
            csrfToken: session.csrf,
            expiresAt: session.expires,
          }
        : null;
    },
    requireSession(req, _res, next) {
      const session = sessionFor(req);
      if (!session)
        return next(fail('Sua sessão expirou. Entre novamente.', 401));
      if (
        !['GET', 'HEAD'].includes(req.method) &&
        req.get('X-CSRF-Token') !== session.csrf
      )
        return next(
          fail('Sessão de segurança inválida. Recarregue o painel.', 403),
        );
      req.adminSession = session;
      next();
    },
    logout(req, res) {
      sessions.delete(req.adminSession.id);
      res.clearCookie(cookieName, cookieOptions);
    },
  };
}
