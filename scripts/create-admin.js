import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { openStore } from '../src/services/database.js';
import { defaultDataDirectory } from '../src/services/storage.js';
import { hashPassword } from '../src/services/auth.js';
const directory = fileURLToPath(defaultDataDirectory);
let hidden = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!hidden) process.stdout.write(chunk);
    callback();
  },
});
const prompt = createInterface({
  input: process.stdin,
  output,
  terminal: true,
});
try {
  const username = (
    await prompt.question('Usuário administrador (3–64 caracteres): ')
  ).trim();
  if (!/^[a-zA-Z0-9._@-]{3,64}$/.test(username))
    throw new Error(
      'Usuário inválido. Use letras, números, ponto, @, hífen ou sublinhado.',
    );
  process.stdout.write('Senha (mínimo 12 caracteres; entrada oculta): ');
  hidden = true;
  const password = await prompt.question('');
  hidden = false;
  process.stdout.write('\nConfirme a senha: ');
  hidden = true;
  const confirmation = await prompt.question('');
  hidden = false;
  process.stdout.write('\n');
  if (password.length < 12 || password.length > 128)
    throw new Error('A senha deve ter de 12 a 128 caracteres.');
  if (password !== confirmation) throw new Error('As senhas não coincidem.');
  const store = openStore(directory);
  try {
    if (
      store
        .list('customers')
        .some(
          (customer) => customer.email.toLowerCase() === username.toLowerCase(),
        )
    )
      throw new Error(
        'Esse usuário já é utilizado por uma conta de cliente. Escolha outro identificador.',
      );
    const existing = store.get('admin', 'owner');
    if (existing && !process.argv.includes('--reset'))
      throw Object.assign(
        new Error(
          'Administrador já existe. Use npm run admin:reset para redefinir o acesso localmente.',
        ),
        { code: 'ADMIN_EXISTS' },
      );
    store.put('admin', 'owner', {
      username,
      ...(await hashPassword(password)),
      authVersion: (existing?.authVersion || 0) + 1,
    });
    store.db.prepare("DELETE FROM sessions WHERE scope='admin'").run();
  } finally {
    store.close();
  }
  console.log('Administrador criado. Inicie o servidor e acesse /admin/.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  prompt.close();
}
