import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  emphasis?: boolean;
}

export function StatCard({ label, value, unit, hint, emphasis }: StatCardProps) {
  return (
    <Card style={emphasis ? { borderColor: "var(--qolc-primary)" } : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium" style={{ color: "var(--qolc-muted)" }}>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span
            className="text-3xl font-bold"
            style={emphasis ? { color: "var(--qolc-primary)" } : { color: "var(--qolc-text)" }}
          >
            {typeof value === "number" ? value.toLocaleString("ja-JP") : value}
          </span>
          {unit && <span className="text-sm text-gray-500">{unit}</span>}
        </div>
        {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
