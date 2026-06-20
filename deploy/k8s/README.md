# k3s / Kubernetes デプロイ

PostgreSQL を共有 DB に使い、`web` を水平スケール、`bot` を単一インスタンスで運用する構成。
イメージは ghcr（public）からそのまま pull する。

## 構成

| 対象     | 種別                          | 備考                                                         |
| -------- | ----------------------------- | ------------------------------------------------------------ |
| postgres | StatefulSet + Service         | local-path PVC で永続化。単一ノードに固定                    |
| migrate  | Job                           | `prisma migrate deploy`。web/bot 更新前に流す                |
| web      | Deployment(2) + Svc + Ingress | ステートレス。replicas を増やして水平スケール可              |
| bot      | Deployment(1)                 | Discord Gateway は単一前提。**replicas は必ず 1 / Recreate** |

## ステージング検証（最短・kustomize）

このブランチの PostgreSQL 版イメージ（`sha-2a7a489`、`kustomization.yaml` で固定）を一括適用する。
`migrate` Job は postgres を待つ initContainer 入りなので、適用順に依存しない。

```bash
# 1) namespace とシークレット（secret.yaml は gitignore。テンプレから実値を埋める）
kubectl apply -f deploy/k8s/00-namespace.yaml
cp deploy/k8s/10-secret.example.yaml deploy/k8s/secret.yaml && $EDITOR deploy/k8s/secret.yaml
kubectl apply -f deploy/k8s/secret.yaml

# 2) 残りを一括適用（postgres/migrate/web/bot）
kubectl apply -k deploy/k8s/

# 3) 確認
kubectl -n ikaskey-gatekeeper get pods,svc,job
kubectl -n ikaskey-gatekeeper logs job/gatekeeper-migrate
```

> ステージングは別インスタンス推奨（`secret.yaml` の `DISCORD_GUILD_ID` / `MISSKEY_APP_NAME` を
> 本番と分ける）。イメージタグを変えるときは `kustomization.yaml` の `newTag` を編集。

## 適用手順（個別 apply・順序を学ぶ場合）

```bash
kubectl apply -f deploy/k8s/00-namespace.yaml

# シークレットを用意（テンプレをコピーして実値を埋める。secret.yaml は .gitignore 済み）
cp deploy/k8s/10-secret.example.yaml deploy/k8s/secret.yaml
$EDITOR deploy/k8s/secret.yaml
kubectl apply -f deploy/k8s/secret.yaml

kubectl apply -f deploy/k8s/20-postgres.yaml
kubectl -n ikaskey-gatekeeper rollout status statefulset/postgres

# マイグレーション（再実行時は先に delete）
kubectl -n ikaskey-gatekeeper delete job gatekeeper-migrate --ignore-not-found
kubectl apply -f deploy/k8s/30-migrate-job.yaml
kubectl -n ikaskey-gatekeeper wait --for=condition=complete job/gatekeeper-migrate --timeout=120s

kubectl apply -f deploy/k8s/40-web.yaml
kubectl apply -f deploy/k8s/50-bot.yaml
```

## 公開

- **Traefik(k3s 同梱)**: `40-web.yaml` の Ingress（host を合わせる）。
- **cloudflared トンネル**: Ingress は不要。トンネルの service を
  `http://web.ikaskey-gatekeeper.svc.cluster.local:3001` に向ける。`PUBLIC_BASE_URL` は公開 URL に一致させる。

## 更新（新しいイメージの取り込み）

`:latest` を使っているため、再 pull させるには rollout restart する（または `IMAGE_TAG` 相当に
イメージを固定して書き換える）。

```bash
kubectl -n ikaskey-gatekeeper delete job gatekeeper-migrate --ignore-not-found
kubectl apply -f deploy/k8s/30-migrate-job.yaml   # スキーマ変更がある場合
kubectl -n ikaskey-gatekeeper rollout restart deployment/web deployment/bot
```

## スケールの注意

- `web` は `kubectl -n ikaskey-gatekeeper scale deployment/web --replicas=N` で増やせる（ステートレス）。
- `bot` は **絶対に増やさない**（Gateway 二重接続でイベント二重処理になる）。
- 認証 state / セッションは DB(Postgres) 共有なので、どの web pod が処理しても整合する。

## 既存 SQLite データの移行（本番カットオーバー時）

現行 Docker は SQLite。Postgres へデータを移すには [pgloader](https://pgloader.io/) が手軽:

```bash
# 例: pgloader で SQLite → Postgres へコピー
pgloader ./data/prod.db \
  postgresql://gatekeeper:PASSWORD@<postgres-host>:5432/gatekeeper
```

スキーマは Prisma migrate で先に作成しておき、pgloader は `WITH data only` 等でデータのみ流すのが安全。
移行前に `SWEEP_ENABLED=false` のまま、移行後に件数（Link 等）を突き合わせて検証する。

> 注意: この構成（Postgres）は現行の SQLite 本番とは互換が無い。`main` へ取り込む際は
> 本番の Postgres 化（データ移行込み）と同時に行う、計画的なカットオーバーが必要。
