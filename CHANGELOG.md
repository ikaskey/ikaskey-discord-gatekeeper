# Changelog

このプロジェクトの主な変更を記録します。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/)、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

コード内の各 API がどのバージョンで追加・変更されたかは、TSDoc の `@since` タグでも参照できます。

## [Unreleased]

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

[Unreleased]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/releases/tag/v0.1.0
