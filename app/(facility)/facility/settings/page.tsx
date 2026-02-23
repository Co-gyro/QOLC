"use client";

import { useState } from "react";
import Card, { CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";

// --- ダミーデータ ---

const facilityInfo = {
  name: "さくら介護施設",
  address: "東京都新宿区西新宿1-2-3",
  phone: "03-1234-5678",
  fax: "03-1234-5679",
  email: "info@sakura-care.jp",
};

export default function SettingsPage() {
  // 施設情報
  const [address, setAddress] = useState(facilityInfo.address);
  const [phone, setPhone] = useState(facilityInfo.phone);
  const [fax, setFax] = useState(facilityInfo.fax);
  const [email, setEmail] = useState(facilityInfo.email);

  // 領収書設定
  const [autoIssue, setAutoIssue] = useState(true);
  const [issueTiming, setIssueTiming] = useState("month_end");
  const [customDay, setCustomDay] = useState("1");

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">設定</h2>
        <p className="mt-1 text-sm text-gray-500">施設情報・領収書設定</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* 施設情報 */}
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">施設情報</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">施設名</label>
                <p className="text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2">{facilityInfo.name}</p>
                <p className="text-xs text-gray-500 mt-1">変更が必要な場合は運営者にお問い合わせください。</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">住所</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">FAX</label>
                  <input
                    type="tel"
                    value={fax}
                    onChange={(e) => setFax(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-end">
                <Button>保存する</Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 領収書設定 */}
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">領収書設定</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-900">自動発行</p>
                  <p className="text-xs text-gray-500">領収書を自動で発行する</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoIssue}
                  onClick={() => setAutoIssue(!autoIssue)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoIssue ? "bg-emerald-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      autoIssue ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>

              {autoIssue && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">発行タイミング</label>
                    <select
                      value={issueTiming}
                      onChange={(e) => setIssueTiming(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="month_end">月末</option>
                      <option value="next_month_start">翌月初</option>
                      <option value="custom">カスタム日付</option>
                    </select>
                  </div>

                  {issueTiming === "custom" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">発行日</label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">毎月</span>
                        <select
                          value={customDay}
                          onChange={(e) => setCustomDay(e.target.value)}
                          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                            <option key={day} value={String(day)}>{day}</option>
                          ))}
                        </select>
                        <span className="text-sm text-gray-500">日</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-end">
                <Button>保存する</Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
