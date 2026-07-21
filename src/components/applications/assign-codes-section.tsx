"use client";

/**
 * 申請前採番セクション（加盟店申請の登録手続き内）
 *
 * モールコード・端末識別番号をプールから払い出して案件に保存する。
 * 採番済みなら値を表示するだけ（再採番はさせない＝プールとの齟齬防止）。
 * 採番結果は申請書生成フォームへ自動転記され、加盟店変換でも同じ値が使われる。
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { assignApplicationCodes } from "@/lib/applications/client";
import { parseUdInput } from "@/lib/applications/ud-input";
import { fetchPoolAvailability, type PoolAvailability } from "@/lib/portal/admin-queries";
import type { ApplicationDetail } from "@/lib/applications/types";

export interface AssignCodesSectionProps {
  detail: ApplicationDetail;
  /** 採番成功後に詳細を再読込させる */
  onAssigned: () => void;
}

export function AssignCodesSection({ detail, onAssigned }: AssignCodesSectionProps) {
  const { codes } = parseUdInput(detail.udInput ?? null);
  const [pool, setPool] = useState<PoolAvailability | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (codes) return; // 採番済みなら残数表示は不要
    fetchPoolAvailability()
      .then(setPool)
      .catch(() => setPool(null));
  }, [codes]);

  async function handleAssign() {
    setRunning(true);
    setError(null);
    try {
      await assignApplicationCodes(detail.id);
      onAssigned();
    } catch (e) {
      setError(e instanceof Error ? e.message : "採番に失敗しました");
    } finally {
      setRunning(false);
    }
  }

  if (codes) {
    return (
      <dl className="grid grid-cols-[10em_1fr] gap-x-3 gap-y-1 text-sm">
        <dt style={{ color: "var(--qolc-muted)" }}>モールコード</dt>
        <dd className="font-medium tabular-nums">{codes.mall_code}</dd>
        <dt style={{ color: "var(--qolc-muted)" }}>端末識別番号</dt>
        <dd className="font-medium tabular-nums">{codes.terminal_id}</dd>
        <dt style={{ color: "var(--qolc-muted)" }}>状態</dt>
        <dd style={{ color: "var(--qolc-primary)" }} className="font-medium">
          採番済み — 申請書と加盟店登録にこの値が自動で使われます
        </dd>
      </dl>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
        プールから未使用のモールコード（A300〜A3ZZ）と端末識別番号を1件ずつ払い出します。
        採番した値は申請書の作成・審査通過後の加盟店登録まで一貫して使われます。
        {pool && (
          <span className="ml-1">
            （残数: モール {pool.mallCode.available} / 端末 {pool.terminalId.available}）
          </span>
        )}
      </p>
      {error && (
        <p className="text-sm" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}
      <div>
        <Button
          type="button"
          disabled={running}
          onClick={() => void handleAssign()}
          style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}
        >
          {running ? "採番中…" : "モールコード・端末番号を採番する"}
        </Button>
      </div>
    </div>
  );
}
