# Changelog

このプロジェクトの主な変更を記録します。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/)、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

コード内の各 API がどのバージョンで追加・変更されたかは、TSDoc の `@since` タグでも参照できます。

## [Unreleased]

## [0.8.6] - 2026-06-20

### Added

- **`/unlink` スラッシュコマンド**（モデレーター以上）。指定ユーザーのいかすきー連携を、
  **確認ボタンを挟んで**解除する。解除後、対象者は別の Misskey アカウントで認証し直せる
  （会員ロール・参加自体は変更しない）。監査ログ `link_unlink` を記録。

## [0.8.5] - 2026-06-20

### Added

- 管理画面のロール連動に **条件(conditional)ロール対応** を追加。`roles/list` は manual ロールしか
  返さない（`admin/roles/list` は `read:account` スコープ外で利用不可）ため、連動先選択に
  「**手動でIDを入力**」を用意し、ロールID＋表示名で任意の Misskey ロール（条件ロール含む）を連動可能に。

### Note

- 同期ロジック自体は元から条件ロール対応（`users/show` / `/api/i` のどちらも条件ロールを返す）。
  これまでは管理画面で条件ロールを選べなかったため連動できなかっただけ。

## [0.8.4] - 2026-06-20

### Added

- **トップページ（`/`）** を追加。これまで 404 だったルートに、サービス説明と未参加者向けの
  参加導線（自動参加が有効な場合は「参加する」ボタン）を表示。ブランド（ファビコン/OGP）も反映。
  `topPage()`。

## [0.8.3] - 2026-06-20

### Added

- 認証完了ページに **Discord サーバーへの誘導**（「サーバーを開く」ボタン＋数秒後の自動リダイレクト）を追加。
  通常認証・自動参加の両方に適用。誘導先は `DISCORD_SERVER_URL`（既定は Guild ディープリンク
  `https://discord.com/channels/{guildId}`）で差し替え可能。`config.discord.serverUrl`。

## [0.8.2] - 2026-06-20

### Added

- **M8: 管理画面に「連携管理」タブ**を追加。認証済みユーザーの連携一覧（トークンは非表示）と
  検索、**連携解除(unlink)** を提供。解除後は当人が別の Misskey アカウントで認証し直せる。
  core: `listLinks` / `deleteLinkByDiscordId`、web: `GET/DELETE /admin/api/links`、監査ログ `link_unlink`。

## [0.8.1] - 2026-06-20

### Fixed

- 管理者ロールが連動されない不具合を修正。Misskey の `/api/i` は管理者フラグを **`isAdmin`** で返すため、
  `isAdministrator` を見ていた判定を `isAdmin` 優先に修正（モデレーター判定 `isModerator` は元から正常）。

### Added

- 定期検証スイープでも **Misskey モデレーター/管理者 → Discord ロール**を同期。トークンがあれば
  `/api/i` で存在確認・ロール・モデレーター/管理者を一度に取得（`probeMember`）。

## [0.8.0] - 2026-06-20

### Added

- **M7: Misskey 判定による認可とロール連動**
  - スラッシュコマンドの実行可否を **Misskey のモデレーター/管理者**(`/api/i` の `isModerator` / `isAdministrator`、その時点の値)で判定。Discord のサーバー管理者は常に許可(ロックアウト防止)。
  - **Misskey のモデレーター/管理者 → 任意の Discord ロール**を連動(`MISSKEY_MODERATOR_ROLE_ID` / `MISSKEY_ADMIN_ROLE_ID`)。認証/自動参加時に同期。`computeModAdminRoleSync`(純関数・テスト付き)。
- **ブランディングを env で差し替え可能に**(`BRAND_FAVICON_URL` / `BRAND_OG_IMAGE_URL` / `BRAND_OG_TITLE` / `BRAND_OG_DESCRIPTION` / `BRAND_THEME_COLOR`)。管理画面・参加ページ・認証結果ページにファビコン/OGP を反映。

### Changed

- スラッシュコマンドの説明文を利用者向けに分かりやすく調整。
- コマンドの可視性ゲートを外し、実行可否は各ハンドラの Misskey 判定に一本化。

## [0.7.2] - 2026-06-20

### Changed

- `/migration-status` と `/migration-purge` の既定権限を「メンバーをキック(Kick Members)」へ変更
  （= モデレーター以上が実行可能）。設定系(`/verify-panel` `/rolemap`)は引き続きサーバー管理権限。

## [0.7.1] - 2026-06-20

### Changed

- 認証パネルのタイトルをハードコードから `MISSKEY_APP_NAME`（`config.misskey.appName`）参照に変更。
- スラッシュコマンドの説明文から内部情報（「Phase 3」「段階移行の進捗」等）を除去し、
  利用者向けの簡潔な文言に。

## [0.7.0] - 2026-06-20

### Added

- **M6: 未参加ユーザーの自動参加** — Discord 未参加の Misskey ユーザーが認証ページから
  そのままサーバーへ参加できるフロー（`/join`）。
  - Discord OAuth2(`identify` + `guilds.join`) → MiAuth → `guilds.join` でサーバー追加＋会員ロール付与
    （連動ロールも反映）。`auto_join` を監査ログに記録。
  - `@gatekeeper/web`: `/join` サブアプリ、`exchangeDiscordCode` / `getDiscordUser` /
    `addGuildMember`（`@since 0.7.0`）。
  - `@gatekeeper/core`: `AppConfig.discord.clientSecret`（`DISCORD_CLIENT_SECRET`）、
    `VerificationState.discordAccessToken`、`createVerificationState` 拡張。
  - 有効化には `DISCORD_CLIENT_SECRET` ＋ `ADMIN_COOKIE_SECRET`、Bot の **Create Instant Invite** 権限、
    Developer Portal の Redirect URI 登録（`<PUBLIC_BASE_URL>/join/discord/callback`）が必要。

## [0.6.0] - 2026-06-20

### Added

- **Phase 3: 未認証メンバーのキック** — `/migration-purge` コマンド（管理者のみ）。
  - 既定 **dry-run**（プレビューのみ）。実キックは `MIGRATION_PURGE_ENABLED=true` も必須（二重ゲート）。
  - 対象: Bot でない / 会員ロール無し / Allowlist 外 / 参加から `grace_days`（既定 14）日以上。
    `limit`（既定 50）で 1 回あたりの上限。`member.kickable` のみキックし監査ログに記録。
  - `@gatekeeper/core`: `isPurgeCandidate`（純関数・テスト付き、`@since 0.6.0`）、
    `AppConfig.migration.purgeEnabled`。

## [0.5.0] - 2026-06-20

### Added

- **段階移行サポート**（既存サーバーへの導入用）。
  - **スイープ キルスイッチ** `SWEEP_ENABLED`（既定 `true`）。移行期間中は `false` で
    退会連動キックを完全停止（`AppConfig.sweep.enabled`、`@since 0.5.0`）。
  - `/migration-status` コマンド — 認証済み/未認証/除外/Link 件数の集計と未認証者リスト
    （読み取り専用・管理者のみ）。
  - `MIGRATION.md` — Phase 0〜3 の段階移行手順と、M2 チャンネルゲート（権限ベース）の設定手順。

## [0.4.0] - 2026-06-20

### Added

- **M5: 管理画面** — モデレーター/管理者向けの Web 管理 UI（`/admin`）。
  - 認証は **MiAuth**。`/api/i` の `isModerator` / `isAdministrator` でゲートし、
    署名付き Cookie（`ADMIN_COOKIE_SECRET`）でセッション管理（`AdminSession`）。
  - 管理 API（web/Hono 同居）: ロール連動設定・検証除外リスト・監査ログ・Misskey 公開ロール一覧。
  - `@gatekeeper/admin-ui`: Vite + React 19 + Tailwind v4 の SPA（web が `public/admin` から配信）。
  - `@gatekeeper/core`: `AdminSession` / `AuditLog` モデル、`createAdminSession` /
    `getValidAdminSession` / `deleteAdminSession`、`writeAudit` / `listAuditLogs`、
    `listAllowlist` / `upsertAllowlist` / `deleteAllowlist`、`MisskeyUser.isModerator` /
    `isAdministrator`（`@since 0.4.0`）。
  - 監査ログ記録: 会員認証・キック・管理ログイン・連動設定変更・除外リスト変更。
- 設定 `AppConfig.admin.cookieSecret`（`ADMIN_COOKIE_SECRET`）。

## [0.3.0] - 2026-06-20

### Added

- **M4: ロール自動連動** — Misskey の公開ロールに応じて Discord ロールを差分同期。
  - `@gatekeeper/core`: `computeRoleSync`（純関数・テスト付き）、`listActiveRoleMappings` /
    `listRoleMappings` / `upsertRoleMapping` / `deleteRoleMapping`（`@since 0.3.0`）。
    管理対象（マッピングに含まれる Discord ロール）のみを操作し、会員ロール・手動ロールは触らない。
  - `@gatekeeper/bot`: 定期スイープ時に存在を確認したメンバーのロールを差分同期。
    `/rolemap`（list/set/remove）コマンドで連動設定を管理（M5 の管理 UI までの暫定手段）。
  - `@gatekeeper/web`: MiAuth 認証完了時に即時でロール連動。
- `SweepResult.toSyncRoles`（スイープが返すロール同期対象）。

## [0.2.0] - 2026-06-20

### Added

- **M3: 退会連動（定期検証＋即キック）** — いかすきーアカウントの消滅/凍結を検知して自動キック。
  - `@gatekeeper/core`: `runSweep` / `decideAction` / `markKicked` / `listActiveLinks` /
    `isAllowlisted`、`MisskeyClient.healthCheck`（`@since 0.2.0`）。
  - 誤キック対策の安全弁: ①インスタンス死活チェックで全体ガード ②同一スイープ内の再確認
    ③`SWEEP_FAILURE_THRESHOLD` による連続失敗しきい値 ④API/ネットワークエラーは判定保留。
  - `@gatekeeper/bot`: node-cron で定期実行（`SWEEP_CRON`、既定 6 時間ごと）。会員ロール剥奪 →
    `member.kickable` 確認 → キック → `markKicked`。Allowlist は検証除外。
- 設定 `AppConfig.sweep`（`SWEEP_CRON` / `SWEEP_FAILURE_THRESHOLD` / `SWEEP_RECHECK_DELAY_MS`）。

## [0.1.0] - 2026-06-20

### Added

- **M1: 認証コア** — いかすきー(Misskey)の MiAuth 認証で会員ロールを付与する入会ゲート。
  - `@gatekeeper/core`: Misskey API クライアント（MiAuth / `users/show` / `i` / `roles/list`）、
    Prisma(SQLite) スキーマ、設定ローダ、認証フローの DB 状態管理（1:1 制約・nonce state）。
  - `@gatekeeper/bot`: discord.js v14 常駐。認証パネル設置・ボタン処理・state 発行・
    `/verify-panel` スラッシュコマンド・新規参加検知。
  - `@gatekeeper/web`: Hono。MiAuth の開始(`/auth/misskey/start`)とコールバック
    (`/auth/misskey/callback`)、Discord ロール付与/剥奪/キックを REST で実行。
  - Docker(`node:26-slim`, ARM64): `migrate` → `web` + `bot`。SQLite バインドマウント。
- TSDoc を全公開 API に付与し、TypeDoc + GitHub Pages でドキュメントを公開。

### Toolchain

- ランタイム: **Node 26** / **TypeScript 6.0.3**（TS7 はツール対応待ちで見送り）。
- lint/fmt/test を **Vite+(oxc)** に集約（`vp lint` / `vp fmt` / `vp test`）。
- pnpm workspaces モノレポ、全 ESM。

[Unreleased]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.8.6...HEAD
[0.8.6]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.8.5...v0.8.6
[0.8.5]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.8.4...v0.8.5
[0.8.4]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.8.3...v0.8.4
[0.8.3]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.8.2...v0.8.3
[0.8.2]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.7.2...v0.8.0
[0.7.2]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/releases/tag/v0.1.0
