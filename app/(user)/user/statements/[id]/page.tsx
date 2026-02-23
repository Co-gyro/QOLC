"use client";

import { useParams } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle, Clock } from "lucide-react";

const statementDetails: Record<string, {
  id: string; date: string; provider: string; providerAddress: string;
  description: string; totalAmount: number; selfPayAmount: number;
  insuranceAmount: number; status: "completed" | "pending";
  items: { label: string; amount: number }[];
}> = {
  s1: { id: "s1", date: "2025-02-10", provider: "田中内科クリニック", providerAddress: "東京都新宿区西新宿2-1-1", description: "初診料", totalAmount: 2820, selfPayAmount: 850, insuranceAmount: 1970, status: "completed", items: [{ label: "初診料", amount: 2880 }, { label: "医学管理料", amount: -60 }] },
  s2: { id: "s2", date: "2025-02-10", provider: "さくら薬局", providerAddress: "東京都新宿区西新宿3-5-2", description: "調剤料", totalAmount: 1540, selfPayAmount: 460, insuranceAmount: 1080, status: "completed", items: [{ label: "調剤基本料", amount: 420 }, { label: "薬剤料", amount: 1120 }] },
  s3: { id: "s3", date: "2025-02-08", provider: "田中内科クリニック", providerAddress: "東京都新宿区西新宿2-1-1", description: "訪問診療料", totalAmount: 8880, selfPayAmount: 2660, insuranceAmount: 6220, status: "pending", items: [{ label: "訪問診療料（同一建物）", amount: 8880 }] },
};

export default function UserStatementDetailPage() {
  const params = useParams();
  const detail = statementDetails[params.id as string];
  if (!detail) return <div className="px-4 py-12 text-center"><p className="text-base text-gray-500">明細が見つかりませんでした</p></div>;
  const isCompleted = detail.status === "completed";
  return (
    <div className="px-4 py-5 space-y-5">
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl ${isCompleted ? "bg-emerald-50 border border-emerald-200" : "bg-orange-50 border border-orange-200"}`}>
        {isCompleted ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <Clock className="w-5 h-5 text-orange-500" />}
        <span className={`text-sm font-semibold ${isCompleted ? "text-emerald-700" : "text-orange-600"}`}>{isCompleted ? "決済完了" : "未決済"}</span>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm text-center">
        <p className="text-sm text-gray-500">自己負担額</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{formatCurrency(detail.selfPayAmount)}</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-gray-500">サービス情報</h3>
        <div className="space-y-2">
          <div className="flex justify-between"><span className="text-sm text-gray-500">サービス日</span><span className="text-base text-gray-900">{detail.date}</span></div>
          <div className="flex justify-between"><span className="text-sm text-gray-500">サービス提供者</span><span className="text-base text-gray-900">{detail.provider}</span></div>
          <div className="flex justify-between"><span className="text-sm text-gray-500">内容</span><span className="text-base text-gray-900">{detail.description}</span></div>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-gray-500">金額内訳</h3>
        <div className="space-y-2">
          {detail.items.map((item, i) => (<div key={i} className="flex justify-between"><span className="text-sm text-gray-700">{item.label}</span><span className="text-sm text-gray-900">{formatCurrency(item.amount)}</span></div>))}
          <div className="border-t border-gray-100 pt-2 mt-2">
            <div className="flex justify-between"><span className="text-sm text-gray-500">総額</span><span className="text-base font-medium text-gray-900">{formatCurrency(detail.totalAmount)}</span></div>
            <div className="flex justify-between mt-1"><span className="text-sm text-gray-500">保険負担額</span><span className="text-base text-gray-600">−{formatCurrency(detail.insuranceAmount)}</span></div>
            <div className="flex justify-between mt-2 pt-2 border-t border-gray-100"><span className="text-sm font-semibold text-gray-900">自己負担額</span><span className="text-lg font-bold text-emerald-600">{formatCurrency(detail.selfPayAmount)}</span></div>
          </div>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-2">
        <h3 className="text-sm font-semibold text-gray-500">サービス提供者情報</h3>
        <p className="text-base text-gray-900">{detail.provider}</p>
        <p className="text-sm text-gray-500">{detail.providerAddress}</p>
      </div>
    </div>
  );
}
