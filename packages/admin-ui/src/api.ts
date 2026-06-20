import type { Allowlist, AuditLog, Me, MisskeyRole, RoleMapping } from "./types.js";

/**
 * API 呼び出しで HTTP エラーが発生したことを表す。
 *
 * `status` は HTTP ステータス、`code` はレスポンス body の `error` フィールド
 * （例: `"token_expired"`）があれば保持する。
 *
 * @since 0.4.0
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * 共通 fetch ラッパ。常に Cookie を送信し、非 2xx は {@link ApiError} を投げる。
 *
 * @param path - `/admin/api/...` 形式の相対パス。
 * @param init - 追加の fetch オプション。
 * @returns パース済み JSON。204/空 body の場合は `undefined`。
 * @since 0.4.0
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
  });

  let body: unknown = undefined;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const code =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : undefined;
    throw new ApiError(res.status, code, code ?? `HTTP ${res.status}`);
  }

  return body as T;
}

/**
 * JSON body を送る `request` のヘルパ。
 *
 * @since 0.4.0
 */
function jsonRequest<T>(path: string, method: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * 管理 API クライアント。すべて相対パス・Cookie 認証で実 API を叩く。
 *
 * @since 0.4.0
 */
export const api = {
  /**
   * ログイン中の管理者を取得する。未認証なら 401 で {@link ApiError}。
   * @since 0.4.0
   */
  getMe(): Promise<Me> {
    return request<Me>("/admin/api/me");
  },

  /**
   * ログアウトしてセッション Cookie を破棄する。
   * @since 0.4.0
   */
  logout(): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>("/admin/api/logout", { method: "POST" });
  },

  /**
   * Misskey 公開ロール一覧を取得する。トークン失効時は 401(`token_expired`)。
   * @since 0.4.0
   */
  getRoles(): Promise<MisskeyRole[]> {
    return request<MisskeyRole[]>("/admin/api/roles");
  },

  /**
   * ロール連動マッピング一覧を取得する。
   * @since 0.4.0
   */
  getMappings(): Promise<RoleMapping[]> {
    return request<RoleMapping[]>("/admin/api/mappings");
  },

  /**
   * ロール連動マッピングを upsert する。
   * @since 0.4.0
   */
  putMapping(input: {
    misskeyRoleId: string;
    misskeyRoleName: string;
    discordRoleId: string;
    enabled: boolean;
  }): Promise<unknown> {
    return jsonRequest("/admin/api/mappings", "PUT", input);
  },

  /**
   * ロール連動マッピングを削除する。
   * @since 0.4.0
   */
  deleteMapping(misskeyRoleId: string): Promise<unknown> {
    return request(`/admin/api/mappings/${encodeURIComponent(misskeyRoleId)}`, {
      method: "DELETE",
    });
  },

  /**
   * 除外リスト一覧を取得する。
   * @since 0.4.0
   */
  getAllowlist(): Promise<Allowlist[]> {
    return request<Allowlist[]>("/admin/api/allowlist");
  },

  /**
   * 除外リスト項目を upsert する。
   * @since 0.4.0
   */
  putAllowlist(input: { discordId: string; reason: string }): Promise<unknown> {
    return jsonRequest("/admin/api/allowlist", "PUT", input);
  },

  /**
   * 除外リスト項目を削除する。
   * @since 0.4.0
   */
  deleteAllowlist(discordId: string): Promise<unknown> {
    return request(`/admin/api/allowlist/${encodeURIComponent(discordId)}`, {
      method: "DELETE",
    });
  },

  /**
   * 監査ログ（最新分）を取得する。
   * @since 0.4.0
   */
  getAudit(): Promise<AuditLog[]> {
    return request<AuditLog[]>("/admin/api/audit");
  },
};
