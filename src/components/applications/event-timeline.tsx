/**
 * 変更履歴タイムライン（application_events）
 */
import {
  EVENT_KIND_LABELS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  type ApplicationEventKind,
} from "@/lib/applications/labels";
import type { ApplicationEvent } from "@/lib/applications/types";

/** 日時を "YYYY/MM/DD HH:mm" 表記に整形 */
function fmt(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** detail の from/to を人間可読な文言へ変換 */
function describe(ev: ApplicationEvent): string | null {
  const d = ev.detail ?? {};
  const from = d.from as string | null | undefined;
  const to = d.to as string | null | undefined;
  const label = (v: string | null | undefined, map: Record<string, string>) =>
    v == null || v === "" ? "（なし）" : map[v] ?? v;
  switch (ev.kind) {
    case "status_changed":
      return `${label(from, STATUS_LABELS)} → ${label(to, STATUS_LABELS)}`;
    case "priority_changed":
      return `${label(from, PRIORITY_LABELS)} → ${label(to, PRIORITY_LABELS)}`;
    case "assigned":
      return `担当者を変更しました`;
    case "due_changed":
      return `${from ?? "（なし）"} → ${to ?? "（なし）"}`;
    case "next_action":
      return to ? `「${to}」` : "（クリア）";
    case "commented":
      return (d.text as string | undefined) ?? null;
    default:
      return null;
  }
}

export function EventTimeline({ events }: { events: ApplicationEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
        変更履歴はまだありません。
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-3">
      {events.map((ev) => {
        const kindLabel =
          EVENT_KIND_LABELS[ev.kind as ApplicationEventKind] ?? ev.kind;
        const desc = describe(ev);
        return (
          <li key={ev.id} className="flex gap-3">
            <div
              className="mt-1.5 h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: "var(--qolc-primary)" }}
              aria-hidden="true"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold" style={{ color: "var(--qolc-text)" }}>
                  {kindLabel}
                </span>
                <span className="text-xs" style={{ color: "var(--qolc-muted)" }}>
                  {fmt(ev.createdAt)}
                </span>
              </div>
              {desc && (
                <p className="text-sm mt-0.5" style={{ color: "var(--qolc-text)" }}>
                  {desc}
                </p>
              )}
              <p className="text-xs mt-0.5" style={{ color: "var(--qolc-muted)" }}>
                {ev.actorName ?? "システム / 申請者"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
