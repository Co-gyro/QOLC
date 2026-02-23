"use client";

import { useState } from "react";
import Card, { CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

// --- ダミーデータ ---
const accountInfo = {
  merchantName: "田中内科クリニック",
  contactName: "田中 太郎",
  email: "tanaka@example.com",
  formatName: "〇〇レセプトシステム v2",
};

// 紐づけ済み施設
const linkedFacilities = [
  { id: "f1", name: "さくら介護施設", registeredAt: "2024-04-01", status: "active" as const },
  { id: "f2", name: "あおぞらケアホーム", registeredAt: "2024-06-15", status: "active" as const },
  { id: "f3", name: "ひまわりシニアハウス", registeredAt: "2024-09-01", status: "active" as const },
];

export default function SettingsPage() {
  const [contactName, setContactName] = useState(accountInfo.contactName);
  const [email, setEmail] = useState(accountInfo.email);

  const [notifyUploadComplete, setNotifyUploadComplete] = useState(true);
  const [notifyPaymentComplete, setNotifyPaymentComplete] = useState(true);
  const [notifyPaymentError, setNotifyPaymentError] = useState(true);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">設定</h2>
        <p className="mt-1 text-sm text-gray-500">アカウント・通知の設定</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* アカウント情報 */}
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">アカウント情報</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">事業者名</label>
                <p className="text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2">{accountInfo.merchantName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">担当者名</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <a href="#" className="text-sm text-blue-600 hover:text-blue-800">
                  パスワードを変更する
                </a>
              </div>
              <div className="flex justify-end">
                <Button>保存する</Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* 通知設定 */}
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">通知設定</h3>
            <div className="space-y-4">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-900">アップロード完了通知</p>
                  <p className="text-xs text-gray-500">明細アップロードの完了時にメール通知</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifyUploadComplete}
                  onClick={() => setNotifyUploadComplete(!notifyUploadComplete)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifyUploadComplete ? "bg-blue-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      notifyUploadComplete ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-900">決済完了通知</p>
                  <p className="text-xs text-gray-500">決済処理の完了時にメール通知</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifyPaymentComplete}
                  onClick={() => setNotifyPaymentComplete(!notifyPaymentComplete)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifyPaymentComplete ? "bg-blue-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      notifyPaymentComplete ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-gray-900">決済エラー通知</p>
                  <p className="text-xs text-gray-500">決済エラー発生時にメール通知</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifyPaymentError}
                  onClick={() => setNotifyPaymentError(!notifyPaymentError)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    notifyPaymentError ? "bg-blue-600" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      notifyPaymentError ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
            </div>
          </CardBody>
        </Card>

        {/* サービス提供先施設 */}
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">サービス提供先施設</h3>
            <div className="space-y-3 mb-4">
              {linkedFacilities.map((facility) => (
                <div
                  key={facility.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{facility.name}</p>
                    <p className="text-xs text-gray-500">登録日: {facility.registeredAt}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">有効</Badge>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              紐づけの変更は各施設にお問い合わせください。
            </p>
          </CardBody>
        </Card>

        {/* 利用フォーマット */}
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">利用フォーマット</h3>
            <div>
              <p className="text-xs text-gray-500 mb-1">現在のフォーマット</p>
              <p className="text-sm font-medium text-gray-900">{accountInfo.formatName}</p>
              <p className="text-xs text-gray-500 mt-3">
                フォーマットの変更が必要な場合は、運営者（ユニバーサル）にご連絡ください。
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
