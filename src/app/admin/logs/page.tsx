import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ActivityLogView } from "@/components/shared/activity-log-view";

export default function AdminLogsPage() {
  return (
    <PortalLayout portal="admin">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/admin/dashboard" }, { label: "操作ログ" }]} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">操作ログ</h1>
        <p className="mt-2" style={{ color: "var(--qolc-muted)" }}>
          決済の実行・取消・返金などの操作履歴です（全施設）。
        </p>
      </div>
      <ActivityLogView />
    </PortalLayout>
  );
}
