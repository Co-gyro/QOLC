"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AUTO_VALUES,
  CORP_INDIV_OPTIONS,
  SALES_STYLES,
  buildExcelFilename,
  generateJcbEcExcel,
  validateApplication,
  type JcbEcApplication,
  type ValidationIssue,
} from "@/lib/merchant-application/jcb-ec";
import {
  EMPTY_STORE_EXTRAS,
  IC_SET_STATUSES,
  STORE_SALES_STYLES,
  buildStoreExcelFilename,
  generateJcbStoreExcel,
  validateStoreExtras,
  type JcbStoreExtras,
} from "@/lib/merchant-application/jcb-store";

const EMPTY_APP: JcbEcApplication = {
  corpIndiv: "1",
  companyNameKanji: "",
  companyPostalCode: "",
  companyAddrKanji: "",
  companyTel: "",
  corpNo: "",
  repFamilyNameKanji: "",
  repNameKanji: "",
  repBirthday: "",
  tenantNameKanji: "",
  tenantPostalCode: "",
  tenantAddrKanji: "",
  tenantTel: "",
  companyNameKana: "",
  companyAddrKana: "",
  repFamilyNameKana: "",
  repNameKana: "",
  repPostalCode: "",
  repAddrKanji: "",
  repAddrKana: "",
  repTel: "",
  tenantNameKana: "",
  tenantNameLatin: "",
  tenantAddrKana: "",
  tenantURL: "",
  bizCatCode: "",
  salesStyle: "04",
  bizOverview: "",
  handlingProducts: "",
  notes: "",
  contractCode: "",
  merchantUseNo: "",
  posBranchCode1: "",
};

type Field = keyof JcbEcApplication;

function FieldRow({
  label,
  name,
  required,
  value,
  onChange,
  type = "text",
  placeholder,
  maxLength,
  hint,
  errors,
  className,
}: {
  label: string;
  name: Field;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "date" | "tel" | "url";
  placeholder?: string;
  maxLength?: number;
  hint?: string;
  errors?: ValidationIssue[];
  className?: string;
}) {
  const fieldErrors = (errors ?? []).filter((i) => i.field === name);
  const errorMsgs = fieldErrors.filter((i) => i.level === "error");
  const warningMsgs = fieldErrors.filter((i) => i.level === "warning");
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name} className="text-xs">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className={errorMsgs.length > 0 ? "border-destructive" : undefined}
      />
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      {errorMsgs.map((e, i) => (
        <p key={`e${i}`} className="text-[11px] text-destructive">{e.message}</p>
      ))}
      {warningMsgs.map((w, i) => (
        <p key={`w${i}`} className="text-[11px] text-amber-600">⚠ {w.message}</p>
      ))}
    </div>
  );
}

function TextareaRow({
  label,
  name,
  required,
  value,
  onChange,
  placeholder,
  rows = 3,
  errors,
  hint,
}: {
  label: string;
  name: Field;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  errors?: ValidationIssue[];
  hint?: string;
}) {
  const fieldErrors = (errors ?? []).filter((i) => i.field === name);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      <Textarea
        id={name}
        name={name}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={fieldErrors.some((e) => e.level === "error") ? "border-destructive" : undefined}
      />
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      {fieldErrors.map((e, i) => (
        <p
          key={i}
          className={cn(
            "text-[11px]",
            e.level === "error" ? "text-destructive" : "text-amber-600",
          )}
        >
          {e.level === "warning" ? "⚠ " : ""}{e.message}
        </p>
      ))}
    </div>
  );
}

export function JcbEcForm() {
  const [app, setApp] = useState<JcbEcApplication>(EMPTY_APP);
  const [storeExtras, setStoreExtras] = useState<JcbStoreExtras>(EMPTY_STORE_EXTRAS);
  const [showStoreSection, setShowStoreSection] = useState(false);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [showStoreErrors, setShowStoreErrors] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingStore, setDownloadingStore] = useState(false);

  const set = <K extends Field>(key: K) => (v: string) =>
    setApp((prev) => ({ ...prev, [key]: v }));

  const setStore = <K extends keyof JcbStoreExtras>(key: K) => (v: string) =>
    setStoreExtras((prev) => ({ ...prev, [key]: v as JcbStoreExtras[K] }));

  const issues = useMemo(() => validateApplication(app), [app]);
  const errorIssues = issues.filter((i) => i.level === "error");
  const warningIssues = issues.filter((i) => i.level === "warning");
  const errorsToShow = showAllErrors ? issues : [];

  const storeIssues = useMemo(() => validateStoreExtras(storeExtras), [storeExtras]);
  const storeErrors = storeIssues.filter((i) => i.level === "error");

  const isCorpWithNo = app.corpIndiv === "1";
  const isCorporation = app.corpIndiv === "1" || app.corpIndiv === "2";
  const isIndividual = app.corpIndiv === "3";

  const triggerDownload = (bytes: Uint8Array<ArrayBuffer>, filename: string) => {
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownload = async () => {
    setShowAllErrors(true);
    if (errorIssues.length > 0) return;
    setDownloading(true);
    try {
      const bytes = await generateJcbEcExcel(app);
      triggerDownload(bytes, buildExcelFilename(app.tenantNameKanji));
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadStore = async () => {
    setShowAllErrors(true);
    setShowStoreErrors(true);
    if (errorIssues.length > 0 || storeErrors.length > 0) return;
    setDownloadingStore(true);
    try {
      const bytes = await generateJcbStoreExcel(app, storeExtras);
      triggerDownload(bytes, buildStoreExcelFilename(app.tenantNameKanji));
    } finally {
      setDownloadingStore(false);
    }
  };

  const handleReset = () => {
    if (confirm("入力内容をリセットしますか？")) {
      setApp(EMPTY_APP);
      setStoreExtras(EMPTY_STORE_EXTRAS);
      setShowAllErrors(false);
      setShowStoreErrors(false);
    }
  };

  return (
    <div className="grid gap-6">
      {/* セクション1: 加盟店基本情報 */}
      <Card>
        <CardHeader>
          <CardTitle>セクション1: 加盟店基本情報</CardTitle>
          <CardDescription>
            加盟店から提供される基本情報。法人/個人区分により表示項目が変わります。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium">
              法人/個人区分 <span className="text-destructive">*</span>
            </legend>
            <div className="flex flex-wrap gap-4">
              {CORP_INDIV_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="corpIndiv"
                    value={opt.value}
                    checked={app.corpIndiv === opt.value}
                    onChange={(e) => set("corpIndiv")(e.target.value)}
                    className="h-4 w-4"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          {isCorporation ? (
            <div className="grid gap-4 rounded-md border bg-muted/20 p-4 sm:grid-cols-2">
              <FieldRow
                label="会社名（漢字）" name="companyNameKanji" required
                value={app.companyNameKanji} onChange={set("companyNameKanji")}
                hint="50文字以内、法人格のみは不可" errors={errorsToShow}
                className="sm:col-span-2"
              />
              <FieldRow
                label="会社郵便番号" name="companyPostalCode" required
                value={app.companyPostalCode} onChange={set("companyPostalCode")}
                placeholder="例: 1058555" maxLength={7}
                hint="ハイフンなし7桁" errors={errorsToShow}
              />
              <FieldRow
                label="会社電話番号" name="companyTel" required
                value={app.companyTel} onChange={set("companyTel")}
                placeholder="例: 03-1234-5678" maxLength={13}
                type="tel" errors={errorsToShow}
              />
              <FieldRow
                label="会社住所（漢字）" name="companyAddrKanji" required
                value={app.companyAddrKanji} onChange={set("companyAddrKanji")}
                hint="都道府県から番地・ビル名まで、60文字以内" errors={errorsToShow}
                className="sm:col-span-2"
              />
              {isCorpWithNo ? (
                <FieldRow
                  label="会社法人番号" name="corpNo" required
                  value={app.corpNo} onChange={set("corpNo")}
                  maxLength={13} hint="13桁数字"
                  errors={errorsToShow}
                />
              ) : null}
            </div>
          ) : (
            <FieldRow
              label="代表者電話番号 (法人不要、個人で必須)" name="repTel"
              required={isIndividual}
              value={app.repTel} onChange={set("repTel")}
              placeholder="例: 090-1234-5678" type="tel" maxLength={13}
              errors={errorsToShow}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow
              label="代表者 姓（漢字）" name="repFamilyNameKanji" required
              value={app.repFamilyNameKanji} onChange={set("repFamilyNameKanji")}
              maxLength={49} errors={errorsToShow}
            />
            <FieldRow
              label="代表者 名（漢字）" name="repNameKanji" required
              value={app.repNameKanji} onChange={set("repNameKanji")}
              maxLength={49} errors={errorsToShow}
            />
            <FieldRow
              label="代表者生年月日" name="repBirthday" required type="date"
              value={app.repBirthday} onChange={set("repBirthday")}
              hint="18歳以上であること" errors={errorsToShow}
            />
            {!isCorporation && (
              <FieldRow
                label="会社電話番号 (個人は連絡先電話)" name="companyTel" required
                value={app.companyTel} onChange={set("companyTel")}
                placeholder="例: 03-1234-5678" type="tel" maxLength={13}
                errors={errorsToShow}
              />
            )}
          </div>

          <div className="grid gap-4 rounded-md border bg-muted/20 p-4 sm:grid-cols-2">
            <FieldRow
              label="店舗名（漢字）= 事業所名" name="tenantNameKanji" required
              value={app.tenantNameKanji} onChange={set("tenantNameKanji")}
              maxLength={20} hint="20文字以内 (超過分は切り捨て)" errors={errorsToShow}
              className="sm:col-span-2"
            />
            <FieldRow
              label="店舗郵便番号" name="tenantPostalCode" required
              value={app.tenantPostalCode} onChange={set("tenantPostalCode")}
              placeholder="例: 1058555" maxLength={7}
              hint="ハイフンなし7桁" errors={errorsToShow}
            />
            <FieldRow
              label="店舗電話番号" name="tenantTel" required
              value={app.tenantTel} onChange={set("tenantTel")}
              placeholder="例: 03-1234-5678" type="tel" maxLength={13}
              errors={errorsToShow}
            />
            <FieldRow
              label="店舗住所（漢字）" name="tenantAddrKanji" required
              value={app.tenantAddrKanji} onChange={set("tenantAddrKanji")}
              hint="都道府県から番地・ビル名まで、60文字以内" errors={errorsToShow}
              className="sm:col-span-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* セクション2: UD補完 */}
      <Card>
        <CardHeader>
          <CardTitle>セクション2: UD確認・補完項目</CardTitle>
          <CardDescription>
            UDスタッフが入力する項目（カナ、アルファベット、コード、補足など）。
            カナは半角カナで、拗音・促音 (ｧｨｩｪｫｬｭｮｯ) は大文字に置換 (ｱｲｳｴｵﾔﾕﾖﾂ)。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isCorporation && (
            <div className="grid gap-4 rounded-md border bg-muted/20 p-4 sm:grid-cols-2">
              <FieldRow
                label="会社名（カナ）" name="companyNameKana" required
                value={app.companyNameKana} onChange={set("companyNameKana")}
                placeholder="例: ｶﾌﾞｼｷｶﾞｲｼｬﾕﾆﾊﾞｰｻﾙ" maxLength={100}
                hint="半角カナ。拗音・促音・英数字は不可" errors={errorsToShow}
                className="sm:col-span-2"
              />
              <FieldRow
                label="会社住所（カナ）" name="companyAddrKana" required
                value={app.companyAddrKana} onChange={set("companyAddrKana")}
                placeholder="例: ﾄｳｷﾖｳﾄﾐﾅﾄｸ-..." maxLength={100}
                hint="半角カナ＋ハイフンのみ。100文字以内" errors={errorsToShow}
                className="sm:col-span-2"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow
              label="代表者 姓（カナ）" name="repFamilyNameKana" required
              value={app.repFamilyNameKana} onChange={set("repFamilyNameKana")}
              maxLength={99} placeholder="例: ﾔﾏﾀﾞ" errors={errorsToShow}
            />
            <FieldRow
              label="代表者 名（カナ）" name="repNameKana" required
              value={app.repNameKana} onChange={set("repNameKana")}
              maxLength={99} placeholder="例: ﾀﾛｳ" errors={errorsToShow}
            />
          </div>

          {isIndividual && (
            <div className="grid gap-4 rounded-md border bg-muted/20 p-4 sm:grid-cols-2">
              <FieldRow
                label="代表者郵便番号 (個人)" name="repPostalCode" required
                value={app.repPostalCode} onChange={set("repPostalCode")}
                maxLength={7} hint="ハイフンなし7桁" errors={errorsToShow}
              />
              <FieldRow
                label="代表者電話番号 (個人)" name="repTel" required
                value={app.repTel} onChange={set("repTel")}
                placeholder="例: 090-1234-5678" type="tel" maxLength={13}
                errors={errorsToShow}
              />
              <FieldRow
                label="代表者住所（漢字） (個人)" name="repAddrKanji" required
                value={app.repAddrKanji} onChange={set("repAddrKanji")}
                hint="都道府県から番地まで、60文字以内" errors={errorsToShow}
                className="sm:col-span-2"
              />
              <FieldRow
                label="代表者住所（カナ） (個人)" name="repAddrKana" required
                value={app.repAddrKana} onChange={set("repAddrKana")}
                placeholder="例: ﾄｳｷﾖｳﾄﾐﾅﾄｸ-..." maxLength={100}
                hint="半角カナ＋ハイフンのみ。100文字以内" errors={errorsToShow}
                className="sm:col-span-2"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow
              label="店舗名（カナ）" name="tenantNameKana" required
              value={app.tenantNameKana} onChange={set("tenantNameKana")}
              maxLength={30} placeholder="例: ｶｲｺﾞｼｾﾂｴｰ"
              hint="30文字以内、半角カナ" errors={errorsToShow}
            />
            <FieldRow
              label="店舗名（アルファベット）" name="tenantNameLatin" required
              value={app.tenantNameLatin}
              onChange={(v) => set("tenantNameLatin")(v.toUpperCase())}
              maxLength={25} placeholder="例: KAIGO SHISETSU A"
              hint="半角英大文字＋数字＋スペース、25文字以内" errors={errorsToShow}
            />
            <FieldRow
              label="店舗住所（カナ）" name="tenantAddrKana" required
              value={app.tenantAddrKana} onChange={set("tenantAddrKana")}
              maxLength={100} placeholder="例: ﾄｳｷﾖｳﾄﾐﾅﾄｸ-..."
              hint="半角カナ＋ハイフンのみ" errors={errorsToShow}
              className="sm:col-span-2"
            />
            <FieldRow
              label="URL (任意)" name="tenantURL"
              value={app.tenantURL} onChange={set("tenantURL")}
              type="url" placeholder="https://..."
              hint="AMEX Safekey利用時は必須 (今回は0=利用なし固定)"
              errors={errorsToShow}
              className="sm:col-span-2"
            />
            <FieldRow
              label="業態コード" name="bizCatCode" required
              value={app.bizCatCode} onChange={set("bizCatCode")}
              maxLength={5} placeholder="例: 12345"
              hint="5桁数字 (JCBが定義)" errors={errorsToShow}
            />
            <div className="space-y-1.5">
              <Label htmlFor="salesStyle" className="text-xs">
                販売形態区分 <span className="text-destructive">*</span>
              </Label>
              <select
                id="salesStyle"
                value={app.salesStyle}
                onChange={(e) => set("salesStyle")(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {SALES_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <TextareaRow
              label="業種業務内容" name="bizOverview" required
              value={app.bizOverview} onChange={set("bizOverview")}
              placeholder="業務内容を全角で入力" hint="全角256文字以内"
              errors={errorsToShow}
            />
            <TextareaRow
              label="取扱商材" name="handlingProducts" required
              value={app.handlingProducts} onChange={set("handlingProducts")}
              placeholder="取扱商材を全角で入力" hint="全角256文字以内"
              errors={errorsToShow}
            />
            <TextareaRow
              label="備考 (任意)" name="notes"
              value={app.notes} onChange={set("notes")}
              hint="500文字以内、全角・半角OK" rows={2}
              errors={errorsToShow}
            />
          </div>
        </CardContent>
      </Card>

      {/* セクション3: 自動値プレビュー + 一部入力 */}
      <Card>
        <CardHeader>
          <CardTitle>セクション3: 自動設定値プレビュー</CardTitle>
          <CardDescription>
            申請データFMTで自動設定される値の一覧。契約コード・包括加盟店使用番号・POS支店コードのみ入力します。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 rounded-md border bg-muted/20 p-4 sm:grid-cols-2">
            <FieldRow
              label="契約コード (JCB付与6桁)" name="contractCode" required
              value={app.contractCode} onChange={set("contractCode")}
              maxLength={6} hint="JCBから連絡された6桁数字"
              errors={errorsToShow}
            />
            <FieldRow
              label="POS支店コード(1) (TID 13桁)" name="posBranchCode1" required
              value={app.posBranchCode1} onChange={set("posBranchCode1")}
              maxLength={13} hint="13桁数字、過去申請含めて一意"
              errors={errorsToShow}
            />
            <FieldRow
              label="包括加盟店使用番号 (モールコード)" name="merchantUseNo"
              value={app.merchantUseNo} onChange={set("merchantUseNo")}
              maxLength={30} hint="任意。半角英数字、30文字以内"
              errors={errorsToShow}
              className="sm:col-span-2"
            />
          </div>

          <div className="rounded-md border p-4">
            <p className="mb-2 text-sm font-medium">読み取り専用 (EC版自動設定値)</p>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
              <Pair k="申請区分" v="1 (新規)" />
              <Pair k="包括事業者コード" v={AUTO_VALUES.enterpriseCode} />
              <Pair k="対象加盟店番号" v="(空欄、新規のため)" />
              <Pair k="訪問販売有無 / 電話勧誘 / 連鎖販売 / 業務提供誘引" v="0 (無) / 0 / 0 / 0" />
              <Pair k="J/Secure(2.0)有無" v={`${AUTO_VALUES.jSecure2} (有)`} />
              <Pair k="J/S Merchant Name" v={app.tenantNameLatin || "(店舗名アルファベットからコピー)"} />
              <Pair k="Protect Buy / AMEX Safekey 有無" v="0 (無) / 0 (無)" />
              <Pair k="カード情報保持状況" v={`${AUTO_VALUES.cardInfoRetainStatus} (非保持)`} />
              <Pair k="PCIDSS準拠状況" v={`${AUTO_VALUES.pcidssComplStatus} (準拠)`} />
              <Pair k="本人認証 / セキュリティコード" v="1 (実施済) / 1 (実施済)" />
              <Pair k="不正配送先 / 属性行動分析 / その他" v="3 (実施予定なし) / 3 / 3" />
            </dl>
            <p className="mt-3 text-[11px] text-muted-foreground">
              ※ 店頭版では3Dセキュア系項目 (J/Secure / Protect Buy / AMEX Safekey 等) は仕様上存在しません。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* JCB 店頭版固有項目 (出力に応じて開閉) */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>JCB 店頭版 固有項目</CardTitle>
            <CardDescription>
              店頭版Excel出力に必要な項目 (店舗形態、IC端末、QUICPay/iD・交通系SPRWID等)。
              EC版のみ使用する場合は入力不要です。
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => setShowStoreSection((s) => !s)}>
            {showStoreSection ? "店頭版項目を閉じる" : "店頭版項目を表示"}
          </Button>
        </CardHeader>
        {showStoreSection ? (
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="storeSalesStyle" className="text-xs">
                  店舗形態 <span className="text-destructive">*</span>
                </Label>
                <select
                  id="storeSalesStyle"
                  value={storeExtras.storeSalesStyle}
                  onChange={(e) => setStore("storeSalesStyle")(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {STORE_SALES_STYLES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  EC版の「販売形態区分」とは別の選択肢です。
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="icSetStatus" className="text-xs">
                  IC端末設置状況 <span className="text-destructive">*</span>
                </Label>
                <select
                  id="icSetStatus"
                  value={storeExtras.icSetStatus}
                  onChange={(e) => setStore("icSetStatus")(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {IC_SET_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-md border bg-muted/20 p-4">
              <p className="mb-3 text-xs font-medium">クレジット/PREMO用POS支店コード (2)〜(5) — 任意、各13桁数字</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["posBranchCode2", "posBranchCode3", "posBranchCode4", "posBranchCode5"] as const).map(
                  (key, idx) => (
                    <div key={key} className="space-y-1.5">
                      <Label htmlFor={key} className="text-xs">{`POS支店コード(${idx + 2})`}</Label>
                      <Input
                        id={key}
                        value={storeExtras[key]}
                        onChange={(e) => setStore(key)(e.target.value)}
                        maxLength={13}
                        placeholder="13桁数字"
                      />
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="rounded-md border bg-muted/20 p-4">
              <p className="mb-3 text-xs font-medium">QUICPay/iD用POS支店コード (1)〜(5) — 任意、各13桁数字</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    "qpPosBranchCode1",
                    "qpPosBranchCode2",
                    "qpPosBranchCode3",
                    "qpPosBranchCode4",
                    "qpPosBranchCode5",
                  ] as const
                ).map((key, idx) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={key} className="text-xs">{`QUICPay/iD POS(${idx + 1})`}</Label>
                    <Input
                      id={key}
                      value={storeExtras[key]}
                      onChange={(e) => setStore(key)(e.target.value)}
                      maxLength={13}
                      placeholder="13桁数字"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border bg-muted/20 p-4">
              <p className="mb-3 text-xs font-medium">交通系SPRWID (1)〜(5) — 任意、各13桁英数字 (ハイフン不可)</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    "transSprwid1",
                    "transSprwid2",
                    "transSprwid3",
                    "transSprwid4",
                    "transSprwid5",
                  ] as const
                ).map((key, idx) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={key} className="text-xs">{`SPRWID(${idx + 1})`}</Label>
                    <Input
                      id={key}
                      value={storeExtras[key]}
                      onChange={(e) => setStore(key)(e.target.value.toUpperCase())}
                      maxLength={13}
                      placeholder="13桁英数字"
                    />
                  </div>
                ))}
              </div>
            </div>

            {showStoreErrors && storeErrors.length > 0 ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="mb-2 font-medium text-destructive">
                  店頭版固有項目のエラー {storeErrors.length}件
                </p>
                <ul className="space-y-1 text-xs text-destructive">
                  {storeErrors.map((e, i) => (
                    <li key={i}>• {e.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      {/* バリデーションサマリ + ダウンロード */}
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-xl">Excel出力</CardTitle>
            <CardDescription>
              JCB の各申請フォーマット (71列) でXLSXを生成します。
              EC版・店頭版それぞれ仕様書「【別紙】申請データFMT」シートに合わせた列順で出力。
            </CardDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={handleReset}>リセット</Button>
            <Button onClick={handleDownload} disabled={downloading || downloadingStore}>
              {downloading ? "生成中…" : "JCB EC版 Excelダウンロード"}
            </Button>
            <Button
              variant="secondary"
              onClick={handleDownloadStore}
              disabled={downloading || downloadingStore}
            >
              {downloadingStore ? "生成中…" : "JCB 店頭版 Excelダウンロード"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showAllErrors && errorIssues.length > 0 ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="mb-2 font-medium text-destructive">
                エラー {errorIssues.length}件 — 修正してから再度ダウンロードしてください
              </p>
              <ul className="space-y-1 text-xs text-destructive">
                {errorIssues.slice(0, 30).map((e, i) => (
                  <li key={i}>• {e.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {warningIssues.length > 0 ? (
            <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
              <p className="mb-2 font-medium text-amber-700">
                警告 {warningIssues.length}件 — 続行可能ですが確認推奨
              </p>
              <ul className="space-y-1 text-xs text-amber-700">
                {warningIssues.slice(0, 20).map((w, i) => (
                  <li key={i}>⚠ {w.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {showAllErrors && errorIssues.length === 0 && warningIssues.length === 0 ? (
            <p className="text-sm text-emerald-700">バリデーション OK ✓</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono">{v}</dd>
    </>
  );
}
