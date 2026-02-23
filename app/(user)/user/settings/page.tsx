"use client";

import { useState } from "react";
import { User, Bell, Shield, LogOut } from "lucide-react";

// ダミー: ログインユーザー情報
const currentUser = {
  accountType: "self" as "self" | "family",
  name: "山田 太郎",
  residentName: "山田 太郎",
  facilityName: "さくら介護施設",
  relationship: null as string | null, // 本人の場合はnull
  email: "",
  notifyMethod: "LINE",
  isBillingPerson: true,
};

export default function UserSettingsPage() {
  const [lineNotify, setLineNotify] = useState(true);
  const [emailNotify, setEmailNotify] = useState(false);
  const isSelf = currentUser.accountType === "self";

  return (
    <div className="px-4 py-5 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">設定</h2>
      </div>

      {/* アカウント情報 */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <User className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-semibold text-gray-900">アカウント情報</span>
        </div>
        <div className="divide-y divide-gray-100">
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">アカウント種別</span>
            <span className="text-base text-gray-900">{isSelf ? "入居者本人" : "家族"}</span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">{isSelf ? "氏名" : "お名前"}</span>
            <span className="text-base text-gray-900">{currentUser.name}</span>
          </div>
          {!isSelf && (
            <>
              <div className="flex justify-between px-4 py-3">
                <span className="text-sm text-gray-500">入居者名</span>
                <span className="text-base text-gray-900">{currentUser.residentName}</span>
              </div>
              <div className="flex justify-between px-4 py-3">
                <span className="text-sm text-gray-500">続柄</span>
                <span className="text-base text-gray-900">{currentUser.relationship}</span>
              </div>
            </>
          )}
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">施設名</span>
            <span className="text-base text-gray-900">{currentUser.facilityName}</span>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">通知方法</span>
            <div className="flex items-center gap-1.5">
              {currentUser.notifyMethod === "LINE" && <span className="inline-block w-2 h-2 rounded-full bg-[#06C755]" />}
              <span className="text-base text-gray-900">{currentUser.notifyMethod}</span>
            </div>
          </div>
          <div className="flex justify-between px-4 py-3">
            <span className="text-sm text-gray-500">決済担当</span>
            <span className="text-base text-gray-900">{currentUser.isBillingPerson ? "はい" : "いいえ"}</span>
          </div>
        </div>
      </div>

      {/* 通知設定 */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Bell className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-semibold text-gray-900">通知設定</span>
        </div>
        <div className="divide-y divide-gray-100">
          <label className="flex items-center justify-between px-4 py-3 cursor-pointer">
            <div>
              <p className="text-sm text-gray-900">LINE通知</p>
              <p className="text-xs text-gray-500">明細・領収書の通知をLINEで受け取る</p>
            </div>
            <button type="button" role="switch" aria-checked={lineNotify} onClick={() => setLineNotify(!lineNotify)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${lineNotify ? "bg-emerald-600" : "bg-gray-200"}`}>
              <span className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${lineNotify ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </label>
          <label className="flex items-center justify-between px-4 py-3 cursor-pointer">
            <div>
              <p className="text-sm text-gray-900">メール通知</p>
              <p className="text-xs text-gray-500">明細・領収書の通知をメールで受け取る</p>
            </div>
            <button type="button" role="switch" aria-checked={emailNotify} onClick={() => setEmailNotify(!emailNotify)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${emailNotify ? "bg-emerald-600" : "bg-gray-200"}`}>
              <span className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${emailNotify ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </label>
        </div>
      </div>

      {/* セキュリティ */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Shield className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-semibold text-gray-900">セキュリティ</span>
        </div>
        <div className="divide-y divide-gray-100">
          <button onClick={() => alert("パスワード変更画面に遷移します（準備中）")}
            className="w-full flex justify-between items-center px-4 py-3 text-left active:bg-gray-50">
            <span className="text-sm text-gray-900">パスワード変更</span>
            <span className="text-sm text-emerald-600">変更する</span>
          </button>
        </div>
      </div>

      {/* ログアウト */}
      <button onClick={() => alert("ログアウトします（準備中）")}
        className="w-full flex items-center justify-center gap-2 bg-white border border-red-200 rounded-xl px-4 py-3.5 text-red-500 font-medium active:bg-red-50">
        <LogOut className="w-5 h-5" />
        <span className="text-base">ログアウト</span>
      </button>

      <p className="text-center text-xs text-gray-400 pt-2">QOLC v1.0.0</p>
    </div>
  );
}
