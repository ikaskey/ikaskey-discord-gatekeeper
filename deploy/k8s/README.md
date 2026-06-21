# k3s / Kubernetes デプロイ

PostgreSQL を共有 DB に使い、`web` を水平スケール、`bot` を単一インスタンスで運用する構成。
イメージは ghcr（public）からそのまま pull する。

## 構成

| 対象     | 種別                          | 備考                                                         |
| -------- | ----------------------------- | ------------------------------------------------------------ |
| postgres | StatefulSet + Service         | local-path PVC で永続化。単一ノードに固定                    |
| migrate  | Job                           | `prisma migrate deploy`。postgres 待ち initContainer 入り    |
| web      | Deployment(2) + Svc + Ingress | ステートレス。replicas を増やして水平スケール可              |
| bot      | Deployment(1)                 | Discord Gateway は単一前提。**replicas は必ず 1 / Recreate** |

```
deploy/k8s/
  base/      … 本番相当の素材（bot=1）。`kubectl apply -k deploy/k8s/base/`
  staging/   … 検証用 overlay（bot=0）。`kubectl apply -k deploy/k8s/staging/`
  10-secret.example.yaml … Secret テンプレ（実値は secret.yaml にして apply、gitignore 済み）
```

## ステージング検証（トークン取り直し不要）

**Gateway 接続を二重化してはいけないのは `bot` プロセスだけ**。`web` は `@discordjs/rest`（REST のみ・
Gateway を張らない）なので、**本番と同じ `DISCORD_TOKEN` でも本番 bot と衝突しない**。
そこで staging overlay は **bot を 0 replica** にして、postgres + migrate + web だけ起動する。
これで「Postgres 対応・migrate・web の水平スケール」をトークン取り直し無しで安全に検証できる。

```bash
git fetch && git checkout feat/k3s-postgres   # k3s を操作できる環境で

# 1) namespace とシークレット（テンプレから実値を埋める。secret.yaml は gitignore）
kubectl apply -f deploy/k8s/base/00-namespace.yaml
cp deploy/k8s/10-secret.example.yaml deploy/k8s/secret.yaml && $EDITOR deploy/k8s/secret.yaml
kubectl apply -f deploy/k8s/secret.yaml

# 2) staging を一括適用（bot は 0／postgres・migrate・web が起動）
kubectl apply -k deploy/k8s/staging/

# 3) 確認
kubectl -n ikaskey-gatekeeper get pods,svc,job
kubectl -n ikaskey-gatekeeper logs job/gatekeeper-migrate     # スキーマ作成
kubectl -n ikaskey-gatekeeper port-forward svc/web 3001:3001  # 別端末で curl localhost:3001/healthz

# 4) 水平スケールを試す
kubectl -n ikaskey-gatekeeper scale deployment/web --replicas=3
```

> 注意: web は REST で**本番 Guild に対して**操作し得る（同じ `DISCORD_TOKEN`/`DISCORD_GUILD_ID` の場合）。
> 認証フローを最後まで通すと本番 Guild に参加/ロール付与が走る。DB は staging Postgres に分離されるが、
> Discord 側の副作用を避けたいなら `/healthz`・スケール・migrate の確認に留めるか、捨てアカウントで試す。

## 本番相当の適用（base・bot=1）

イメージタグは `base/kustomization.yaml` の `images[].newTag` で 1 か所管理。

```bash
kubectl apply -f deploy/k8s/secret.yaml
kubectl apply -k deploy/k8s/base/
```

個別 apply（順序を学ぶ場合）も可:

```bash
kubectl apply -f deploy/k8s/base/00-namespace.yaml
kubectl apply -f deploy/k8s/secret.yaml
kubectl apply -f deploy/k8s/base/20-postgres.yaml
kubectl -n ikaskey-gatekeeper rollout status statefulset/postgres
kubectl -n ikaskey-gatekeeper delete job gatekeeper-migrate --ignore-not-found
kubectl apply -f deploy/k8s/base/30-migrate-job.yaml
kubectl -n ikaskey-gatekeeper wait --for=condition=complete job/gatekeeper-migrate --timeout=120s
kubectl apply -f deploy/k8s/base/40-web.yaml
kubectl apply -f deploy/k8s/base/50-bot.yaml
```

## 公開

- **Traefik(k3s 同梱)**: `base/40-web.yaml` の Ingress（host を合わせる）。
- **cloudflared トンネル**: Ingress は不要。トンネルの service を
  `http://web.ikaskey-gatekeeper.svc.cluster.local:3001` に向ける。`PUBLIC_BASE_URL` は公開 URL に一致させる。

## 更新（新しいイメージの取り込み）

`newTag` を書き換えて `apply -k` するか、タグ据え置きなら `rollout restart`:

```bash
kubectl -n ikaskey-gatekeeper delete job gatekeeper-migrate --ignore-not-found
kubectl apply -k deploy/k8s/base/          # スキーマ変更がある場合は migrate Job も流れる
kubectl -n ikaskey-gatekeeper rollout restart deployment/web deployment/bot
```

## スケールの注意

- `web` は `scale deployment/web --replicas=N` で増やせる（ステートレス・REST のみ）。
- `bot` は **絶対に増やさない**（Gateway 二重接続でイベント二重処理になる）。
- 認証 state / セッションは Postgres 共有なので、どの web pod が処理しても整合する。

## 既存 SQLite データの移行（本番カットオーバー時）

現行 Docker は SQLite。Postgres へデータを移すには [pgloader](https://pgloader.io/) が手軽:

```bash
pgloader ./data/prod.db \
  postgresql://gatekeeper:PASSWORD@<postgres-host>:5432/gatekeeper
```

スキーマは Prisma migrate で先に作成し、pgloader はデータのみ流すのが安全。移行前後で件数（Link 等）を照合する。

> 注意: この構成（Postgres）は現行の SQLite 本番と非互換。`main` へ取り込む際は、本番の Postgres 化
> （データ移行込み）と同時に行う計画的なカットオーバーが必要。
