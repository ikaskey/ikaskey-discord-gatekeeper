# Changelog

このプロジェクトの主な変更を記録します。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/)、
バージョニングは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

コード内の各 API がどのバージョンで追加・変更されたかは、TSDoc の `@since` タグでも参照できます。

## [Unreleased]

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

[Unreleased]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ikaskey/ikaskey-discord-gatekeeper/releases/tag/v0.1.0
