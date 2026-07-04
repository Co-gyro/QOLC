"use client";

/**
 * /admin/today … 「今日のUD」ホーム
 *
 * 出勤したらまずこの画面。①マイタスク ②新着・未対応 ③要対応アラート ④チーム状況。
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
  buildMyTasks,
  selectOverdueRuns,
  buildTeamStatus,
  type TodayRun,
  type TodayApplication,
  type PaymentAlertCounts,
} from "@/lib/portal/today-queries";
import { toJstDateString } from "@/lib/portal/workflow-logic";
import { getJstDateParts } from "@/lib/workflow/utils";
import type { AssigneeOption } from "@/lib/applications/types";
import { MyTasksSection } from "./my-tasks-section";
import { NewAppsSection } from "./new-apps-section";
import { AlertsSection } from "./alerts-section";
import { TeamSection } from "./team-section";

interface TodayData {
  userId: string | null;
  runs: TodayRun[];
  apps: TodayApplication[];
  payments: PaymentAlertCounts | null;
  assignees: AssigneeOption[];
  pool: PoolAvailability | null;
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
      const [{ data: userData }, runs, apps, payments, assignees, pool] = await Promise.all([
        supabase.auth.getUser(),
        fetchOpenWorkflowRuns(), // 内部で空配列フォールバック
        safe(fetchOpenApplicationsToday()),
        safe(fetchPaymentAlertCounts()),
        safe(fetchAssignees()),
        safe(fetchPoolAvailability()),
      ]);
      setData({
        userId: userData.user?.id ?? null,
        runs,
        apps: apps ?? [],
        payments,
        assignees: assignees ?? [],
        pool,
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

  const myTasks = useMemo(
    () => (data && data.userId ? buildMyTasks(data.runs, data.apps, data.userId) : []),
    [data]
  );
  const overdueRuns = useMemo(
    () => (data ? selectOverdueRuns(data.runs, todayStr) : []),
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
          今日やること・新着・アラート・チームの状況をまとめて確認できます。出勤したらまずこの画面から始めてください。
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
          <MyTasksSection items={myTasks} todayStr={todayStr} />
          <NewAppsSection apps={data.apps} />
          <AlertsSection payments={data.payments} overdueRuns={overdueRuns} pool={data.pool} />
          {team && <TeamSection team={team} />}
        </>
      )}
    </PortalLayout>
  );
}
