"use client";

import Header from "@/components/layout/Header";
import Card, { CardHeader, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { SERVICE_TYPE_LABELS, ACCOUNT_TYPE_LABELS } from "@/lib/constants";

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

// ダミーフォーマットリスト（アップロード設定用）
const uploadFormatOptions = [
  { id: "fmt1", name: "〇〇レセプトシステム v2", encoding: "Shift_JIS" },
  { id: "fmt2", name: "△△レセプトシステム", encoding: "UTF-8" },
  { id: "fmt3", name: "タクシー請求書フォーマット", encoding: "UTF-8" },
  { id: "fmt4", name: "汎用CSV", encoding: "UTF-8" },
];

// ダミー施設リスト（紐づけ先選択用）
const facilityOptions = [
  { id: "fac1", name: "さくら介護施設" },
  { id: "fac2", name: "あおぞらケアホーム" },
  { id: "fac3", name: "ひまわり老人ホーム" },
];

export default function NewMerchantPage() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 加盟店登録処理 → セルフィッシュ連携
  };

  return (
    <div>
      <Header
        title="加盟店を登録"
        description="新しいサービス提供者（加盟店）を登録します"
        actions={
          <Link href="/merchants">
            <Button variant="secondary">戻る</Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="space-y-6 max-w-2xl">
          {/* 基本情報 */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">基本情報</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    加盟店名 <span className="text-red-500">*</span>
                  </label>
                  <input type="text" required className={inputClass} placeholder="田中内科クリニック" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    加盟店名（カナ） <span className="text-red-500">*</span>
                  </label>
                  <input type="text" required className={inputClass} placeholder="タナカナイカクリニック" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  代表者名 <span className="text-red-500">*</span>
                </label>
                <input type="text" required className={inputClass} placeholder="田中 太郎" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  住所 <span className="text-red-500">*</span>
                </label>
                <input type="text" required className={inputClass} placeholder="東京都世田谷区..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    電話番号 <span className="text-red-500">*</span>
                  </label>
                  <input type="tel" required className={inputClass} placeholder="03-1234-5678" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    FAX
                  </label>
                  <input type="tel" className={inputClass} placeholder="03-1234-5679" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <input type="email" required className={inputClass} placeholder="info@tanaka-clinic.jp" />
              </div>
            </CardBody>
          </Card>

          {/* 事業情報 */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">事業情報</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  事業所番号 <span className="text-red-500">*</span>
                </label>
                <input type="text" required className={inputClass} placeholder="1310000001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  サービス種別 <span className="text-red-500">*</span>
                </label>
                <select required className={inputClass}>
                  <option value="">選択してください</option>
                  {Object.entries(SERVICE_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  関連施設 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {facilityOptions.map((f) => (
                    <label key={f.id} className="flex items-center gap-2">
                      <input type="checkbox" value={f.id} className="rounded border-gray-300" />
                      <span className="text-sm text-gray-700">{f.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    契約開始日 <span className="text-red-500">*</span>
                  </label>
                  <input type="date" required className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    手数料率（%） <span className="text-red-500">*</span>
                  </label>
                  <input type="number" required step="0.1" min="0" max="100" className={inputClass} placeholder="3.5" />
                </div>
              </div>
            </CardBody>
          </Card>

          {/* アップロード設定 */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">アップロード設定</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  明細CSVフォーマット <span className="text-red-500">*</span>
                </label>
                <select required className={inputClass}>
                  <option value="">選択してください</option>
                  {uploadFormatOptions.map((fmt) => (
                    <option key={fmt.id} value={fmt.id}>{fmt.name}（{fmt.encoding}）</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  この加盟店がアップロードするCSVファイルのフォーマットを選択してください
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/master/formats/new" className="text-sm text-blue-600 hover:text-blue-800">
                  新しいフォーマットを作成 →
                </Link>
              </div>
            </CardBody>
          </Card>

          {/* 口座情報 */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">口座情報</h3>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    銀行名 <span className="text-red-500">*</span>
                  </label>
                  <input type="text" required className={inputClass} placeholder="みずほ銀行" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    支店名 <span className="text-red-500">*</span>
                  </label>
                  <input type="text" required className={inputClass} placeholder="東京支店" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    口座種別 <span className="text-red-500">*</span>
                  </label>
                  <select required className={inputClass}>
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    口座番号 <span className="text-red-500">*</span>
                  </label>
                  <input type="text" required className={inputClass} placeholder="1234567" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    口座名義 <span className="text-red-500">*</span>
                  </label>
                  <input type="text" required className={inputClass} placeholder="タナカ タロウ" />
                </div>
              </div>
            </CardBody>
          </Card>

          <div className="flex justify-end gap-3">
            <Link href="/merchants">
              <Button variant="secondary">キャンセル</Button>
            </Link>
            <Button type="submit">登録してセルフィッシュに連携</Button>
          </div>
        </div>
      </form>
    </div>
  );
}
