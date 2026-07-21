"use client";

/**
 * /admin/today … 「今日のUD」ホーム（v2・業務ファースト構成）
 *
 * 出勤したらまずこの画面。サイドバーの業務単位（相談・問い合わせ／加盟店申請・登録／
 * 日次決済／月次精算）で「今日動くべきもの」をまとめ、行クリックで各業務ページへ遷移する。
 * workflow 系テーブルが未適用の DB でも画面全体は落ちない（クエリ側で空配列フォールバック）。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { fetchAssignees } from "@/lib/applications/client";
import { fetchPoolAvailability, type PoolAvailability } from "@/lib/portal/admin-queries";
import {
  fetchOpenWorkflowRuns,
  fetchOpenApplicationsToday,
  fetchPaymentAlertCounts,
  buildTeamStatus,
  type TodayRun,
  type TodayApplication,
  type PaymentAlertCounts,
} from "@/lib/portal/today-queries";
import { buildTodayGroups } from "@/lib/portal/today-groups";
import { fetchOpsTasks } from "@/lib/ops-tasks/client";
import type { OpsTask } from "@/lib/ops-tasks/logic";
import { toJstDateString } from "@/lib/portal/workflow-logic";
import { getJstDateParts } from "@/lib/workflow/utils";
import type { AssigneeOption } from "@/lib/applications/types";
import { TodayGroupsSection } from "./today-groups-section";
import { TeamSection } from "./team-section";

interface TodayData {
  userId: string | null;
  runs: TodayRun[];
  apps: TodayApplication[];
  payments: PaymentAlertCounts | null;
  assignees: AssigneeOption[];
  pool: PoolAvailability | null;
  opsTasks: OpsTask[];
}

/** 失敗しても null を返す（1つの集計失敗で画面全体を落とさない） */
async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export default function AdminTodayPage() {
  const [data, setData] = useState<TodayData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const [{ data: userData }, runs, apps, payments, assignees, pool, ops] =
        await Promise.all([
          supabase.auth.getUser(),
          fetchOpenWorkflowRuns(), // 内部で空配列フォールバック
          safe(fetchOpenApplicationsToday()),
          safe(fetchPaymentAlertCounts()),
          safe(fetchAssignees()),
          safe(fetchPoolAvailability()),
          fetchOpsTasks(), // 内部で unavailable フォールバック
        ]);
      setData({
        userId: userData.user?.id ?? null,
        runs,
        apps: apps ?? [],
        payments,
        assignees: assignees ?? [],
        pool,
        opsTasks: ops.tasks,
      });
      if (apps === null) {
        setError("一部のデータ（申請）を取得できませんでした。再読み込みしてください。");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
      setData(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const todayStr = useMemo(() => toJstDateString(getJstDateParts()), []);
  const parts = useMemo(() => getJstDateParts(), []);

  const groups = useMemo(
    () =>
      data
        ? buildTodayGroups(data.apps, data.runs, data.payments, data.pool, todayStr, data.opsTasks)
        : [],
    [data, todayStr]
  );
  const team = useMemo(
    () => (data ? buildTeamStatus(data.assignees, data.apps, data.runs) : null),
    [data]
  );

  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "今日のUD" }]} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          今日のUD
          <span className="ml-3 text-base font-normal" style={{ color: "var(--qolc-muted)" }}>
            {parts.year}年{parts.month}月{parts.day}日
          </span>
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--qolc-muted)" }}>
          業務ごとに「今日動くべきもの」をまとめています。行をクリックすると各業務の画面で対応できます。
        </p>
      </div>

      {error && (
        <p className="text-sm my-3" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}

      {!data ? (
        <LoadingSpinner />
      ) : (
        <>
          <TodayGroupsSection groups={groups} />
          {team && <TeamSection team={team} />}
        </>
      )}
    </PortalLayout>
  );
}
