import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="パンくず" className="text-sm mb-4">
      <ol className="flex items-center gap-2 flex-wrap">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-center gap-2">
            {item.href ? (
              <Link
                href={item.href}
                className="hover:underline"
                style={{ color: "var(--qolc-primary)" }}
              >
                {item.label}
              </Link>
            ) : (
              <span style={{ color: "var(--qolc-muted)" }}>{item.label}</span>
            )}
            {idx < items.length - 1 && (
              <span style={{ color: "var(--qolc-border)" }}>/</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
