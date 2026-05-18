export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
}

export function LoadingSpinner({ size = "md", label = "読み込み中" }: LoadingSpinnerProps) {
  const px = size === "sm" ? 16 : size === "lg" ? 48 : 28;
  return (
    <div role="status" className="flex items-center gap-2">
      <div
        className="inline-block rounded-full animate-spin"
        style={{
          width: px,
          height: px,
          border: "3px solid var(--qolc-border)",
          borderTopColor: "var(--qolc-primary)",
        }}
        aria-hidden="true"
      />
      <span className="text-sm" style={{ color: "var(--qolc-muted)" }}>
        {label}
      </span>
    </div>
  );
}
