# ikaskey-discord-gatekeeper

いかすきー（Misskey: `ikaskey.bktsk.com`）のアカウント保持者だけが参加できる、**会員制Discord**のゲートキーパー。

- ✅ いかすきーアカウントで認証した人にだけ会員ロールを付与（入会ゲート）
- 🔜 いかすきーアカウントが消滅/凍結したら自動でキック（退会連動・M3）
- 🔜 Misskeyのロールに応じてDiscordロールを自動連動（管理画面で連動先を選択・M4/M5）

## アーキテクチャ

```
[Discordユーザー] ──①ボタン──▶ [bot(discord.js常駐)] ──②state発行＋認証URL(ephemeral)
                                                              │
                                                              ▼
                            [web(Hono)] ──③MiAuthへリダイレクト──▶ [いかすきー]
                                  │ ⑤miauth/check でtoken+user取得 ◀──④許可
                                  │ ⑥Link保存（1:1）＋会員ロール付与(REST)
                                  ▼
                              [SQLite(Prisma)]  ◀── 定期検証ジョブ(M3)
```

- **bot** (`@gatekeeper/bot`): discord.js v14 常駐。認証パネル設置・ボタン処理・state発行・新規参加検知。
- **web** (`@gatekeeper/web`): Hono。MiAuthの開始/コールバック処理、Discordロール付与/剥奪/キックをREST(`@discordjs/rest`)で実行。
- **core** (`@gatekeeper/core`): Misskey APIクライアント・Prisma・設定・認証フローのDB状態管理（共有）。

> 設置先: **Oracle samurai-matrix (ARM64, standalone Docker, dockhand管理)**。公開は cloudflared token トンネルで `web:3001 → ikaskey-gate.bktsk.com`、管理画面は CF Access でゲート（M5）。

## 必要なもの

### Discord 側

- Discord Application を作成し **Bot Token** を取得
- Developer Portal → Bot → **Server Members Intent を ON**（新規参加検知に必須）
- Bot をサーバーに招待（権限ビット `268435458` = Manage Roles + Kick Members）
  - `https://discord.com/api/oauth2/authorize?client_id=<APP_ID>&scope=bot%20applications.commands&permissions=268435458`
- サーバーに「**いかすきー認証済み**」ロールを作成し、**Botロールをそれより上位**に配置（階層制約）
- `DISCORD_CLIENT_ID` / `DISCORD_GUILD_ID` / `VERIFIED_ROLE_ID` を控える

### いかすきー側

- MiAuth は `read:account` のみ要求（書き込み権限は不要）。一般ユーザーが許可するだけで動作。

## 前提

- **Node.js 24+**（本番ランタイムは **Node 26** / `node:26-slim`）、**pnpm 10**
- Node 25+ は corepack を同梱しないため、ローカルは `npm i -g pnpm@10` 等で導入

## セットアップ（ローカル開発）

```bash
pnpm install
cp .env.example .env   # 値を埋める
pnpm prisma:generate
pnpm prisma:migrate    # 初期DB(packages/core/prisma/dev.db)を作成

# bot と web を別ターミナルで
pnpm dev:web           # Vite + @hono/vite-dev-server で HMR 起動 (:3001)
pnpm dev:bot           # tsx watch で常駐

# スラッシュコマンド(/verify-panel)をギルドに登録（1回）
pnpm bot:deploy-commands
```

`/verify-panel` を認証チャンネルで実行 → パネル設置 → ボタン押下で認証フロー。

## 検証コマンド

```bash
pnpm typecheck   # 全パッケージ型チェック
pnpm test        # Vitest
pnpm build       # 本番ビルド（core=tsc / bot,web=tsup）
```

## デプロイ（Oracle samurai-matrix / Docker）

```bash
cp .env.example .env   # 本番値。DATABASE_URL=file:/data/prod.db に変更
docker compose up -d --build
```

- `migrate` サービスが起動前に `prisma migrate deploy` を適用 → `web`/`bot` が起動。
- SQLite は `./data/prod.db` をバインドマウントで永続化。
- 公開は cloudflared 側で `localhost:3001` を `ikaskey-gate.bktsk.com` に向ける（`PUBLIC_BASE_URL` と一致させる）。

## ロードマップ

| マイルストーン | 内容                                                                | 状態                    |
| -------------- | ------------------------------------------------------------------- | ----------------------- |
| **M1**         | モノレポ雛形・MiAuth認証フロー・会員ロール付与                      | ✅ 実装・ローカル検証済 |
| **M2**         | チャンネル権限設計（未認証の隔離・認証導線）                        | 未着手                  |
| **M3**         | 定期検証＋即キック（ヘルスチェック＋連続失敗の安全弁）              | 未着手                  |
| **M4**         | Misskeyロール → Discordロール 自動連動（差分同期）                  | スキーマのみ用意        |
| **M5**         | 管理画面（Vite+React+Tailwind v4：連動ON/OFF・Allowlist・監査ログ） | 未着手                  |

## 設計上の決定（メモ）

- **退会検知**: `users/show`(404 `NO_SUCH_USER`＝消滅/凍結) ＋ `POST /api/i`(401＝トークン失効) の二段。即キックだが、M3でヘルスチェック＋連続失敗カウント(`Link.failureCount`)の安全弁を入れて誤キックを防ぐ。
- **1:1制約**: 同一Misskeyアカウントを複数Discordに連携不可（`Link.misskeyId` unique ＋ `MisskeyAlreadyLinkedError`）。
- **state**: URLに載るのは推測不能なnonceのみ。discordIdは平文で載せない（`VerificationState` に保持）。
