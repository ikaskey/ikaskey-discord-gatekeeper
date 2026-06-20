import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ApiError, api } from "./api.js";
import { AllowlistTab } from "./components/AllowlistTab.js";
import { AuditLogTab } from "./components/AuditLogTab.js";
import { RoleMappingsTab } from "./components/RoleMappingsTab.js";
import { Button, ErrorBanner, Loading } from "./components/ui.js";
import type { Me } from "./types.js";

/** タブ識別子。 */
type TabKey = "mappings" | "allowlist" | "audit";

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: "mappings", label: "ロール連動" },
  { key: "allowlist", label: "除外リスト" },
  { key: "audit", label: "監査ログ" },
];

/**
 * 管理画面 SPA のルートコンポーネント。
 *
 * 認証状態を判定し、未認証ならログイン画面、認証済みならヘッダ＋タブを表示する。
 *
 * @since 0.4.0
 */
export function App(): ReactNode {
  const [me, setMe] = useState<Me | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("mappings");

  useEffect(() => {
    (async () => {
      try {
        const m = await api.getMe();
        setMe(m);
        setAuthed(true);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setAuthed(false);
        } else {
          setError(err instanceof Error ? err.message : "通信に失敗しました");
          setAuthed(false);
        }
      }
    })();
  }, []);

  /** ログアウトしてページを再読込する。 */
  async function logout(): Promise<void> {
    try {
      await api.logout();
    } finally {
      window.location.reload();
    }
  }

  if (authed === null) {
    return (
      <Shell>
        <Loading />
      </Shell>
    );
  }

  if (!authed) {
    return <LoginScreen error={error} />;
  }

  return (
    <Shell>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#30363d] pb-4">
        <h1 className="text-lg font-semibold text-[#e6edf3]">いかすきー会員 管理画面</h1>
        <div className="flex items-center gap-3">
          {me && <span className="text-sm text-[#8b949e]">@{me.username}</span>}
          <Button variant="secondary" onClick={() => void logout()}>
            ログアウト
          </Button>
        </div>
      </header>

      <nav className="mb-6 flex gap-1 border-b border-[#30363d]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors " +
              (tab === t.key
                ? "border-[#86b300] text-[#e6edf3]"
                : "border-transparent text-[#8b949e] hover:text-[#e6edf3]")
            }
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "mappings" && <RoleMappingsTab />}
      {tab === "allowlist" && <AllowlistTab />}
      {tab === "audit" && <AuditLogTab />}
    </Shell>
  );
}

/** 全画面の外枠（背景・余白）。 */
function Shell({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</div>
    </div>
  );
}

/** 未認証時のログイン画面。 */
function LoginScreen({ error }: { error: string | null }): ReactNode {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d1117] px-4 text-[#e6edf3]">
      <div className="w-full max-w-sm rounded-lg border border-[#30363d] bg-[#161b22] p-8 text-center">
        <h1 className="mb-1 text-lg font-semibold">いかすきー会員 管理画面</h1>
        <p className="mb-6 text-sm text-[#8b949e]">管理者アカウントでログインしてください。</p>
        {error && (
          <div className="mb-4">
            <ErrorBanner message={error} />
          </div>
        )}
        <a
          href="/admin/auth/start"
          className="inline-flex w-full items-center justify-center rounded-md bg-[#86b300] px-4 py-2 text-sm font-medium text-[#0d1117] transition-colors hover:bg-[#9bce00]"
        >
          いかすきーでログイン
        </a>
      </div>
    </div>
  );
}
