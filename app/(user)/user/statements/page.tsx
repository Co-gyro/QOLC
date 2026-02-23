"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const allStatements: Record<string, typeof statementsData> = {
  "2025-02": [
    { id: "s1", date: "2025-02-10", provider: "田中内科クリニック", description: "初診料", amount: 850, status: "completed" as const },
    { id: "s2", date: "2025-02-10", provider: "さくら薬局", description: "調剤料", amount: 460, status: "completed" as const },
    { id: "s3", date: "2025-02-08", provider: "田中内科クリニック", description: "訪問診療料", amount: 2660, status: "pending" as const },
    { id: "s4", date: "2025-02-07", provider: "あおぞらタクシー", description: "通院送迎", amount: 3200, status: "completed" as const },
    { id: "s5", date: "2025-02-06", provider: "田中内科クリニック", description: "訪問診療料", amount: 2660, status: "completed" as const },
    { id: "s6", date: "2025-02-05", provider: "さくら薬局", description: "調剤料", amount: 290, status: "completed" as const },
    { id: "s7", date: "2025-02-03", provider: "やまと訪問歯科", description: "訪問歯科診療", amount: 1350, status: "completed" as const },
    { id: "s8", date: "2025-02-01", provider: "あおぞらタクシー", description: "通院送迎", amount: 2800, status: "completed" as const },
  ],
  "2025-01": [
    { id: "s9", date: "2025-01-28", provider: "田中内科クリニック", description: "再診料", amount: 220, status: "completed" as const },
    { id: "s10", date: "2025-01-25", provider: "田中内科クリニック", description: "訪問診療料", amount: 2660, status: "completed" as const },
    { id: "s11", date: "2025-01-20", provider: "さくら薬局", description: "調剤料", amount: 370, status: "completed" as const },
    { id: "s12", date: "2025-01-15", provider: "やまと訪問歯科", description: "訪問歯科診療", amount: 1140, status: "completed" as const },
    { id: "s13", date: "2025-01-10", provider: "あおぞらタクシー", description: "通院送迎", amount: 2400, status: "completed" as const },
    { id: "s14", date: "2025-01-05", provider: "田中内科クリニック", description: "再診料 + 処方箋料", amount: 430, status: "completed" as const },
  ],
};

const statementsData = allStatements["2025-02"];

const STATUS_LABELS: Record<string, string> = {
  completed: "決済完了",
  pending: "未決済",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "text-emerald-600",
  pending: "text-orange-500",
};

export default function UserStatementsPage() {
  const [year, setYear] = useState(2025);
  const [month, setMonth] = useState(2);

  const key = `${year}-${String(month).padStart(2, "0")}`;
  const statements = allStatements[key] || [];
  const totalAmount = statements.reduce((sum, s) => sum + s.amount, 0);

  const handlePrevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); } else { setMonth(month - 1); }
  };
  const handleNextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); } else { setMonth(month + 1); }
  };

  return (
    <div className="px-4 py-5 space-y-5">
      <div className="flex items-center justify-center gap-4">
        <button onClick={handlePrevMonth} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200">
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </button>
        <span className="text-lg font-bold text-gray-900 min-w-[140px] text-center">{year}年{month}月</span>
        <button onClick={handleNextMonth} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200">
          <ChevronRight className="w-6 h-6 text-gray-600" />
        </button>
      </div>
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
        <p className="text-sm text-emerald-700">{year}年{month}月のご利用合計</p>
        <p className="text-2xl font-bold text-emerald-800 mt-1">{formatCurrency(totalAmount)}</p>
        <p className="text-xs text-emerald-600 mt-1">{statements.length}件のご利用</p>
      </div>
      {statements.length === 0 ? (
        <div className="text-center py-12"><p className="text-base text-gray-500">この月の明細はありません</p></div>
      ) : (
        <div className="space-y-3">
          {statements.map((s) => (
            <Link key={s.id} href={`/user/statements/${s.id}`} className="block bg-white border border-gray-200 rounded-xl p-4 shadow-sm active:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium text-gray-900 truncate">{s.provider}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{s.date} ・ {s.description}</p>
                  <p className={`text-xs font-medium mt-1 ${STATUS_COLORS[s.status]}`}>{STATUS_LABELS[s.status]}</p>
                </div>
                <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(s.amount)}</p>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
