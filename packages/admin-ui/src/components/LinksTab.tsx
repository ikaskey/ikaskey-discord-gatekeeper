import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import type { LinkRow } from "../types.js";
import { Button, Card, ErrorBanner, Loading, SectionTitle, TextInput } from "./ui.js";

/**
 * 「連携管理」タブ。認証済みユーザーの連携一覧を表示し、解除（unlink）できる。
 *
 * @remarks
 * 解除すると当人は認証パネルから別の Misskey アカウントで認証し直せる。
 * Discord 上の会員ロールやサーバー参加自体はここでは変更しない（再認証で再確認される）。
 *
 * @since 0.8.2
 */
export function LinksTab(): ReactNode {
  const [items, setItems] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  /** 連携一覧を再取得する。 */
  async function reload(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.getLinks());
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  /** 検索で絞り込んだ表示用リスト。 */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (l) =>
        l.username.toLowerCase().includes(q) ||
        l.discordId.includes(q) ||
        l.misskeyId.toLowerCase().includes(q),
    );
  }, [items, query]);

  /** 連携解除（確認あり）。 */
  async function unlink(l: LinkRow): Promise<void> {
    const ok = window.confirm(
      `@${l.username}（Discord: ${l.discordId}）の連携を解除します。\n` +
        `解除後、当人は別のいかすきーアカウントで認証し直せます。よろしいですか？`,
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteLink(l.discordId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "解除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>連携管理</SectionTitle>
        <p className="mb-3 text-sm text-[#8b949e]">
          認証済みユーザーの連携一覧です。別アカウントへ切り替えたい人は、ここで解除すると認証し直せます。
        </p>
        {error && <ErrorBanner message={error} />}
        <div className="mb-3 max-w-sm">
          <TextInput
            value={query}
            onChange={setQuery}
            placeholder="ユーザー名 / Discord ID / Misskey ID で検索"
            ariaLabel="連携検索"
          />
        </div>
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <p className="py-4 text-sm text-[#8b949e]">
            {items.length === 0 ? "連携がありません。" : "該当する連携がありません。"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[#8b949e]">
                <tr className="border-b border-[#30363d]">
                  <th className="py-2 pr-4 font-medium">Misskey</th>
                  <th className="py-2 pr-4 font-medium">Discord ID</th>
                  <th className="py-2 pr-4 font-medium">状態</th>
                  <th className="py-2 pr-4 font-medium">連携日時</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.discordId} className="border-b border-[#21262d] text-[#e6edf3]">
                    <td className="py-2 pr-4">
                      @{l.username}
                      {l.misskeyHost ? (
                        <span className="text-[#8b949e]">@{l.misskeyHost}</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{l.discordId}</td>
                    <td className="py-2 pr-4 text-xs">{l.status}</td>
                    <td className="py-2 pr-4 text-xs text-[#8b949e]">{formatDate(l.linkedAt)}</td>
                    <td className="py-2">
                      <Button variant="danger" disabled={busy} onClick={() => void unlink(l)}>
                        連携解除
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/** ISO 文字列をローカル日時表記へ整形する。 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ja-JP");
}
