/**
 * 認証結果ページの HTML 描画モジュール。
 *
 * @remarks
 * 外部テンプレートエンジンを使わず、テンプレートリテラルで自己完結した HTML を返す。
 * ユーザー入力(ユーザー名など)は必ず {@link escapeHtml} を通して埋め込む。
 */

import { brandHeadTags } from "./brand.js";

/**
 * HTML 特殊文字をエスケープし、XSS を防ぐための内部ヘルパー。
 *
 * @param s - エスケープ対象の文字列
 * @returns `&`, `<`, `>`, `"`, `'` を実体参照に変換した文字列
 */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

/**
 * 共通レイアウト(doctype・head・スタイル)で本文 HTML を包む内部ヘルパー。
 *
 * @param title - `<title>` に設定するページタイトル(エスケープ済みで埋め込む)
 * @param bodyHtml - `.card` 内に挿入する本文 HTML(呼び出し側でエスケープ責任を負う)
 * @returns 完全な HTML ドキュメント文字列
 */
function page(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
${brandHeadTags(title)}
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, "Hiragino Sans", sans-serif; display: grid; place-items: center; min-height: 100dvh; margin: 0; background: #0d1117; color: #e6edf3; }
  .card { max-width: 28rem; padding: 2rem; border-radius: 1rem; background: #161b22; border: 1px solid #30363d; text-align: center; }
  h1 { font-size: 1.3rem; margin: 0 0 .75rem; }
  p { line-height: 1.7; color: #aeb8c2; }
  .ok { color: #86b300; }
  .err { color: #f85149; }
  .btn { display: inline-block; margin-top: 1rem; padding: .7rem 1.4rem; border-radius: .6rem; background: #86b300; color: #0d1117; font-weight: 700; text-decoration: none; }
  .btn:hover { background: #9bce00; }
  .hint { font-size: .85rem; color: #6e7681; }
</style>
</head>
<body>
  <div class="card">${bodyHtml}</div>
</body>
</html>`;
}

/**
 * 認証成功ページの HTML を生成する。
 *
 * @param username - 認証された いかすきー ユーザー名(`@` なし。内部でエスケープされる)
 * @param serverUrl - 認証後に誘導する Discord サーバーの URL（任意）。指定時は
 *   「サーバーを開く」ボタンと数秒後の自動リダイレクトを付与する（`https:` のみ許可）。
 * @returns 認証完了メッセージを含む完全な HTML ドキュメント
 * @remarks
 * MiAuth コールバック成功時(token 確定 → Link 保存 → ロール付与の完了後)に返す。
 * @example
 * ```ts
 * return c.html(successPage(user.username, config.discord.serverUrl));
 * ```
 * @see {@link errorPage}
 * @since 0.1.0
 */
export function successPage(username: string, serverUrl?: string): string {
  const safeUrl = serverUrl && /^https:\/\//i.test(serverUrl) ? serverUrl : "";
  const cta = safeUrl
    ? `<p><a class="btn" href="${escapeHtml(safeUrl)}">Discordサーバーを開く</a></p>
     <p class="hint">まもなく自動的にDiscordサーバーへ移動します…</p>
     <script>setTimeout(function(){location.href=${JSON.stringify(safeUrl)};},2500);</script>`
    : `<p class="hint">このタブは閉じて構いません。</p>`;
  return page(
    "認証完了",
    `<h1 class="ok">✅ 認証が完了しました</h1>
     <p><strong>@${escapeHtml(username)}</strong> として認証されました。<br />
     会員チャンネルが見えるようになっています。</p>
     ${cta}`,
  );
}

/**
 * 認証エラーページの HTML を生成する。
 *
 * @param message - 利用者向けの主たるエラーメッセージ(内部でエスケープされる)
 * @param detail - 補足説明(任意)。指定時は小さめのテキストで併記される
 * @returns エラーメッセージを含む完全な HTML ドキュメント
 * @remarks
 * state 不正・セッション不一致・MiAuth 未完了・連携済み・ロール付与失敗など、
 * 各ルートで発生しうる失敗時に適切な HTTP ステータスとともに返す。
 * @example
 * ```ts
 * return c.html(errorPage("リンクが不正です。"), 400);
 * ```
 * @see {@link successPage}
 * @since 0.1.0
 */
export function errorPage(message: string, detail?: string): string {
  return page(
    "認証エラー",
    `<h1 class="err">⚠️ 認証できませんでした</h1>
     <p>${escapeHtml(message)}</p>
     ${detail ? `<p style="font-size:.85rem;color:#6e7681">${escapeHtml(detail)}</p>` : ""}`,
  );
}

/**
 * トップページ（`/`）の HTML を生成する。
 *
 * @remarks
 * サービスの説明と、未参加者向けの参加導線（自動参加が有効な場合）を表示する。
 * 既存メンバーには Discord 内の認証パネルから認証するよう案内する。
 *
 * @param opts.appName - 表示するアプリ名（内部でエスケープ）
 * @param opts.joinEnabled - 自動参加フロー（M6）が有効か。`true` なら参加ボタンを表示する
 * @returns 完全な HTML ドキュメント
 * @since 0.8.4
 */
export function topPage(opts: { appName: string; joinEnabled: boolean }): string {
  const joinCta = opts.joinEnabled
    ? `<p><a class="btn" href="/join">Discordサーバーに参加する</a></p>`
    : "";
  return page(
    opts.appName,
    `<h1>🦑 ${escapeHtml(opts.appName)}</h1>
     <p>これは「いかすきー」会員向け Discord の認証サービスです。<br />
     いかすきー（Misskey）アカウントをお持ちの方が対象です。</p>
     ${joinCta}
     <p class="hint">すでにサーバーに参加済みの方は、Discord 内の認証パネルのボタンから認証してください。</p>`,
  );
}
