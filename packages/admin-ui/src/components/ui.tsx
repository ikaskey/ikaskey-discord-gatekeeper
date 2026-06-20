import type { ReactNode } from "react";

/**
 * 共通の小さな UI 部品群。ダークテーマのカード・ボタン・状態表示など。
 *
 * @since 0.4.0
 */

/**
 * カードコンテナ。
 * @since 0.4.0
 */
export function Card({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4 sm:p-6">{children}</div>
  );
}

/**
 * セクション見出し。
 * @since 0.4.0
 */
export function SectionTitle({ children }: { children: ReactNode }): ReactNode {
  return <h2 className="mb-3 text-base font-semibold text-[#e6edf3]">{children}</h2>;
}

/**
 * ローディング表示。
 * @since 0.4.0
 */
export function Loading(): ReactNode {
  return <div className="py-6 text-sm text-[#8b949e]">読み込み中...</div>;
}

/**
 * エラー表示バナー。
 * @since 0.4.0
 */
export function ErrorBanner({ message }: { message: string }): ReactNode {
  return (
    <div className="rounded-md border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2 text-sm text-[#ff7b72]">
      {message}
    </div>
  );
}

/**
 * プライマリ/セカンダリ/デンジャーのボタン。
 * @since 0.4.0
 */
export function Button(props: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}): ReactNode {
  const { children, onClick, type = "button", variant = "primary", disabled } = props;
  const base =
    "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const styles: Record<string, string> = {
    primary: "bg-[#86b300] text-[#0d1117] hover:bg-[#9bce00]",
    secondary: "border border-[#30363d] bg-[#21262d] text-[#e6edf3] hover:bg-[#30363d]",
    danger: "border border-[#f85149]/40 bg-transparent text-[#ff7b72] hover:bg-[#f85149]/10",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

/**
 * テキスト入力。
 * @since 0.4.0
 */
export function TextInput(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}): ReactNode {
  return (
    <input
      type="text"
      value={props.value}
      placeholder={props.placeholder}
      aria-label={props.ariaLabel}
      onChange={(e) => props.onChange(e.target.value)}
      className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-1.5 text-sm text-[#e6edf3] placeholder-[#6e7681] focus:border-[#86b300] focus:outline-none"
    />
  );
}
