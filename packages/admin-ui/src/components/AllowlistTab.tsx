import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { api } from "../api.js";
import type { Allowlist } from "../types.js";
import { Button, Card, ErrorBanner, Loading, SectionTitle, TextInput } from "./ui.js";

/**
 * 「除外リスト」タブ。キックの対象外にする Discord ユーザーを管理する。
 *
 * @since 0.4.0
 */
export function AllowlistTab(): ReactNode {
  const [items, setItems] = useState<Allowlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [discordId, setDiscordId] = useState("");
  const [reason, setReason] = useState("");

  /** 除外リストを再取得する。 */
  async function reload(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.getAllowlist());
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  /** 追加フォームの送信。 */
  async function submit(): Promise<void> {
    if (!discordId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.putAllowlist({
        discordId: discordId.trim(),
        reason: reason.trim(),
      });
      setDiscordId("");
      setReason("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  /** 行の削除。 */
  async function remove(id: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await api.deleteAllowlist(id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>除外リスト</SectionTitle>
        {error && <ErrorBanner message={error} />}
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <p className="py-4 text-sm text-[#8b949e]">登録がありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[#8b949e]">
                <tr className="border-b border-[#30363d]">
                  <th className="py-2 pr-4 font-medium">Discord ID</th>
                  <th className="py-2 pr-4 font-medium">理由</th>
                  <th className="py-2 pr-4 font-medium">登録日時</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.discordId} className="border-b border-[#21262d] text-[#e6edf3]">
                    <td className="py-2 pr-4 font-mono text-xs">{it.discordId}</td>
                    <td className="py-2 pr-4">{it.reason || "—"}</td>
                    <td className="py-2 pr-4 text-xs text-[#8b949e]">{formatDate(it.createdAt)}</td>
                    <td className="py-2">
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => void remove(it.discordId)}
                      >
                        削除
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>除外を追加</SectionTitle>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-[#8b949e]">
            <span className="mb-1 block">Discord ID</span>
            <TextInput
              value={discordId}
              onChange={setDiscordId}
              placeholder="例: 123456789012345678"
              ariaLabel="Discord ID"
            />
          </label>
          <label className="block text-sm text-[#8b949e]">
            <span className="mb-1 block">理由</span>
            <TextInput
              value={reason}
              onChange={setReason}
              placeholder="例: 運営メンバー"
              ariaLabel="理由"
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <Button disabled={busy || !discordId.trim()} onClick={() => void submit()}>
            保存
          </Button>
        </div>
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
