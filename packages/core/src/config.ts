import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * dev 用: cwd から上方向に .env を探して読み込む（best-effort）。
 * 本番(Docker)は compose の environment で渡るので .env は無くてよい。
 */
function loadDotenvFromAncestors(): void {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, ".env");
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
  if (v === undefined || v === "") {
    throw new Error(`環境変数 ${name} が設定されていません（.env.example を参照）`);
  }
  return v;
}

function optionalEnv(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

/**
 * アプリケーション全体の設定。
 *
 * @remarks
 * 環境変数から構築される。`discord` / `web.publicBaseUrl` は必須、
 * `misskey` と `web.port` は既定値を持つ。{@link loadConfig} を介して取得する。
 *
 * @since 0.1.0
 */
export interface AppConfig {
  /** Discord 連携に関する設定 */
  discord: {
    /** Bot トークン（環境変数 `DISCORD_TOKEN`） */
    token: string;
    /** Discord アプリケーションの Client ID（環境変数 `DISCORD_CLIENT_ID`） */
    clientId: string;
    /** 対象の Guild（サーバー）ID（環境変数 `DISCORD_GUILD_ID`） */
    guildId: string;
    /** 認証完了時に付与するロールの ID（環境変数 `VERIFIED_ROLE_ID`） */
    verifiedRoleId: string;
  };
  /** Misskey(いかすきー) 連携に関する設定 */
  misskey: {
    /** Misskey インスタンスのホスト名（環境変数 `MISSKEY_HOST`、既定: `ikaskey.bktsk.com`） */
    host: string;
    /** MiAuth に表示されるアプリ名（環境変数 `MISSKEY_APP_NAME`、既定: `いかすきー会員認証`） */
    appName: string;
  };
  /** Web サーバーに関する設定 */
  web: {
    /** 外部公開時のベース URL（環境変数 `PUBLIC_BASE_URL`、末尾スラッシュは除去される） */
    publicBaseUrl: string;
    /** Web サーバーの待ち受けポート（環境変数 `WEB_PORT`、既定: `3001`） */
    port: number;
  };
}

let cached: AppConfig | undefined;

/**
 * 環境変数から {@link AppConfig} を構築して返す。
 *
 * @remarks
 * 結果はプロセス内でキャッシュされ、2 回目以降は同一インスタンスを返す。
 * dev 環境では cwd から上方向に `.env` を探索して読み込む（best-effort）。
 *
 * @returns 構築済みの {@link AppConfig}
 * @throws {@link Error} 必須の環境変数（`DISCORD_TOKEN` 等）が未設定の場合
 *
 * @example
 * ```ts
 * const config = loadConfig();
 * console.log(config.web.port);
 * ```
 *
 * @since 0.1.0
 */
export function loadConfig(): AppConfig {
  if (cached) return cached;
  cached = {
    discord: {
      token: requireEnv("DISCORD_TOKEN"),
      clientId: requireEnv("DISCORD_CLIENT_ID"),
      guildId: requireEnv("DISCORD_GUILD_ID"),
      verifiedRoleId: requireEnv("VERIFIED_ROLE_ID"),
    },
    misskey: {
      host: optionalEnv("MISSKEY_HOST", "ikaskey.bktsk.com"),
      appName: optionalEnv("MISSKEY_APP_NAME", "いかすきー会員認証"),
    },
    web: {
      publicBaseUrl: requireEnv("PUBLIC_BASE_URL").replace(/\/$/, ""),
      port: Number.parseInt(optionalEnv("WEB_PORT", "3001"), 10),
    },
  };
  return cached;
}
