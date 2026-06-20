/**
 * Misskey API クライアント。
 * 調査で確定した現行仕様に基づく:
 *  - MiAuth: /miauth/{uuid}?name&callback&permission=read:account → /api/miauth/{uuid}/check
 *  - 存在確認: POST /api/users/show（userId）。404 NO_SUCH_USER = 消滅 or 凍結
 *  - トークン失効検知: POST /api/i（Bearer）。401 AUTHENTICATION_FAILED
 *  - 公開ロール: users/show の roles[] / 一覧は POST /api/roles/list（read:account）
 */

/**
 * Misskey の公開ロール情報。
 *
 * @remarks
 * `users/show` の `roles[]` や `roles/list` から返される。
 *
 * @since 0.1.0
 */
export interface MisskeyRole {
  /** ロール ID */
  id: string;
  /** ロール名 */
  name: string;
  /** 表示色（未設定時は `null`） */
  color: string | null;
  /** アイコン画像 URL（未設定時は `null`） */
  iconUrl: string | null;
  /** ロールの説明 */
  description: string;
  /** モデレーター権限を持つロールか */
  isModerator: boolean;
  /** 管理者権限を持つロールか */
  isAdministrator: boolean;
  /** 表示順（昇順） */
  displayOrder: number;
}

/**
 * Misskey のユーザー情報。
 *
 * @remarks
 * `users/show` / `i` から返される主要フィールドを表す。
 *
 * @since 0.1.0
 */
export interface MisskeyUser {
  /** ユーザー ID */
  id: string;
  /** ユーザー名（`@` 以降のローカル名） */
  username: string;
  /** 表示名（未設定時は `null`） */
  name: string | null;
  /** リモートホスト名。ローカルユーザーは `null` */
  host: string | null;
  /** アバター画像 URL（未設定時は `null`） */
  avatarUrl: string | null;
  /** 公開ロール一覧（取得しない場合は省略） */
  roles?: MisskeyRole[];
  /** Bot アカウントか */
  isBot?: boolean;
  /** アカウント作成日時（ISO 8601 文字列） */
  createdAt?: string;
  /**
   * モデレーター権限を持つか（`/api/i` で本人取得時のみ返る）。
   * @since 0.4.0
   */
  isModerator?: boolean;
  /**
   * 管理者権限を持つか（`/api/i` で本人取得時のみ返る）。
   * @since 0.4.0
   */
  isAdministrator?: boolean;
}

/**
 * MiAuth の `miauth/check` 呼び出し結果。
 *
 * @remarks
 * `ok` が `false` の場合は未認可または無効なセッション。
 *
 * @since 0.1.0
 */
export interface MiauthCheckResult {
  /** 認可が完了したか */
  ok: boolean;
  /** 認可済みアクセストークン（`ok` が `true` のとき） */
  token?: string;
  /** 認可したユーザー情報（`ok` が `true` のとき） */
  user?: MisskeyUser;
}

/**
 * Misskey API 呼び出し全般の失敗を表す基底エラー。
 *
 * @remarks
 * HTTP ステータスとレスポンスボディを保持する。特定のステータスに対応する
 * サブクラスとして {@link NoSuchUserError} / {@link TokenInvalidError} /
 * {@link RateLimitError} がある。
 *
 * @since 0.1.0
 */
export class MisskeyApiError extends Error {
  /**
   * @param message - エラーメッセージ
   * @param status - HTTP ステータスコード
   * @param body - レスポンスボディ（パースできた場合）
   */
  constructor(
    message: string,
    /** HTTP ステータスコード */
    readonly status: number,
    /** レスポンスボディ（パースできた場合） */
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "MisskeyApiError";
  }
}

/**
 * `users/show` で対象が存在しない、または凍結されている場合のエラー（404 NO_SUCH_USER）。
 *
 * @see {@link MisskeyApiError}
 * @since 0.1.0
 */
export class NoSuchUserError extends MisskeyApiError {
  /**
   * @param body - レスポンスボディ（パースできた場合）
   */
  constructor(body?: unknown) {
    super("NO_SUCH_USER", 404, body);
    this.name = "NoSuchUserError";
  }
}

/**
 * トークンが無効・失効、またはアカウント削除済みの場合のエラー（401 AUTHENTICATION_FAILED）。
 *
 * @see {@link MisskeyApiError}
 * @since 0.1.0
 */
export class TokenInvalidError extends MisskeyApiError {
  /**
   * @param body - レスポンスボディ（パースできた場合）
   */
  constructor(body?: unknown) {
    super("AUTHENTICATION_FAILED", 401, body);
    this.name = "TokenInvalidError";
  }
}

/**
 * レート制限に達した場合のエラー（429 RATE_LIMIT_EXCEEDED）。
 *
 * @remarks
 * `retryAfterSec` 秒後に再試行する。
 *
 * @see {@link MisskeyApiError}
 * @since 0.1.0
 */
export class RateLimitError extends MisskeyApiError {
  /**
   * @param retryAfterSec - 再試行までの待機秒数（`Retry-After` ヘッダ未指定時は `null`）
   * @param body - レスポンスボディ（パースできた場合）
   */
  constructor(
    /** 再試行までの待機秒数（`Retry-After` ヘッダ未指定時は `null`） */
    readonly retryAfterSec: number | null,
    body?: unknown,
  ) {
    super("RATE_LIMIT_EXCEEDED", 429, body);
    this.name = "RateLimitError";
  }
}

/**
 * {@link MisskeyClient.buildMiauthUrl} に渡す MiAuth 認可 URL の生成オプション。
 *
 * @since 0.1.0
 */
export interface BuildMiauthUrlOptions {
  /** MiAuth 画面に表示されるアプリ名 */
  appName: string;
  /** 認可完了後のコールバック URL */
  callback: string;
  /** 要求するパーミッション（既定: `read:account`） */
  permission?: string;
  /** アプリのアイコン URL（任意） */
  iconUrl?: string;
}

/**
 * Misskey API クライアント。
 *
 * @remarks
 * 調査で確定した現行仕様に基づく:
 * - MiAuth: `/miauth/{uuid}?name&callback&permission=read:account` → `/api/miauth/{uuid}/check`
 * - 存在確認: `POST /api/users/show`（userId）。404 NO_SUCH_USER = 消滅 or 凍結
 * - トークン失効検知: `POST /api/i`（Bearer）。401 AUTHENTICATION_FAILED
 * - 公開ロール: `users/show` の `roles[]` / 一覧は `POST /api/roles/list`（read:account）
 *
 * @since 0.1.0
 */
export class MisskeyClient {
  /**
   * @param host - 対象 Misskey インスタンスのホスト名（例: `misskey.example.com`）
   */
  constructor(private readonly host: string) {}

  private get base(): string {
    return `https://${this.host}`;
  }

  /**
   * MiAuth の認可 URL を生成する（このURLにユーザーを誘導する）。
   *
   * @param session - MiAuth セッション UUID（{@link newMiauthSession} 等で採番）
   * @param opts - 認可 URL の生成オプション
   * @returns 生成された MiAuth 認可 URL
   *
   * @example
   * ```ts
   * const client = new MisskeyClient("misskey.example.com");
   * const url = client.buildMiauthUrl(session, {
   *   appName: "会員認証",
   *   callback: "https://example.com/callback",
   * });
   * ```
   *
   * @since 0.1.0
   */
  buildMiauthUrl(session: string, opts: BuildMiauthUrlOptions): string {
    const url = new URL(`${this.base}/miauth/${session}`);
    url.searchParams.set("name", opts.appName);
    url.searchParams.set("callback", opts.callback);
    url.searchParams.set("permission", opts.permission ?? "read:account");
    if (opts.iconUrl) url.searchParams.set("icon", opts.iconUrl);
    return url.toString();
  }

  /**
   * MiAuth セッションを検証してトークンを確定する。
   *
   * @remarks
   * 戻り値の `ok` が `false` の場合は未認可または無効なセッション。
   *
   * @param session - MiAuth セッション UUID
   * @returns {@link MiauthCheckResult}
   * @throws {@link MisskeyApiError} HTTP レスポンスが成功でない場合
   *
   * @since 0.1.0
   */
  async miauthCheck(session: string): Promise<MiauthCheckResult> {
    const res = await fetch(`${this.base}/api/miauth/${session}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) {
      throw new MisskeyApiError(`miauth/check failed`, res.status, await safeJson(res));
    }
    return (await res.json()) as MiauthCheckResult;
  }

  /** 内部: 認証付き(任意) POST。エラーを型付き例外に変換 */
  private async call<T>(endpoint: string, params: unknown, token?: string): Promise<T> {
    const res = await fetch(`${this.base}/api/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(params ?? {}),
    });

    if (res.ok) {
      return (await res.json()) as T;
    }

    const body = await safeJson(res);
    if (res.status === 404) throw new NoSuchUserError(body);
    if (res.status === 401) throw new TokenInvalidError(body);
    if (res.status === 429) {
      const retry = res.headers.get("Retry-After");
      throw new RateLimitError(retry ? Number.parseInt(retry, 10) : null, body);
    }
    throw new MisskeyApiError(`${endpoint} failed`, res.status, body);
  }

  /**
   * ユーザー詳細を取得する（userId 指定）。
   *
   * @param userId - 取得対象の Misskey ユーザー ID
   * @returns 取得した {@link MisskeyUser}
   * @throws {@link NoSuchUserError} 対象が存在しない、または凍結されている場合
   * @throws {@link RateLimitError} レート制限に達した場合
   * @throws {@link MisskeyApiError} その他の API エラー
   *
   * @since 0.1.0
   */
  usersShow(userId: string): Promise<MisskeyUser> {
    return this.call<MisskeyUser>("users/show", { userId });
  }

  /**
   * ユーザーの存在確認を行う。
   *
   * @remarks
   * 404（{@link NoSuchUserError}）を `exists:false` に変換する（凍結も `false` 扱い）。
   * 429・5xx 等はそのまま再スローし、誤キックを防止する。
   *
   * @param userId - 確認対象の Misskey ユーザー ID
   * @returns 存在有無と、存在する場合は {@link MisskeyUser}
   * @throws {@link RateLimitError} レート制限に達した場合
   * @throws {@link MisskeyApiError} 404 以外の API エラー
   *
   * @since 0.1.0
   */
  async checkUserExists(userId: string): Promise<{ exists: boolean; user?: MisskeyUser }> {
    try {
      const user = await this.usersShow(userId);
      return { exists: true, user };
    } catch (err) {
      if (err instanceof NoSuchUserError) return { exists: false };
      throw err; // 429・5xx 等は呼び出し側で扱う（誤キック防止）
    }
  }

  /**
   * アクセストークンで本人情報を取得する（`POST /api/i`）。
   *
   * @remarks
   * トークンの失効検知に用いる。
   *
   * @param token - 検証対象のアクセストークン
   * @returns 本人の {@link MisskeyUser}
   * @throws {@link TokenInvalidError} トークンが無効・失効、またはアカウント削除済みの場合
   * @throws {@link RateLimitError} レート制限に達した場合
   * @throws {@link MisskeyApiError} その他の API エラー
   *
   * @since 0.1.0
   */
  getMe(token: string): Promise<MisskeyUser> {
    return this.call<MisskeyUser>("i", {}, token);
  }

  /**
   * インスタンスの公開ロール一覧を取得する（`POST /api/roles/list`）。
   *
   * @remarks
   * `isPublic && isExplorable` のロールのみが返る。
   *
   * @param token - `read:account` 権限を持つアクセストークン
   * @returns 公開ロールの配列
   * @throws {@link TokenInvalidError} トークンが無効・失効した場合
   * @throws {@link RateLimitError} レート制限に達した場合
   * @throws {@link MisskeyApiError} その他の API エラー
   *
   * @since 0.1.0
   */
  rolesList(token: string): Promise<MisskeyRole[]> {
    return this.call<MisskeyRole[]>("roles/list", {}, token);
  }

  /**
   * インスタンスの死活確認（`/api/meta` への到達性チェック）。
   *
   * @remarks
   * 定期検証スイープの前段ガードに使う。`false`（インスタンス不達やエラー）の場合は
   * スイープ全体をスキップし、API 一時障害による誤キックを防ぐ。ネットワーク例外も
   * `false` に握りつぶす。
   *
   * @returns インスタンスが応答すれば `true`、不達・エラーなら `false`
   *
   * @since 0.2.0
   */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}/api/meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}
