import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ApiError, api } from "../api.js";
import type { MisskeyRole, RoleMapping } from "../types.js";
import { Button, Card, ErrorBanner, Loading, SectionTitle, TextInput } from "./ui.js";

/**
 * 「ロール連動」タブ。Misskey ロールと Discord ロールの対応表を管理する。
 *
 * - マッピング一覧の表示／enabled トグル／削除。
 * - Misskey ロールをプルダウン選択して新規 upsert。
 *
 * @since 0.4.0
 */
export function RoleMappingsTab(): ReactNode {
  const [mappings, setMappings] = useState<RoleMapping[]>([]);
  const [roles, setRoles] = useState<MisskeyRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 追加フォーム状態
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [discordRoleId, setDiscordRoleId] = useState("");
  const [enabled, setEnabled] = useState(true);

  /** マッピング一覧を再取得する。 */
  async function reload(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setMappings(await api.getMappings());
    } catch (err) {
      setError(err instanceof Error ? err.message : "取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  /** Misskey ロール一覧を取得する。token_expired は専用メッセージ。 */
  async function loadRoles(): Promise<void> {
    setRolesError(null);
    try {
      setRoles(await api.getRoles());
    } catch (err) {
      if (err instanceof ApiError && err.code === "token_expired") {
        setRolesError("再ログインしてください");
      } else {
        setRolesError("Misskey ロールの取得に失敗しました");
      }
    }
  }

  useEffect(() => {
    void reload();
    void loadRoles();
  }, []);

  /** enabled トグル。現在値で upsert する。 */
  async function toggleEnabled(m: RoleMapping): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await api.putMapping({
        misskeyRoleId: m.misskeyRoleId,
        misskeyRoleName: m.misskeyRoleName,
        discordRoleId: m.discordRoleId,
        enabled: !m.enabled,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  /** 行の削除。 */
  async function remove(misskeyRoleId: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await api.deleteMapping(misskeyRoleId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  /** 追加フォームの送信。 */
  async function submit(): Promise<void> {
    const role = roles.find((r) => r.id === selectedRoleId);
    if (!role || !discordRoleId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.putMapping({
        misskeyRoleId: role.id,
        misskeyRoleName: role.name,
        discordRoleId: discordRoleId.trim(),
        enabled,
      });
      setSelectedRoleId("");
      setDiscordRoleId("");
      setEnabled(true);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>ロール連動マッピング</SectionTitle>
        {error && <ErrorBanner message={error} />}
        {loading ? (
          <Loading />
        ) : mappings.length === 0 ? (
          <p className="py-4 text-sm text-[#8b949e]">登録がありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[#8b949e]">
                <tr className="border-b border-[#30363d]">
                  <th className="py-2 pr-4 font-medium">有効</th>
                  <th className="py-2 pr-4 font-medium">Misskey ロール</th>
                  <th className="py-2 pr-4 font-medium">Discord ロール ID</th>
                  <th className="py-2 pr-4 font-medium">自動同期</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.misskeyRoleId} className="border-b border-[#21262d] text-[#e6edf3]">
                    <td className="py-2 pr-4">
                      <input
                        type="checkbox"
                        checked={m.enabled}
                        disabled={busy}
                        onChange={() => void toggleEnabled(m)}
                        className="h-4 w-4 accent-[#86b300]"
                        aria-label="有効切り替え"
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <span className="font-medium">{m.misskeyRoleName}</span>
                      <span className="ml-2 text-xs text-[#6e7681]">{m.misskeyRoleId}</span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{m.discordRoleId}</td>
                    <td className="py-2 pr-4">{m.autoSync ? "あり" : "なし"}</td>
                    <td className="py-2">
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => void remove(m.misskeyRoleId)}
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
        <SectionTitle>マッピングを追加 / 更新</SectionTitle>
        {rolesError && <ErrorBanner message={rolesError} />}
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-[#8b949e]">
            <span className="mb-1 block">Misskey ロール</span>
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              disabled={roles.length === 0}
              className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm text-[#e6edf3] focus:border-[#86b300] focus:outline-none"
            >
              <option value="">選択してください</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-[#8b949e]">
            <span className="mb-1 block">Discord ロール ID</span>
            <TextInput
              value={discordRoleId}
              onChange={setDiscordRoleId}
              placeholder="例: 123456789012345678"
              ariaLabel="Discord ロール ID"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-[#e6edf3]">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 accent-[#86b300]"
            />
            有効にする
          </label>
          <Button
            disabled={busy || !selectedRoleId || !discordRoleId.trim()}
            onClick={() => void submit()}
          >
            保存
          </Button>
        </div>
      </Card>
    </div>
  );
}
