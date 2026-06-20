/**
 * HTML 特殊文字をエスケープし、XSS を防ぐ共有ヘルパー。
 *
 * @remarks
 * サーバー生成 HTML（認証結果ページ・ブランディングタグ等）にユーザー入力や設定値を
 * 埋め込む際に必ず通す。`&`, `<`, `>`, `"`, `'` を実体参照に変換する。
 *
 * @param s - エスケープ対象の文字列
 * @returns エスケープ済み文字列
 * @since 0.9.0
 */
export function escapeHtml(s: string): string {
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
