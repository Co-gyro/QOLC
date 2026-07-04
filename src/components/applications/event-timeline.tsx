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
    case "comment":
      return (d.text as string | undefined) ?? null;
    case "created":
      return d.via === "manual" ? "手動起票（電話・窓口受付）" : null;
    case "email_sent": {
      // 送信結果は2形式に対応する:
      //   手動送信（/email API）… detail.result = { sent, skipped }（ネスト）
      //   受付自動返信（intake） … detail 直下に sent / skipped（フラット）
      const nested = d.result as { sent?: boolean; skipped?: boolean } | undefined;
      const sent = nested?.sent ?? (d.sent as boolean | undefined);
      const skipped = nested?.skipped ?? (d.skipped as boolean | undefined);
      const state = sent
        ? "送信済み"
        : skipped
          ? "送信スキップ（メール基盤未設定のため記録のみ）"
          : "送信失敗";
      return `「${(d.subject as string | undefined) ?? "メール"}」→ ${(d.to as string | undefined) ?? "宛先不明"}：${state}`;
    }
    case "converted": {
      const name = (d.merchant_name as string | undefined) ?? "";
      const note = (d.note as string | null | undefined) ?? null;
      return `加盟店「${name}」として登録しました${note ? `（メモ: ${note}）` : ""}`;
    }
    case "ud_input_updated": {
      const changed = (d.changed as string[] | undefined) ?? [];
      return changed.length > 0 ? `${changed.join("、")} を更新` : "UD追記情報を更新";
    }
    case "review_registered": {
      const company = d.company === "jcb" ? "JCB" : d.company === "saison" ? "セゾン" : "";
      const after = d.after as { result?: string | null } | undefined;
      const result =
        after?.result === "approved" ? "通過" : after?.result === "rejected" ? "NG" : "結果待ち";
      return `${company}：${result}`;
    }
    case "workflow_started": {
      const title = (d.title as string | undefined) ?? "";
      const count = (d.step_count as number | undefined) ?? null;
      return `「${title}」${count != null ? `（全${count}工程）` : ""}を起票`;
    }
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
