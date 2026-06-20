import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { api } from "../api.js";
import type { AuditLog } from "../types.js";
import { Card, ErrorBanner, Loading, SectionTitle } from "./ui.js";

/**
 * 「監査ログ」タブ。直近の操作ログを日時降順で表示する。
 *
 * @since 0.4.0
 */
export function AuditLogTab(): ReactNode {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        setLogs(await api.getAudit());
      } catch (err) {
        setError(err instanceof Error ? err.message : "取得に失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Card>
      <SectionTitle>監査ログ</SectionTitle>
      {error && <ErrorBanner message={error} />}
      {loading ? (
        <Loading />
      ) : logs.length === 0 ? (
        <p className="py-4 text-sm text-[#8b949e]">ログがありません。</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[#8b949e]">
              <tr className="border-b border-[#30363d]">
                <th className="py-2 pr-4 font-medium">日時</th>
                <th className="py-2 pr-4 font-medium">種別</th>
                <th className="py-2 pr-4 font-medium">概要</th>
                <th className="py-2 font-medium">実行者</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-[#21262d] text-[#e6edf3]">
                  <td className="whitespace-nowrap py-2 pr-4 text-xs text-[#8b949e]">
                    {formatDate(log.at)}
                  </td>
                  <td className="py-2 pr-4">
                    <TypeBadge type={log.type} />
                  </td>
                  <td className="py-2 pr-4">{log.summary}</td>
                  <td className="py-2 text-[#8b949e]">{log.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/**
 * 監査ログ種別の色分けバッジ。
 * @since 0.4.0
 */
function TypeBadge({ type }: { type: string }): ReactNode {
  const color = badgeColor(type);
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        color: color.fg,
        backgroundColor: color.bg,
        border: `1px solid ${color.border}`,
      }}
    >
      {type}
    </span>
  );
}

/** 種別文字列から安定的に配色を決める。 */
function badgeColor(type: string): { fg: string; bg: string; border: string } {
  const palette = [
    { fg: "#86b300", bg: "rgba(134,179,0,0.12)", border: "rgba(134,179,0,0.4)" },
    { fg: "#58a6ff", bg: "rgba(88,166,255,0.12)", border: "rgba(88,166,255,0.4)" },
    { fg: "#ff7b72", bg: "rgba(248,81,73,0.12)", border: "rgba(248,81,73,0.4)" },
    { fg: "#d2a8ff", bg: "rgba(210,168,255,0.12)", border: "rgba(210,168,255,0.4)" },
    { fg: "#e3b341", bg: "rgba(227,179,65,0.12)", border: "rgba(227,179,65,0.4)" },
    { fg: "#39c5cf", bg: "rgba(57,197,207,0.12)", border: "rgba(57,197,207,0.4)" },
  ];
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = (hash * 31 + type.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length]!;
}

/** ISO 文字列をローカル日時表記へ整形する。 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ja-JP");
}
