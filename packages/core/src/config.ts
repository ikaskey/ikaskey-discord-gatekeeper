import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * dev 用: cwd から上方向に .env を探して読み込む（best-effort）。
 * 本番(Docker)は compose の environment で渡るので .env は無くてよい。
 */
function loadDotenvFromAncestors(): void {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) {
      try {
        process.loadEnvFile(candidate);
      } catch {
        /* ignore */
      }
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

loadDotenvFromAncestors();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === '') {
    throw new Error(`環境変数 ${name} が設定されていません（.env.example を参照）`);
  }
  return v;
}

function optionalEnv(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export interface AppConfig {
  discord: {
    token: string;
    clientId: string;
    guildId: string;
    verifiedRoleId: string;
  };
  misskey: {
    host: string;
    appName: string;
  };
  web: {
    publicBaseUrl: string;
    port: number;
  };
}

let cached: AppConfig | undefined;

export function loadConfig(): AppConfig {
  if (cached) return cached;
  cached = {
    discord: {
      token: requireEnv('DISCORD_TOKEN'),
      clientId: requireEnv('DISCORD_CLIENT_ID'),
      guildId: requireEnv('DISCORD_GUILD_ID'),
      verifiedRoleId: requireEnv('VERIFIED_ROLE_ID'),
    },
    misskey: {
      host: optionalEnv('MISSKEY_HOST', 'ikaskey.bktsk.com'),
      appName: optionalEnv('MISSKEY_APP_NAME', 'いかすきー会員認証'),
    },
    web: {
      publicBaseUrl: requireEnv('PUBLIC_BASE_URL').replace(/\/$/, ''),
      port: Number.parseInt(optionalEnv('WEB_PORT', '3001'), 10),
    },
  };
  return cached;
}
