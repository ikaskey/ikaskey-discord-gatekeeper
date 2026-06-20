import { loadConfig } from "@gatekeeper/core";

const config = loadConfig();

function esc(s: string): string {
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
 * 設定（`config.brand`）からブランディング用の `<head>` タグ群を生成する（M7）。
 *
 * @remarks
 * ファビコン・OGP・テーマカラー・タイトルを env で差し替え可能にする。未設定の項目は出力しない。
 *
 * @param pageTitle - ページ固有のタイトル（省略時は `brand.ogTitle`）
 * @returns `<head>` に挿入する HTML 文字列
 * @since 0.8.0
 */
export function brandHeadTags(pageTitle?: string): string {
  const b = config.brand;
  const title = pageTitle ?? b.ogTitle;
  const tags: string[] = [];
  if (title) tags.push(`<title>${esc(title)}</title>`);
  if (b.themeColor) tags.push(`<meta name="theme-color" content="${esc(b.themeColor)}" />`);
  if (b.faviconUrl) {
    tags.push(`<link rel="icon" href="${esc(b.faviconUrl)}" />`);
    tags.push(`<link rel="apple-touch-icon" href="${esc(b.faviconUrl)}" />`);
  }
  if (b.ogTitle) tags.push(`<meta property="og:title" content="${esc(b.ogTitle)}" />`);
  if (b.ogDescription) {
    tags.push(`<meta name="description" content="${esc(b.ogDescription)}" />`);
    tags.push(`<meta property="og:description" content="${esc(b.ogDescription)}" />`);
  }
  if (b.ogImageUrl) {
    tags.push(`<meta property="og:image" content="${esc(b.ogImageUrl)}" />`);
    tags.push(`<meta name="twitter:card" content="summary" />`);
  }
  return tags.join("\n");
}

/**
 * 静的 HTML（管理 SPA の index.html 等）の `</head>` 直前にブランディングタグを注入する。
 *
 * @param html - 元の HTML
 * @returns ブランディングタグを注入した HTML
 * @since 0.8.0
 */
export function injectBrand(html: string): string {
  const tags = brandHeadTags();
  if (!tags) return html;
  return html.includes("</head>") ? html.replace("</head>", `${tags}\n</head>`) : html;
}
