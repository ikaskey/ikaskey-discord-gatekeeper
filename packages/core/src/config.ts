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
    /**
     * Discord OAuth2 の Client Secret（環境変数 `DISCORD_CLIENT_SECRET`）。
     * 未設定なら未参加ユーザーの自動参加フロー(M6)は無効。
     * @since 0.7.0
     */
    clientSecret: string;
  };
  /** Misskey 連携に関する設定 */
  misskey: {
    /** Misskey インスタンスのホスト名（環境変数 `MISSKEY_HOST`、必須） */
    host: string;
    /** MiAuth に表示されるアプリ名（環境変数 `MISSKEY_APP_NAME`、既定: `会員認証`） */
    appName: string;
    /**
     * Misskey のモデレーターに連動して付与する Discord ロール ID（環境変数 `MISSKEY_MODERATOR_ROLE_ID`、任意）。
     * @since 0.8.0
     */
    moderatorRoleId: string;
    /**
     * Misskey の管理者に連動して付与する Discord ロール ID（環境変数 `MISSKEY_ADMIN_ROLE_ID`、任意）。
     * @since 0.8.0
     */
    adminRoleId: string;
  };
  /** Web サーバーに関する設定 */
  web: {
    /** 外部公開時のベース URL（環境変数 `PUBLIC_BASE_URL`、末尾スラッシュは除去される） */
    publicBaseUrl: string;
    /** Web サーバーの待ち受けポート（環境変数 `WEB_PORT`、既定: `3001`） */
    port: number;
  };
  /**
   * 定期検証スイープ（退会連動の即キック）に関する設定。
   *
   * @since 0.2.0
   */
  sweep: {
    /**
     * 定期検証スイープ（退会連動の即キック）を有効にするか（環境変数 `SWEEP_ENABLED`、既定: `true`）。
     * 移行期間中は `false` にしてキックを完全停止できる（キルスイッチ）。
     * @since 0.5.0
     */
    enabled: boolean;
    /** スイープ実行の cron 式（環境変数 `SWEEP_CRON`、既定は 6 時間ごと = 0,6,12,18 時） */
    cron: string;
    /** 連続「消滅」確認がこの回数に達したらキック（環境変数 `SWEEP_FAILURE_THRESHOLD`、既定: `1`） */
    failureThreshold: number;
    /** 同一スイープ内で「消滅」を再確認する待ち時間ms（環境変数 `SWEEP_RECHECK_DELAY_MS`、既定: `3000`） */
    recheckDelayMs: number;
  };
  /**
   * 管理画面（M5）に関する設定。
   *
   * @since 0.4.0
   */
  admin: {
    /** セッション Cookie の署名鍵（環境変数 `ADMIN_COOKIE_SECRET`）。未設定なら管理画面は無効 */
    cookieSecret: string;
  };
  /**
   * Web ページのブランディング（ファビコン・OGP 等）。すべて任意で、env で差し替え可能。
   *
   * @since 0.8.0
   */
  brand: {
    /** ファビコン/アイコンの画像 URL（環境変数 `BRAND_FAVICON_URL`） */
    faviconUrl: string;
    /** OGP 画像の URL（環境変数 `BRAND_OG_IMAGE_URL`） */
    ogImageUrl: string;
    /** OGP/ページタイトル（環境変数 `BRAND_OG_TITLE`、既定はアプリ名） */
    ogTitle: string;
    /** OGP/説明文（環境変数 `BRAND_OG_DESCRIPTION`） */
    ogDescription: string;
    /** テーマカラー（環境変数 `BRAND_THEME_COLOR`、既定 `#86b300`） */
    themeColor: string;
  };
  /**
   * 段階移行（Phase 3 の未認証キック）に関する設定。
   *
   * @since 0.6.0
   */
  migration: {
    /**
     * `/migration-purge` で**実際にキック**することを許可するか（環境変数 `MIGRATION_PURGE_ENABLED`、既定: `false`）。
     * `false` の間は dry-run（プレビュー）しかできず、実キックは空振りする安全ゲート。
     */
    purgeEnabled: boolean;
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
      clientSecret: optionalEnv("DISCORD_CLIENT_SECRET", ""),
    },
    misskey: {
      host: requireEnv("MISSKEY_HOST"),
      appName: optionalEnv("MISSKEY_APP_NAME", "会員認証"),
      moderatorRoleId: optionalEnv("MISSKEY_MODERATOR_ROLE_ID", ""),
      adminRoleId: optionalEnv("MISSKEY_ADMIN_ROLE_ID", ""),
    },
    web: {
      publicBaseUrl: requireEnv("PUBLIC_BASE_URL").replace(/\/$/, ""),
      port: Number.parseInt(optionalEnv("WEB_PORT", "3001"), 10),
    },
    sweep: {
      enabled: optionalEnv("SWEEP_ENABLED", "true") !== "false",
      cron: optionalEnv("SWEEP_CRON", "0 0,6,12,18 * * *"),
      failureThreshold: Number.parseInt(optionalEnv("SWEEP_FAILURE_THRESHOLD", "1"), 10),
      recheckDelayMs: Number.parseInt(optionalEnv("SWEEP_RECHECK_DELAY_MS", "3000"), 10),
    },
    admin: {
      cookieSecret: optionalEnv("ADMIN_COOKIE_SECRET", ""),
    },
    brand: {
      faviconUrl: optionalEnv("BRAND_FAVICON_URL", ""),
      ogImageUrl: optionalEnv("BRAND_OG_IMAGE_URL", ""),
      ogTitle: optionalEnv("BRAND_OG_TITLE", optionalEnv("MISSKEY_APP_NAME", "会員認証")),
      ogDescription: optionalEnv("BRAND_OG_DESCRIPTION", ""),
      themeColor: optionalEnv("BRAND_THEME_COLOR", "#86b300"),
    },
    migration: {
      purgeEnabled: optionalEnv("MIGRATION_PURGE_ENABLED", "false") === "true",
    },
  };
  return cached;
}
