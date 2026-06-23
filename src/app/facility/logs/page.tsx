import { PortalLayout } from "@/components/layout/portal-layout";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ActivityLogView } from "@/components/shared/activity-log-view";

export default function FacilityLogsPage() {
  return (
    <PortalLayout portal="facility">
      <Breadcrumb items={[{ label: "ダッシュボード", href: "/facility/dashboard" }, { label: "操作ログ" }]} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">操作ログ</h1>
        <p className="mt-2" style={{ color: "var(--qolc-muted)" }}>
          自施設の入居者に関する決済の操作履歴です。
        </p>
      </div>
      <ActivityLogView />
    </PortalLayout>
  );
}
