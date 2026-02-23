"use client";

import { useState } from "react";
import Link from "next/link";
import Card, { CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Stepper from "@/components/provider/Stepper";

const steps = [
  { label: "入居者情報" },
  { label: "アカウント登録" },
  { label: "確認" },
];

type AccountType = "self" | "family";

interface AccountForm {
  type: AccountType;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  notifyMethod: string;
  receiveNotify: boolean;
  isBillingPerson: boolean;
}

const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

export default function ResidentNewPage() {
  const [currentStep, setCurrentStep] = useState(1);

  // ステップ1: 入居者情報
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastNameKana, setLastNameKana] = useState("");
  const [firstNameKana, setFirstNameKana] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("male");
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [notes, setNotes] = useState("");

  // ステップ2: アカウント情報（ダミーデータ）
  const [accounts, setAccounts] = useState<AccountForm[]>([
    { type: "self", name: "山田 太郎", relationship: "", phone: "", email: "", notifyMethod: "LINE", receiveNotify: true, isBillingPerson: true },
    { type: "family", name: "山田 花子", relationship: "長女", phone: "090-1111-2222", email: "hanako@example.com", notifyMethod: "メール", receiveNotify: true, isBillingPerson: false },
    { type: "family", name: "山田 一郎", relationship: "長男", phone: "090-3333-4444", email: "", notifyMethod: "郵送", receiveNotify: true, isBillingPerson: false },
  ]);

  // アカウント追加用の種別選択
  const [showAddSelector, setShowAddSelector] = useState(false);

  const hasSelfAccount = accounts.some((a) => a.type === "self");

  const addAccount = (type: AccountType) => {
    const newAccount: AccountForm = type === "self"
      ? { type: "self", name: `${lastName} ${firstName}`, relationship: "", phone: "", email: "", notifyMethod: "LINE", receiveNotify: true, isBillingPerson: false }
      : { type: "family", name: "", relationship: "長男", phone: "", email: "", notifyMethod: "LINE", receiveNotify: true, isBillingPerson: false };
    setAccounts([...accounts, newAccount]);
    setShowAddSelector(false);
  };

  const removeAccount = (index: number) => {
    if (accounts.length > 1) {
      const removed = accounts[index];
      const updated = accounts.filter((_, i) => i !== index);
      // 決済担当を削除した場合、最初のアカウントを決済担当にする
      if (removed.isBillingPerson && updated.length > 0) {
        updated[0] = { ...updated[0], isBillingPerson: true };
      }
      setAccounts(updated);
    }
  };

  const updateAccount = (index: number, field: keyof AccountForm, value: string | boolean) => {
    const updated = [...accounts];
    if (field === "isBillingPerson" && value === true) {
      // 他の全員の決済担当を外す
      updated.forEach((a, i) => { updated[i] = { ...a, isBillingPerson: i === index }; });
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setAccounts(updated);
  };

  // 完了状態
  const [isCompleted, setIsCompleted] = useState(false);
  const handleSubmit = () => setIsCompleted(true);

  const notifyBarColor: Record<string, string> = {
    LINE: "bg-[#06C755]",
    "メール": "bg-blue-600",
    "郵送": "bg-gray-400",
  };

  // ========================
  // 完了画面
  // ========================
  if (isCompleted) {
    return (
      <div>
        <div className="mb-8"><Stepper steps={steps} currentStep={4} /></div>

        <Card className="mb-6">
          <CardBody className="text-center py-8">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">登録完了</h3>
            <p className="text-sm text-gray-500">{lastName} {firstName} さんの入居者情報が登録されました。</p>
          </CardBody>
        </Card>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">クレジットカード登録について</p>
              <p className="text-blue-700">決済担当の方が利用者ポータルからクレジットカードの登録を行います。<br />カード登録が完了するまで自動決済はできません。</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {accounts.map((account, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg overflow-hidden flex">
              <div className={`w-1.5 shrink-0 ${notifyBarColor[account.notifyMethod] || "bg-gray-400"}`} />
              <div className="flex-1 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{account.type === "self" ? "👤" : "👥"}</span>
                  <p className="text-sm font-semibold text-gray-900">
                    {account.name} 様（{account.type === "self" ? "本人" : account.relationship}）
                  </p>
                  {account.isBillingPerson && <Badge className="bg-emerald-100 text-emerald-800">決済担当</Badge>}
                </div>
                <p className="text-xs text-gray-500 mb-4">通知方法：{account.notifyMethod}</p>

                {account.notifyMethod === "LINE" && (
                  <div>
                    <Button size="sm" onClick={() => alert("印刷機能は準備中です")}>QRコード付き案内書を印刷</Button>
                    <p className="text-xs text-gray-500 mt-2">
                      {account.type === "self" ? "入居者ご本人様にお渡しください。" : "ご家族にお渡しください。"}
                    </p>
                  </div>
                )}
                {account.notifyMethod === "メール" && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      <p className="text-sm font-medium text-gray-900">招待メールを送信しました</p>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">送信先：{account.email || "（メールアドレス未入力）"}</p>
                    <button onClick={() => alert("再送信機能は準備中です")} className="text-xs text-blue-600 hover:text-blue-800 underline">招待メールを再送信</button>
                  </div>
                )}
                {account.notifyMethod === "郵送" && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-sm font-medium text-gray-900">アカウント発行なし</p>
                    </div>
                    <p className="text-xs text-gray-500">明細・領収書は紙で郵送されます。</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-4">
          <Link href="/facility/residents"><Button variant="secondary">入居者一覧へ</Button></Link>
          <Link href="/facility/residents/new"><Button>続けて登録</Button></Link>
        </div>
      </div>
    );
  }

  // ========================
  // 登録フォーム
  // ========================
  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/facility/residents"><Button variant="ghost" size="sm">&larr; 戻る</Button></Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">入居者登録</h2>
          <p className="mt-1 text-sm text-gray-500">新しい入居者を登録します</p>
        </div>
      </div>

      <div className="mb-8"><Stepper steps={steps} currentStep={currentStep} /></div>

      {/* ステップ1: 入居者情報 */}
      {currentStep === 1 && (
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">入居者情報</h3>
            <div className="space-y-4 max-w-xl">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">姓 <span className="text-red-500">*</span></label><input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} placeholder="山田" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">名 <span className="text-red-500">*</span></label><input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} placeholder="太郎" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">セイ <span className="text-red-500">*</span></label><input type="text" value={lastNameKana} onChange={(e) => setLastNameKana(e.target.value)} className={inputClass} placeholder="ヤマダ" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">メイ <span className="text-red-500">*</span></label><input type="text" value={firstNameKana} onChange={(e) => setFirstNameKana(e.target.value)} className={inputClass} placeholder="タロウ" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">生年月日 <span className="text-red-500">*</span></label><input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputClass} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">性別 <span className="text-red-500">*</span></label><select value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass}><option value="male">男性</option><option value="female">女性</option></select></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">被保険者番号 <span className="text-red-500">*</span></label><input type="text" value={insuranceNumber} onChange={(e) => setInsuranceNumber(e.target.value)} className={inputClass} placeholder="介護保険被保険者番号" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">入居日 <span className="text-red-500">*</span></label><input type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} className={inputClass} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">部屋番号</label><input type="text" value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} className={inputClass} placeholder="101" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">備考</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputClass} placeholder="自由記述" /></div>
              <div className="flex justify-end pt-4"><Button onClick={() => setCurrentStep(2)}>次へ</Button></div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ステップ2: アカウント登録 */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <Card>
            <CardBody>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">アカウント登録</h3>
              <p className="text-sm text-gray-500 mb-6">サービスの通知を受け取り、お支払いを担当するアカウントを登録してください。</p>

              <div className="space-y-4">
                {accounts.map((account, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{account.type === "self" ? "👤" : "👥"}</span>
                        <h4 className="text-sm font-semibold text-gray-900">
                          {account.type === "self" ? "入居者本人" : `家族 ${accounts.filter((a, i) => a.type === "family" && i <= index).length}`}
                        </h4>
                        {account.isBillingPerson && <Badge className="bg-emerald-100 text-emerald-800">決済担当</Badge>}
                      </div>
                      {accounts.length > 1 && (
                        <button onClick={() => removeAccount(index)} className="text-sm text-red-600 hover:text-red-800">削除</button>
                      )}
                    </div>

                    <div className="space-y-3 max-w-xl">
                      {account.type === "self" ? (
                        <>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">氏名（入居者情報から自動設定）</p>
                            <p className="text-sm font-medium text-gray-900">{lastName || "（未入力）"} {firstName}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">通知方法 <span className="text-red-500">*</span></label>
                            <div className="flex gap-4">
                              {["LINE", "メール", "郵送"].map((m) => (
                                <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="radio" name={`notify-${index}`} value={m} checked={account.notifyMethod === m} onChange={() => updateAccount(index, "notifyMethod", m)} className="text-emerald-600 focus:ring-emerald-500" />
                                  <span className="text-sm text-gray-700">{m}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-medium text-gray-700 mb-1">氏名 <span className="text-red-500">*</span></label><input type="text" value={account.name} onChange={(e) => updateAccount(index, "name", e.target.value)} className={inputClass} placeholder="山田 花子" /></div>
                            <div><label className="block text-xs font-medium text-gray-700 mb-1">続柄 <span className="text-red-500">*</span></label>
                              <select value={account.relationship} onChange={(e) => updateAccount(index, "relationship", e.target.value)} className={inputClass}>
                                <option value="長男">長男</option><option value="長女">長女</option><option value="次男">次男</option><option value="次女">次女</option><option value="配偶者">配偶者</option><option value="その他">その他</option>
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-medium text-gray-700 mb-1">電話番号 <span className="text-red-500">*</span></label><input type="tel" value={account.phone} onChange={(e) => updateAccount(index, "phone", e.target.value)} className={inputClass} placeholder="090-1234-5678" /></div>
                            <div><label className="block text-xs font-medium text-gray-700 mb-1">メールアドレス</label><input type="email" value={account.email} onChange={(e) => updateAccount(index, "email", e.target.value)} className={inputClass} placeholder="example@email.com" /></div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">通知方法 <span className="text-red-500">*</span></label>
                            <div className="flex gap-4">
                              {["LINE", "メール", "郵送"].map((m) => (
                                <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                                  <input type="radio" name={`notify-${index}`} value={m} checked={account.notifyMethod === m} onChange={() => updateAccount(index, "notifyMethod", m)} className="text-emerald-600 focus:ring-emerald-500" />
                                  <span className="text-sm text-gray-700">{m}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={account.receiveNotify} onChange={(e) => updateAccount(index, "receiveNotify", e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                            <span className="text-sm text-gray-700">明細通知を受け取る</span>
                          </label>
                        </>
                      )}

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={account.isBillingPerson} onChange={(e) => updateAccount(index, "isBillingPerson", e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
                        <span className="text-sm text-gray-700">決済担当にする</span>
                      </label>
                    </div>
                  </div>
                ))}

                {/* アカウント追加 */}
                {showAddSelector ? (
                  <div className="border border-dashed border-gray-300 rounded-lg p-6">
                    <p className="text-sm text-gray-700 mb-4 text-center">どなたがサービスの通知を受け取り、お支払いを担当されますか？</p>
                    <div className="flex justify-center gap-4">
                      {!hasSelfAccount && (
                        <button onClick={() => addAccount("self")} className="flex flex-col items-center gap-2 border border-gray-200 rounded-lg p-4 w-36 hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
                          <span className="text-2xl">👤</span>
                          <span className="text-sm font-medium text-gray-900">入居者本人</span>
                        </button>
                      )}
                      <button onClick={() => addAccount("family")} className="flex flex-col items-center gap-2 border border-gray-200 rounded-lg p-4 w-36 hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
                        <span className="text-2xl">👥</span>
                        <span className="text-sm font-medium text-gray-900">家族</span>
                      </button>
                    </div>
                    <div className="text-center mt-3">
                      <button onClick={() => setShowAddSelector(false)} className="text-sm text-gray-500">キャンセル</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddSelector(true)} className="text-sm text-emerald-600 hover:text-emerald-800 font-medium">
                    + アカウントを追加
                  </button>
                )}
              </div>

              {!accounts.some((a) => a.isBillingPerson) && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">決済担当を1人設定してください。</p>
                </div>
              )}

              <div className="flex justify-between mt-6">
                <Button variant="secondary" onClick={() => setCurrentStep(1)}>戻る</Button>
                <Button onClick={() => setCurrentStep(3)} disabled={!accounts.some((a) => a.isBillingPerson)}>次へ</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* ステップ3: 確認 */}
      {currentStep === 3 && (
        <Card>
          <CardBody>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">登録内容の確認</h3>
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">入居者情報</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">氏名</p><p className="text-sm font-medium text-gray-900 mt-0.5">{lastName} {firstName}</p></div>
                  <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">フリガナ</p><p className="text-sm font-medium text-gray-900 mt-0.5">{lastNameKana} {firstNameKana}</p></div>
                  <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">生年月日</p><p className="text-sm font-medium text-gray-900 mt-0.5">{birthDate}</p></div>
                  <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">性別</p><p className="text-sm font-medium text-gray-900 mt-0.5">{gender === "male" ? "男性" : "女性"}</p></div>
                  <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">被保険者番号</p><p className="text-sm font-medium text-gray-900 mt-0.5">{insuranceNumber}</p></div>
                  <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">入居日</p><p className="text-sm font-medium text-gray-900 mt-0.5">{admissionDate}</p></div>
                  {roomNumber && <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500">部屋番号</p><p className="text-sm font-medium text-gray-900 mt-0.5">{roomNumber}</p></div>}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">アカウント情報</h4>
                {accounts.map((account, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3 mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span>{account.type === "self" ? "👤" : "👥"}</span>
                      <p className="text-sm font-medium text-gray-900">
                        {account.type === "self" ? `${lastName} ${firstName}（本人）` : `${account.name}（${account.relationship}）`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge className="bg-gray-200 text-gray-700">{account.notifyMethod}</Badge>
                      {account.isBillingPerson && <Badge className="bg-emerald-100 text-emerald-800">決済担当</Badge>}
                      {account.type === "family" && account.receiveNotify && <Badge className="bg-blue-100 text-blue-800">明細通知</Badge>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="text-sm text-gray-600">
                    <p className="font-medium text-gray-700 mb-1">クレジットカード登録について</p>
                    <p>決済担当の方が利用者ポータルからカード登録を行います。登録完了後に入居者詳細画面でステータスを確認できます。</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <Button variant="secondary" onClick={() => setCurrentStep(2)}>戻る</Button>
              <Button onClick={handleSubmit}>登録する</Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
