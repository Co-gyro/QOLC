"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Card, { CardHeader, CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

// --- QOLC統一フォーマットのカラム定義 ---

const UNIFIED_COLUMNS = [
  { key: "resident_id", label: "入居者ID", required: true },
  { key: "resident_name", label: "入居者氏名", required: true },
  { key: "service_date", label: "サービス提供日", required: true },
  { key: "service_type", label: "サービス種別", required: true },
  { key: "item_description", label: "明細項目の説明", required: true },
  { key: "unit_count", label: "単位数", required: false },
  { key: "unit_price", label: "単価", required: false },
  { key: "amount", label: "金額", required: true },
  { key: "insurance_amount", label: "保険適用額", required: false },
  { key: "self_pay_amount", label: "自己負担額", required: true },
  { key: "remarks", label: "備考", required: false },
] as const;

// --- 型定義 ---

type FormTab = "basic" | "mapping" | "test";

type TransformType = "" | "fixed" | "date" | "number" | "concat";

interface ColumnMapping {
  id: string;
  sourceColumn: string;
  targetColumn: string;
  transformType: TransformType;
  fixedValue: string;
  dateFormat: string;
  concatColumns: string;
}

interface BasicInfo {
  name: string;
  code: string;
  description: string;
  fileType: "csv" | "excel";
  encoding: "utf-8" | "shift_jis";
  delimiter: "," | "\t";
  hasHeader: boolean;
}

// --- テスト変換のサンプル結果 ---

const sampleConvertedRows = [
  { resident_id: "R001", resident_name: "山田 太郎", service_date: "2025-02-01", service_type: "訪問診療", item_description: "初診料", unit_count: "1", unit_price: "2,820", amount: "2,820", insurance_amount: "2,538", self_pay_amount: "282", remarks: "" },
  { resident_id: "R002", resident_name: "鈴木 花子", service_date: "2025-02-01", service_type: "訪問診療", item_description: "再診料", unit_count: "1", unit_price: "730", amount: "730", insurance_amount: "657", self_pay_amount: "73", remarks: "" },
  { resident_id: "R001", resident_name: "山田 太郎", service_date: "2025-02-03", service_type: "訪問診療", item_description: "処方箋料", unit_count: "1", unit_price: "680", amount: "680", insurance_amount: "612", self_pay_amount: "68", remarks: "" },
];

// --- コンポーネント ---

let mappingIdCounter = 0;
function createMapping(): ColumnMapping {
  mappingIdCounter += 1;
  return {
    id: `m-${mappingIdCounter}`,
    sourceColumn: "",
    targetColumn: "",
    transformType: "",
    fixedValue: "",
    dateFormat: "YYYY/MM/DD",
    concatColumns: "",
  };
}

export default function NewUploadFormatPage() {
  const [tab, setTab] = useState<FormTab>("basic");
  const [basicInfo, setBasicInfo] = useState<BasicInfo>({
    name: "",
    code: "",
    description: "",
    fileType: "csv",
    encoding: "utf-8",
    delimiter: ",",
    hasHeader: true,
  });
  const [mappings, setMappings] = useState<ColumnMapping[]>([
    createMapping(),
  ]);
  const [testFile, setTestFile] = useState<File | null>(null);
  const [testResult, setTestResult] = useState<"none" | "success" | "error">("none");

  const tabs: { key: FormTab; label: string }[] = [
    { key: "basic", label: "基本情報" },
    { key: "mapping", label: "カラムマッピング" },
    { key: "test", label: "テスト" },
  ];

  const addMapping = () => {
    setMappings([...mappings, createMapping()]);
  };

  const removeMapping = (id: string) => {
    setMappings(mappings.filter((m) => m.id !== id));
  };

  const updateMapping = (id: string, field: keyof ColumnMapping, value: string) => {
    setMappings(mappings.map((m) => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleTestConvert = () => {
    // デモ用: テスト結果を表示
    setTestResult("success");
  };

  const updateBasicInfo = (field: keyof BasicInfo, value: string | boolean) => {
    setBasicInfo({ ...basicInfo, [field]: value });
  };

  const inputClass = "w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const selectClass = "px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div>
      <Header
        title="アップロードフォーマット登録"
        description="新しいアップロードフォーマットを登録します"
      />

      {/* タブ */}
      <div className="flex gap-1 mb-6">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <span className="mr-1.5 text-xs opacity-70">{i + 1}.</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ========== 基本情報タブ ========== */}
      {tab === "basic" && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">基本情報</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-5 max-w-2xl">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    フォーマット名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={basicInfo.name}
                    onChange={(e) => updateBasicInfo("name", e.target.value)}
                    placeholder="例: 〇〇レセプトシステム v2"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    フォーマットコード <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={basicInfo.code}
                    onChange={(e) => updateBasicInfo("code", e.target.value)}
                    placeholder="例: FORMAT_001"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>説明</label>
                <textarea
                  value={basicInfo.description}
                  onChange={(e) => updateBasicInfo("description", e.target.value)}
                  placeholder="例: 〇〇社のレセプトシステムから出力されるCSV"
                  rows={3}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    ファイル形式 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={basicInfo.fileType}
                    onChange={(e) => updateBasicInfo("fileType", e.target.value)}
                    className={`${selectClass} w-full`}
                  >
                    <option value="csv">CSV</option>
                    <option value="excel">Excel</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>
                    文字コード <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={basicInfo.encoding}
                    onChange={(e) => updateBasicInfo("encoding", e.target.value)}
                    className={`${selectClass} w-full`}
                  >
                    <option value="utf-8">UTF-8</option>
                    <option value="shift_jis">Shift_JIS</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    区切り文字 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={basicInfo.delimiter}
                    onChange={(e) => updateBasicInfo("delimiter", e.target.value)}
                    className={`${selectClass} w-full`}
                  >
                    <option value=",">カンマ（,）</option>
                    <option value={"\t"}>タブ</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>ヘッダー行</label>
                  <div className="flex items-center gap-3 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="hasHeader"
                        checked={basicInfo.hasHeader}
                        onChange={() => updateBasicInfo("hasHeader", true)}
                        className="text-blue-600"
                      />
                      <span className="text-sm">あり（1行目がヘッダー）</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="hasHeader"
                        checked={!basicInfo.hasHeader}
                        onChange={() => updateBasicInfo("hasHeader", false)}
                        className="text-blue-600"
                      />
                      <span className="text-sm">なし</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button onClick={() => setTab("mapping")}>
                  次へ: カラムマッピング →
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ========== カラムマッピングタブ ========== */}
      {tab === "mapping" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">カラムマッピング設定</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    元ファイルの列をQOLC統一フォーマットの列に対応付けます
                  </p>
                </div>
                <Button size="sm" onClick={addMapping}>行を追加</Button>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left font-medium text-gray-600 w-56">元ファイルの列名</th>
                      <th className="px-2 py-3 text-center font-medium text-gray-400 w-8">→</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 w-52">QOLC統一フォーマット</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600 w-40">変換タイプ</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-600">変換設定</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-600 w-16">削除</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((mapping) => (
                      <tr key={mapping.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={mapping.sourceColumn}
                            onChange={(e) => updateMapping(mapping.id, "sourceColumn", e.target.value)}
                            placeholder={mapping.transformType === "fixed" ? "（固定値）" : "例: 利用者番号"}
                            disabled={mapping.transformType === "fixed"}
                            className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${mapping.transformType === "fixed" ? "bg-gray-100 text-gray-400" : ""}`}
                          />
                        </td>
                        <td className="px-2 py-2 text-center text-gray-400 text-lg">→</td>
                        <td className="px-4 py-2">
                          <select
                            value={mapping.targetColumn}
                            onChange={(e) => updateMapping(mapping.id, "targetColumn", e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">-- 選択 --</option>
                            {UNIFIED_COLUMNS.map((col) => (
                              <option key={col.key} value={col.key}>
                                {col.label}{col.required ? " *" : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={mapping.transformType}
                            onChange={(e) => updateMapping(mapping.id, "transformType", e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">なし（そのまま）</option>
                            <option value="fixed">固定値</option>
                            <option value="date">日付変換</option>
                            <option value="number">数値変換</option>
                            <option value="concat">列の結合</option>
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          {mapping.transformType === "fixed" && (
                            <input
                              type="text"
                              value={mapping.fixedValue}
                              onChange={(e) => updateMapping(mapping.id, "fixedValue", e.target.value)}
                              placeholder="固定値を入力（例: タクシー）"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          )}
                          {mapping.transformType === "date" && (
                            <select
                              value={mapping.dateFormat}
                              onChange={(e) => updateMapping(mapping.id, "dateFormat", e.target.value)}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="YYYY/MM/DD">YYYY/MM/DD</option>
                              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                              <option value="YYYYMMDD">YYYYMMDD</option>
                              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            </select>
                          )}
                          {mapping.transformType === "number" && (
                            <span className="text-xs text-gray-500">カンマ区切り等を数値に自動変換</span>
                          )}
                          {mapping.transformType === "concat" && (
                            <input
                              type="text"
                              value={mapping.concatColumns}
                              onChange={(e) => updateMapping(mapping.id, "concatColumns", e.target.value)}
                              placeholder="結合する列名（カンマ区切り）"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          )}
                          {mapping.transformType === "" && (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {mappings.length > 1 && (
                            <button
                              onClick={() => removeMapping(mapping.id)}
                              className="text-red-500 hover:text-red-700 text-sm"
                            >
                              削除
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {/* QOLC統一フォーマットのリファレンス */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-gray-600">QOLC統一フォーマット（変換先）リファレンス</h3>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2 text-left font-medium text-gray-600">カラム名</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">説明</th>
                      <th className="px-4 py-2 text-center font-medium text-gray-600">必須</th>
                    </tr>
                  </thead>
                  <tbody>
                    {UNIFIED_COLUMNS.map((col) => (
                      <tr key={col.key} className="border-b border-gray-100">
                        <td className="px-4 py-1.5 font-mono text-xs">{col.key}</td>
                        <td className="px-4 py-1.5 text-gray-700">{col.label}</td>
                        <td className="px-4 py-1.5 text-center">
                          {col.required ? (
                            <Badge className="bg-red-100 text-red-700">必須</Badge>
                          ) : (
                            <span className="text-gray-400 text-xs">任意</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setTab("basic")}>
              ← 戻る: 基本情報
            </Button>
            <Button onClick={() => setTab("test")}>
              次へ: テスト →
            </Button>
          </div>
        </div>
      )}

      {/* ========== テストタブ ========== */}
      {tab === "test" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">テスト変換</h3>
              <p className="text-sm text-gray-500 mt-1">
                サンプルファイルをアップロードして、変換結果を確認できます
              </p>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {/* ファイルアップロード */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <div className="mb-3">
                    <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    サンプルCSVファイルをドラッグ＆ドロップ、または
                  </p>
                  <label className="inline-block">
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setTestFile(file);
                      }}
                    />
                    <span className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 cursor-pointer transition-colors">
                      ファイルを選択
                    </span>
                  </label>
                  {testFile && (
                    <p className="mt-3 text-sm text-gray-700">
                      選択中: <span className="font-medium">{testFile.name}</span>
                      <button
                        onClick={() => { setTestFile(null); setTestResult("none"); }}
                        className="ml-2 text-red-500 hover:text-red-700 text-xs"
                      >
                        取消
                      </button>
                    </p>
                  )}
                </div>

                {testFile && testResult === "none" && (
                  <div className="flex justify-center">
                    <Button onClick={handleTestConvert}>テスト変換を実行</Button>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          {/* テスト結果 */}
          {testResult === "success" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">変換結果</h3>
                    <Badge className="bg-green-100 text-green-800">成功</Badge>
                  </div>
                  <p className="text-sm text-gray-500">{sampleConvertedRows.length}行を変換</p>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">#</th>
                        {UNIFIED_COLUMNS.map((col) => (
                          <th key={col.key} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sampleConvertedRows.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          {UNIFIED_COLUMNS.map((col) => (
                            <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                              {(row as Record<string, string>)[col.key] || (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          )}

          {testResult === "error" && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold">変換結果</h3>
                  <Badge className="bg-red-100 text-red-800">エラー</Badge>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <span className="text-red-500 mt-0.5">!</span>
                    <div>
                      <p className="text-sm font-medium text-red-800">3行目：日付形式が不正です</p>
                      <p className="text-xs text-red-600 mt-1">元の値: &quot;2025/13/01&quot; — 期待される形式: YYYY/MM/DD</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <span className="text-red-500 mt-0.5">!</span>
                    <div>
                      <p className="text-sm font-medium text-red-800">5行目：必須項目「入居者ID」が空です</p>
                      <p className="text-xs text-red-600 mt-1">resident_id カラムに値がありません</p>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setTab("mapping")}>
              ← 戻る: カラムマッピング
            </Button>
            <div className="flex gap-3">
              <Link href="/master">
                <Button variant="secondary">キャンセル</Button>
              </Link>
              <Button>フォーマットを登録</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
