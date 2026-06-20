/**
 * いかすきー(Misskey) API クライアント。
 * 調査で確定した現行仕様に基づく:
 *  - MiAuth: /miauth/{uuid}?name&callback&permission=read:account → /api/miauth/{uuid}/check
 *  - 存在確認: POST /api/users/show（userId）。404 NO_SUCH_USER = 消滅 or 凍結
 *  - トークン失効検知: POST /api/i（Bearer）。401 AUTHENTICATION_FAILED
 *  - 公開ロール: users/show の roles[] / 一覧は POST /api/roles/list（read:account）
 */

export interface MisskeyRole {
  id: string;
  name: string;
  color: string | null;
  iconUrl: string | null;
  description: string;
  isModerator: boolean;
  isAdministrator: boolean;
  displayOrder: number;
}

export interface MisskeyUser {
  id: string;
  username: string;
  name: string | null;
  host: string | null;
  avatarUrl: string | null;
  roles?: MisskeyRole[];
  isBot?: boolean;
  createdAt?: string;
}

export interface MiauthCheckResult {
  ok: boolean;
  token?: string;
  user?: MisskeyUser;
}

/** API 呼び出し全般の失敗 */
export class MisskeyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'MisskeyApiError';
  }
}

/** users/show で対象が存在しない or 凍結（404 NO_SUCH_USER） */
export class NoSuchUserError extends MisskeyApiError {
  constructor(body?: unknown) {
    super('NO_SUCH_USER', 404, body);
    this.name = 'NoSuchUserError';
  }
}

/** トークンが無効・失効・アカウント削除（401 AUTHENTICATION_FAILED） */
export class TokenInvalidError extends MisskeyApiError {
  constructor(body?: unknown) {
    super('AUTHENTICATION_FAILED', 401, body);
    this.name = 'TokenInvalidError';
  }
}

/** レート制限（429）。retryAfterSec 秒後に再試行 */
export class RateLimitError extends MisskeyApiError {
  constructor(readonly retryAfterSec: number | null, body?: unknown) {
    super('RATE_LIMIT_EXCEEDED', 429, body);
    this.name = 'RateLimitError';
  }
}

export interface BuildMiauthUrlOptions {
  appName: string;
  callback: string;
  permission?: string;
  iconUrl?: string;
}

export class MisskeyClient {
  constructor(private readonly host: string) {}

  private get base(): string {
    return `https://${this.host}`;
  }

  /** MiAuth 認可URL（このURLにユーザーを誘導する） */
  buildMiauthUrl(session: string, opts: BuildMiauthUrlOptions): string {
    const url = new URL(`${this.base}/miauth/${session}`);
    url.searchParams.set('name', opts.appName);
    url.searchParams.set('callback', opts.callback);
    url.searchParams.set('permission', opts.permission ?? 'read:account');
    if (opts.iconUrl) url.searchParams.set('icon', opts.iconUrl);
    return url.toString();
  }

  /** トークン確定。ok=false は未認可/無効セッション */
  async miauthCheck(session: string): Promise<MiauthCheckResult> {
    const res = await fetch(`${this.base}/api/miauth/${session}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) {
      throw new MisskeyApiError(`miauth/check failed`, res.status, await safeJson(res));
    }
    return (await res.json()) as MiauthCheckResult;
  }

  /** 内部: 認証付き(任意) POST。エラーを型付き例外に変換 */
  private async call<T>(endpoint: string, params: unknown, token?: string): Promise<T> {
    const res = await fetch(`${this.base}/api/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
      const retry = res.headers.get('Retry-After');
      throw new RateLimitError(retry ? Number.parseInt(retry, 10) : null, body);
    }
    throw new MisskeyApiError(`${endpoint} failed`, res.status, body);
  }

  /** ユーザー詳細（userId 指定）。非存在/凍結は NoSuchUserError */
  usersShow(userId: string): Promise<MisskeyUser> {
    return this.call<MisskeyUser>('users/show', { userId });
  }

  /** 存在確認。404 を boolean に変換（凍結も exists:false 扱い） */
  async checkUserExists(userId: string): Promise<{ exists: boolean; user?: MisskeyUser }> {
    try {
      const user = await this.usersShow(userId);
      return { exists: true, user };
    } catch (err) {
      if (err instanceof NoSuchUserError) return { exists: false };
      throw err; // 429・5xx 等は呼び出し側で扱う（誤キック防止）
    }
  }

  /** トークンで本人取得。失効時は TokenInvalidError */
  getMe(token: string): Promise<MisskeyUser> {
    return this.call<MisskeyUser>('i', {}, token);
  }

  /** インスタンスの公開ロール一覧（isPublic && isExplorable のみ返る） */
  rolesList(token: string): Promise<MisskeyRole[]> {
    return this.call<MisskeyRole[]>('roles/list', {}, token);
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}
