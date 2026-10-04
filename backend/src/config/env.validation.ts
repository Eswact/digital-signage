/** Örnek dosyalarda geçen / tahmin edilebilir değerler production'da reddedilir. */
const WEAK_SECRETS = ['dev-secret', 'degistir-bu-gizli-anahtari', 'change-me', 'changeme', 'secret'];
const WEAK_PASSWORDS = ['admin123', '123456', '12345678', 'password', 'change-me', 'changeme', 'admin'];

export const DEV_JWT_SECRET = 'dev-secret';

/**
 * ConfigModule doğrulaması. Geliştirmede eksik JWT_SECRET'e `dev-secret`
 * verilir; production'da (NODE_ENV=production) zayıf/eksik değerlerle sunucu
 * hiç açılmaz — örnek parolayla ya da tahmin edilebilir JWT anahtarıyla
 * yanlışlıkla canlıya çıkılmasın.
 */
export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const production = env.NODE_ENV === 'production';
  const jwt = typeof env.JWT_SECRET === 'string' ? env.JWT_SECRET.trim() : '';

  if (!production) {
    return { ...env, JWT_SECRET: jwt || DEV_JWT_SECRET };
  }

  const errors: string[] = [];
  if (!jwt) {
    errors.push('JWT_SECRET is required');
  } else if (jwt.length < 32 || WEAK_SECRETS.includes(jwt)) {
    errors.push('JWT_SECRET must be at least 32 characters and not an example value (e.g. `openssl rand -hex 32`)');
  }

  const password = typeof env.ADMIN_PASSWORD === 'string' ? env.ADMIN_PASSWORD : '';
  if (password && (password.length < 10 || WEAK_PASSWORDS.includes(password.toLowerCase()))) {
    errors.push('ADMIN_PASSWORD must be at least 10 characters and not an example password');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid production environment variables:\n- ${errors.join('\n- ')}`);
  }
  return env;
}
