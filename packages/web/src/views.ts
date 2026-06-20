function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function page(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, "Hiragino Sans", sans-serif; display: grid; place-items: center; min-height: 100dvh; margin: 0; background: #0d1117; color: #e6edf3; }
  .card { max-width: 28rem; padding: 2rem; border-radius: 1rem; background: #161b22; border: 1px solid #30363d; text-align: center; }
  h1 { font-size: 1.3rem; margin: 0 0 .75rem; }
  p { line-height: 1.7; color: #aeb8c2; }
  .ok { color: #86b300; }
  .err { color: #f85149; }
</style>
</head>
<body>
  <div class="card">${bodyHtml}</div>
</body>
</html>`;
}

export function successPage(username: string): string {
  return page(
    '認証完了',
    `<h1 class="ok">✅ 認証が完了しました</h1>
     <p><strong>@${escapeHtml(username)}</strong> として認証されました。<br />
     Discordに戻ると会員チャンネルが見えるようになっています。<br />
     このタブは閉じて構いません。</p>`,
  );
}

export function errorPage(message: string, detail?: string): string {
  return page(
    '認証エラー',
    `<h1 class="err">⚠️ 認証できませんでした</h1>
     <p>${escapeHtml(message)}</p>
     ${detail ? `<p style="font-size:.85rem;color:#6e7681">${escapeHtml(detail)}</p>` : ''}`,
  );
}
