export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      className="border-2 border-dashed rounded-lg p-10 text-center"
      style={{ borderColor: "var(--qolc-border)" }}
    >
      <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--qolc-text)" }}>
        {title}
      </h3>
      {description && (
        <p className="text-sm mb-4" style={{ color: "var(--qolc-muted)" }}>
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
