"use client";

import { useState } from "react";
import Link from "next/link";
import Card, { CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Table, {
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/ui/Table";
import FileUpload from "@/components/ui/FileUpload";
import Stepper from "@/components/provider/Stepper";
import { formatCurrency } from "@/lib/utils";

// --- ダミーデータ ---

// 紐づけ済み施設（複数の場合ステップ0を表示）
const linkedFacilities = [
  { id: "f1", name: "さくら介護施設" },
  { id: "f2", name: "あおぞらケアホーム" },
  { id: "f3", name: "ひまわりシニアハウス" },
];

const steps = [
  { label: "施設選択" },
  { label: "ファイル選択" },
  { label: "プレビュー" },
  { label: "確認" },
  { label: "完了" },
];

// ダミー変換結果データ
const dummyConversionResults = [
  { id: "r1", residentId: "R001", residentName: "山田 太郎", serviceDate: "2025-02-01", itemDescription: "初診料", amount: 2820, selfPayAmount: 850, hasError: false },
  { id: "r2", residentId: "R002", residentName: "鈴木 花子", serviceDate: "2025-02-01", itemDescription: "再診料", amount: 730, selfPayAmount: 220, hasError: false },
  { id: "r3", residentId: "R003", residentName: "佐藤 一郎", serviceDate: "2025-02-03", itemDescription: "訪問診療料", amount: 8880, selfPayAmount: 2660, hasError: false },
  { id: "r4", residentId: "", residentName: "田中 次郎", serviceDate: "2025-02-05", itemDescription: "初診料", amount: 2820, selfPayAmount: 850, hasError: true, errorMessage: "入居者IDが空です" },
  { id: "r5", residentId: "R005", residentName: "高橋 美咲", serviceDate: "2025-02-05", itemDescription: "再診料 + 処方箋料", amount: 1420, selfPayAmount: 430, hasError: false },
  { id: "r6", residentId: "R006", residentName: "中村 健太", serviceDate: "2025-02-07", itemDescription: "訪問診療料", amount: 8880, selfPayAmount: 2660, hasError: false },
  { id: "r7", residentId: "R007", residentName: "伊藤 裕子", serviceDate: "invalid", itemDescription: "再診料", amount: 730, selfPayAmount: 220, hasError: true, errorMessage: "日付形式が不正です" },
];

export default function UploadPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const selectedFacility = linkedFacilities.find((f) => f.id === selectedFacilityId);

  const totalRecords = dummyConversionResults.length;
  const errorRecords = dummyConversionResults.filter((r) => r.hasError).length;
  const validRecords = totalRecords - errorRecords;
  const totalAmount = dummyConversionResults.filter((r) => !r.hasError).reduce((sum, r) => sum + r.selfPayAmount, 0);

  const handleFileSelect = (file: File) => {
    setSelectedFileName(file.name);
  };

  const handleReset = () => {
    setCurrentStep(1);
    setSelectedFacilityId(null);
    setSelectedFileName(null);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">明細アップロード</h2>
        <p className="mt-1 text-sm text-gray-500">CSVファイルをアップロードして明細を登録</p>
      </div>

      {/* ステッパー */}
      <div className="mb-8">
        <Stepper steps={steps} currentStep={currentStep} />
      </div>

      {/* ステップ1: 施設選択 */}
      {currentStep === 1 && (
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">どの施設向けの明細ですか？</h3>
            <p className="text-sm text-gray-500 mb-6">アップロードする明細の対象施設を選択してください。</p>
            <div className="space-y-3">
              {linkedFacilities.map((facility) => (
                <label
                  key={facility.id}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedFacilityId === facility.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="facility"
                    value={facility.id}
                    checked={selectedFacilityId === facility.id}
                    onChange={() => setSelectedFacilityId(facility.id)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-900">{facility.name}</span>
                </label>
              ))}
            </div>
            {selectedFacilityId && (
              <div className="mt-6 flex justify-end">
                <Button onClick={() => setCurrentStep(2)}>次へ</Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* ステップ2: ファイル選択 */}
      {currentStep === 2 && (
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">ファイルを選択</h3>
            <p className="text-sm text-gray-500 mb-1">
              対象施設: <span className="font-medium text-gray-700">{selectedFacility?.name}</span> 向けの明細
            </p>
            <p className="text-sm text-gray-500 mb-4">
              利用フォーマット: <span className="font-medium text-gray-700">〇〇レセプトシステム v2</span>
            </p>
            <FileUpload onFileSelect={handleFileSelect} />
            <div className="mt-4 flex justify-between">
              <Button variant="secondary" onClick={() => setCurrentStep(1)}>
                戻る
              </Button>
              {selectedFileName && (
                <Button onClick={() => setCurrentStep(3)}>
                  アップロードして変換
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* ステップ3: プレビュー */}
      {currentStep === 3 && (
        <div className="space-y-4">
          {/* 変換サマリー */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardBody className="py-3 px-4 text-center">
                <p className="text-xs text-gray-500">全件数</p>
                <p className="text-xl font-bold text-gray-900">{totalRecords}件</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="py-3 px-4 text-center">
                <p className="text-xs text-gray-500">正常</p>
                <p className="text-xl font-bold text-green-600">{validRecords}件</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="py-3 px-4 text-center">
                <p className="text-xs text-gray-500">エラー</p>
                <p className="text-xl font-bold text-red-600">{errorRecords}件</p>
              </CardBody>
            </Card>
          </div>

          {/* 変換結果テーブル */}
          <Card>
            <CardBody>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">変換結果</h3>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>入居者ID</TableHeader>
                    <TableHeader>入居者名</TableHeader>
                    <TableHeader>サービス日</TableHeader>
                    <TableHeader>明細内容</TableHeader>
                    <TableHeader>金額</TableHeader>
                    <TableHeader>自己負担額</TableHeader>
                    <TableHeader>状態</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dummyConversionResults.map((row) => (
                    <TableRow key={row.id} className={row.hasError ? "bg-red-50" : ""}>
                      <TableCell>{row.residentId || <span className="text-red-500">-</span>}</TableCell>
                      <TableCell>{row.residentName}</TableCell>
                      <TableCell>{row.serviceDate}</TableCell>
                      <TableCell>{row.itemDescription}</TableCell>
                      <TableCell>{formatCurrency(row.amount)}</TableCell>
                      <TableCell>{formatCurrency(row.selfPayAmount)}</TableCell>
                      <TableCell>
                        {row.hasError ? (
                          <span className="text-xs text-red-600 font-medium">{row.errorMessage}</span>
                        ) : (
                          <Badge className="bg-green-100 text-green-800">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  合計自己負担額（エラー行除く）: <span className="font-semibold text-gray-900">{formatCurrency(totalAmount)}</span>
                </p>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setCurrentStep(2)}>
                    戻る
                  </Button>
                  <Button onClick={() => setCurrentStep(4)}>
                    確認画面へ進む
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* ステップ4: 確認 */}
      {currentStep === 4 && (
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">送信内容の確認</h3>
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500">対象施設</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{selectedFacility?.name}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500">ファイル名</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{selectedFileName}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500">フォーマット</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">〇〇レセプトシステム v2</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500">送信件数</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{validRecords}件（エラー{errorRecords}件はスキップ）</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 col-span-2">
                  <p className="text-xs text-gray-500">合計自己負担額</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">{formatCurrency(totalAmount)}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setCurrentStep(3)}>
                戻る
              </Button>
              <Button onClick={() => setCurrentStep(5)}>
                送信する
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ステップ5: 完了 */}
      {currentStep === 5 && (
        <Card>
          <CardBody className="text-center py-12">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">アップロード完了</h3>
            <p className="text-sm text-gray-500 mb-1">
              {selectedFacility?.name} 向けの明細
            </p>
            <p className="text-sm text-gray-500 mb-8">
              {validRecords}件の明細が正常に送信されました。決済処理が開始されます。
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/provider/history">
                <Button variant="secondary">履歴を確認</Button>
              </Link>
              <Button onClick={handleReset}>
                続けてアップロード
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
