# Changelog

このプロジェクトの主な変更を記録します。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/)、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

コード内の各 API がどのバージョンで追加・変更されたかは、TSDoc の `@since` タグでも参照できます。

## [Unreleased]

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

[Unreleased]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/releases/tag/v0.1.0
