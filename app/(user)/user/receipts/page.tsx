"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const allReceipts: Record<string, typeof receiptsData> = {
  "2025-02": [
    { id: "r1", issuedDate: "2025-02-10", provider: "田中内科クリニック", description: "初診料", amount: 850 },
    { id: "r2", issuedDate: "2025-02-10", provider: "さくら薬局", description: "調剤料", amount: 460 },
    { id: "r3", issuedDate: "2025-02-07", provider: "あおぞらタクシー", description: "通院送迎", amount: 3200 },
    { id: "r4", issuedDate: "2025-02-05", provider: "さくら薬局", description: "調剤料", amount: 290 },
    { id: "r5", issuedDate: "2025-02-03", provider: "やまと訪問歯科", description: "訪問歯科診療", amount: 1350 },
    { id: "r6", issuedDate: "2025-02-01", provider: "あおぞらタクシー", description: "通院送迎", amount: 2800 },
  ],
  "2025-01": [
    { id: "r7", issuedDate: "2025-01-28", provider: "田中内科クリニック", description: "再診料", amount: 220 },
    { id: "r8", issuedDate: "2025-01-25", provider: "田中内科クリニック", description: "訪問診療料", amount: 2660 },
    { id: "r9", issuedDate: "2025-01-20", provider: "さくら薬局", description: "調剤料", amount: 370 },
    { id: "r10", issuedDate: "2025-01-15", provider: "やまと訪問歯科", description: "訪問歯科診療", amount: 1140 },
    { id: "r11", issuedDate: "2025-01-10", provider: "あおぞらタクシー", description: "通院送迎", amount: 2400 },
  ],
};
const receiptsData = allReceipts["2025-02"];

export default function UserReceiptsPage() {
  const [year, setYear] = useState(2025);
  const [month, setMonth] = useState(2);
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const receipts = allReceipts[key] || [];
  const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0);
  const handlePrevMonth = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else { setMonth(month - 1); } };
  const handleNextMonth = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else { setMonth(month + 1); } };

  return (
    <div className="px-4 py-5 space-y-5">
      <div className="flex items-center justify-center gap-4">
        <button onClick={handlePrevMonth} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200"><ChevronLeft className="w-6 h-6 text-gray-600" /></button>
        <span className="text-lg font-bold text-gray-900 min-w-[140px] text-center">{year}年{month}月</span>
        <button onClick={handleNextMonth} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 active:bg-gray-200"><ChevronRight className="w-6 h-6 text-gray-600" /></button>
      </div>
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
        <p className="text-sm text-emerald-700">{year}年{month}月の領収書合計</p>
        <p className="text-2xl font-bold text-emerald-800 mt-1">{formatCurrency(totalAmount)}</p>
        <p className="text-xs text-emerald-600 mt-1">{receipts.length}件</p>
      </div>
      {receipts.length > 0 && (
        <button onClick={() => alert("この機能は現在準備中です")} className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm text-emerald-600 font-medium active:bg-gray-50">
          <Download className="w-5 h-5" /><span className="text-base">一括ダウンロード（PDF）</span>
        </button>
      )}
      {receipts.length === 0 ? (
        <div className="text-center py-12"><p className="text-base text-gray-500">この月の領収書はありません</p></div>
      ) : (
        <div className="space-y-3">
          {receipts.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium text-gray-900 truncate">{r.provider}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{r.issuedDate} ・ {r.description}</p>
                </div>
                <p className="text-lg font-bold text-gray-900 ml-3 flex-shrink-0">{formatCurrency(r.amount)}</p>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                <button onClick={() => alert("この機能は現在準備中です")} className="flex-1 flex items-center justify-center gap-1.5 text-sm text-emerald-600 font-medium bg-emerald-50 rounded-lg py-2.5 active:bg-emerald-100">
                  <Download className="w-4 h-4" />PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
