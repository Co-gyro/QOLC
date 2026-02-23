"use client";

import { useState, useMemo } from "react";
import Header from "@/components/layout/Header";
import Card, { CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_COLORS,
  NOTIFICATION_STATUS_LABELS,
} from "@/lib/constants";
import type { Notification as AppNotification } from "@/lib/types";

// ダミーデータ（フィルター用に施設・加盟店・入居者情報を付加）
type NotificationWithRelations = AppNotification & {
  residentName?: string;
  facilityId?: string;
  facilityName?: string;
  merchantId?: string;
  merchantName?: string;
};

const dummyNotifications: NotificationWithRelations[] = [
  {
    id: "n1",
    userId: "u4",
    type: "system",
    channel: "web",
    title: "決済失敗：田中 一郎様（東京介護タクシー）",
    body: "カード有効期限切れのため決済に失敗しました。カード情報の更新を入居者ご家族に依頼してください。",
    relatedId: "st3",
    status: "sent",
    sentAt: "2025-02-10T09:05:00Z",
    createdAt: "2025-02-10T09:05:00Z",
    residentName: "田中 一郎",
    facilityId: "fac1",
    facilityName: "さくら介護施設",
    merchantId: "m3",
    merchantName: "東京介護タクシー",
  },
  {
    id: "n2",
    userId: "u3",
    type: "statement",
    channel: "web",
    title: "明細アップロード：田中内科クリニック 12件",
    body: "田中内科クリニックから2月分の利用明細12件がアップロードされました。",
    status: "sent",
    sentAt: "2025-02-10T08:00:00Z",
    createdAt: "2025-02-10T08:00:00Z",
    facilityId: "fac1",
    facilityName: "さくら介護施設",
    merchantId: "m1",
    merchantName: "田中内科クリニック",
  },
  {
    id: "n3",
    userId: "u4",
    type: "receipt",
    channel: "line",
    title: "1月分領収書が発行されました",
    body: "山田 太郎様の2025年1月分の領収書（田中内科クリニック）が発行されました。LINEからダウンロードできます。",
    relatedId: "rec1",
    status: "sent",
    sentAt: "2025-02-01T00:05:00Z",
    createdAt: "2025-02-01T00:05:00Z",
    residentName: "山田 太郎",
    facilityId: "fac1",
    facilityName: "さくら介護施設",
    merchantId: "m1",
    merchantName: "田中内科クリニック",
  },
  {
    id: "n4",
    userId: "u5",
    type: "receipt",
    channel: "email",
    title: "1月分領収書が発行されました",
    body: "鈴木 花子様の2025年1月分の領収書（さくら訪問看護ステーション）が発行されました。",
    relatedId: "rec2",
    status: "failed",
    createdAt: "2025-02-01T00:05:00Z",
    residentName: "鈴木 花子",
    facilityId: "fac2",
    facilityName: "あおぞらケアホーム",
    merchantId: "m2",
    merchantName: "さくら訪問看護ステーション",
  },
  {
    id: "n5",
    userId: "u3",
    type: "system",
    channel: "web",
    title: "2月分領収書 自動発行完了（32件）",
    body: "あおぞらケアホームの2025年1月分の領収書32件が自動発行されました。",
    status: "sent",
    sentAt: "2025-02-01T00:10:00Z",
    createdAt: "2025-02-01T00:10:00Z",
    facilityId: "fac2",
    facilityName: "あおぞらケアホーム",
  },
];

const channelLabels: Record<string, string> = {
  line: "LINE",
  email: "メール",
  web: "Web",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

type Tab = "all" | "errors";

export default function NotificationsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [residentFilter, setResidentFilter] = useState("");
  const [facilityFilter, setFacilityFilter] = useState("");
  const [merchantFilter, setMerchantFilter] = useState("");

  const residents = useMemo(() => {
    const map = new Map<string, string>();
    dummyNotifications.forEach((n) => { if (n.residentName) map.set(n.residentName, n.residentName); });
    return Array.from(map.values());
  }, []);

  const facilities = useMemo(() => {
    const map = new Map<string, string>();
    dummyNotifications.forEach((n) => { if (n.facilityId && n.facilityName) map.set(n.facilityId, n.facilityName); });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, []);

  const merchants = useMemo(() => {
    const map = new Map<string, string>();
    dummyNotifications.forEach((n) => { if (n.merchantId && n.merchantName) map.set(n.merchantId, n.merchantName); });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, []);

  const filtered = useMemo(() => {
    let result = dummyNotifications;
    if (tab === "errors") result = result.filter((n) => n.status === "failed");
    if (residentFilter) result = result.filter((n) => n.residentName === residentFilter);
    if (facilityFilter) result = result.filter((n) => n.facilityId === facilityFilter);
    if (merchantFilter) result = result.filter((n) => n.merchantId === merchantFilter);
    return result;
  }, [tab, residentFilter, facilityFilter, merchantFilter]);

  const failedCount = dummyNotifications.filter((n) => n.status === "failed").length;
  const sentCount = dummyNotifications.filter((n) => n.status === "sent").length;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "all", label: "配信履歴" },
    { key: "errors", label: "配信エラー", count: failedCount },
  ];

  return (
    <div>
      <Header
        title="通知管理"
        description="通知の配信履歴・エラー確認を行います"
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardBody className="py-3 px-4">
            <p className="text-xs text-gray-500">今月の配信数</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{dummyNotifications.length}件</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3 px-4">
            <p className="text-xs text-gray-500">配信成功</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{sentCount}件</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-3 px-4">
            <p className="text-xs text-gray-500">配信エラー</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{failedCount}件</p>
          </CardBody>
        </Card>
      </div>

      <div className="flex gap-1 mb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                tab === t.key ? "bg-blue-500 text-white" : "bg-red-100 text-red-700"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-500">絞り込み:</span>
        <select
          value={residentFilter}
          onChange={(e) => setResidentFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">すべての利用者</option>
          {residents.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select
          value={facilityFilter}
          onChange={(e) => setFacilityFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">すべての施設</option>
          {facilities.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <select
          value={merchantFilter}
          onChange={(e) => setMerchantFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">すべてのサービス提供者</option>
          {merchants.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-center text-gray-400 py-4">該当する通知がありません</p>
            </CardBody>
          </Card>
        ) : (
          filtered.map((notification) => (
            <Card key={notification.id}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={NOTIFICATION_TYPE_COLORS[notification.type]}>
                        {NOTIFICATION_TYPE_LABELS[notification.type]}
                      </Badge>
                      <Badge className="bg-gray-100 text-gray-600">
                        {channelLabels[notification.channel]}
                      </Badge>
                      <Badge className={statusColors[notification.status]}>
                        {NOTIFICATION_STATUS_LABELS[notification.status]}
                      </Badge>
                    </div>
                    <h3 className="font-medium text-gray-900">
                      {notification.title}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {notification.body}
                    </p>
                    {(notification.facilityName || notification.merchantName) && (
                      <p className="text-xs text-gray-400 mt-1">
                        {[notification.facilityName, notification.merchantName].filter(Boolean).join(" / ")}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                    {formatDate(notification.createdAt)}
                  </span>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
