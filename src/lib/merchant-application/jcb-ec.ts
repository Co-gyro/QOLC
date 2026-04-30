import ExcelJS from "exceljs";

export type CorpIndiv = "1" | "2" | "3";
// 1=法人(法人番号有), 2=法人(法人番号無), 3=個人

export type SalesStyle = "01" | "04" | "06" | "11";
// 01=一般, 04=OLS, 06=登録型(都度オーソリなし), 11=登録型(都度オーソリあり)

export interface JcbEcApplication {
  // セクション1: 加盟店基本情報
  corpIndiv: CorpIndiv;
  companyNameKanji: string;
  companyPostalCode: string;
  companyAddrKanji: string;
  companyTel: string;
  corpNo: string;
  repFamilyNameKanji: string;
  repNameKanji: string;
  repBirthday: string; // YYYY-MM-DD
  tenantNameKanji: string;
  tenantPostalCode: string;
  tenantAddrKanji: string;
  tenantTel: string;

  // セクション2: UD補完
  companyNameKana: string;
  companyAddrKana: string;
  repFamilyNameKana: string;
  repNameKana: string;
  repPostalCode: string;
  repAddrKanji: string;
  repAddrKana: string;
  repTel: string;
  tenantNameKana: string;
  tenantNameLatin: string;
  tenantAddrKana: string;
  tenantURL: string;
  bizCatCode: string;
  salesStyle: SalesStyle;
  bizOverview: string;
  handlingProducts: string;
  notes: string;

  // セクション3: 自動 + 一部入力
  contractCode: string;       // JCB付与6桁
  merchantUseNo: string;      // モールコード (フリー入力)
  posBranchCode1: string;     // TID 13桁
}

// 自動設定値 (定数)
export const AUTO_VALUES = {
  requestType: "1",            // 1=新規
  enterpriseCode: "0160",      // 包括事業者コード固定
  d2DSales: "0",
  teleMktgSales: "0",
  multiLvlMktg: "0",
  bizOfferInvitSales: "0",
  jSecure2: "1",
  protectBuy: "0",
  amexSafekey: "0",
  cardInfoRetainStatus: "2",
  pcidssComplStatus: "1",
  verifyServiceImplStatus: "1",
  cscImplStatus: "1",
  illegalShipInfoUseStatus: "3",
  attrBehavAnlysImplStatus: "3",
  otherOrigMeas: "3",
} as const;

// JCB申請データFMTシートの71カラム順 (仕様書「【別紙】申請データFMT」と完全一致)
const COLUMN_HEADERS: readonly string[] = [
  "申請区分",
  "包括事業者コード",
  "契約コード",
  "対象加盟店番号",
  "法人/個人区分",
  "会社名（漢字）",
  "会社名（カナ）",
  "会社郵便番号",
  "会社住所（漢字）",
  "会社住所（カナ）",
  "会社電話番号",
  "会社法人番号",
  "代表者姓（漢字）",
  "代表者名（漢字）",
  "代表者姓（カナ）",
  "代表者名（カナ）",
  "代表者生年月日",
  "代表者郵便番号",
  "代表者住所（漢字）",
  "代表者住所（カナ）",
  "代表者電話番号",
  "店舗名（漢字）",
  "店舗名（カナ）",
  "店舗名（アルファベット）",
  "店舗郵便番号",
  "店舗住所（漢字）",
  "店舗住所（カナ）",
  "店舗電話番号",
  "URL",
  "業態コード",
  "販売形態区分",
  "業種業務内容",
  "取扱商材",
  "訪問販売有無",
  "電話勧誘販売有無",
  "連鎖販売取引有無",
  "業務提供誘引販売有無",
  "J/Secure（2.0)有無",
  "J/S Merchant Name",
  "Protect Buy有無",
  "AMEX Safekey有無",
  "カード情報保持状況",
  "PCIDSS準拠状況",
  "本人認証サービス実施状況",
  "セキュリティコード実施状況",
  "不正配送先情報活用状況",
  "属性・行動分析実施状況",
  "その他独自対策",
  "その他の対策コメント",
  "クレジット/PREMO用POS支店コード(1)",
  "クレジット/PREMO用POS支店コード(2)",
  "クレジット/PREMO用POS支店コード(3)",
  "クレジット/PREMO用POS支店コード(4)",
  "クレジット/PREMO用POS支店コード(5)",
  "包括KA営業事前連携サイン",
  "二重営業事前連携サイン",
  "包括加盟店使用番号",
  "売上データ用相手先番号",
  "加盟店管理独自コード(1)",
  "加盟店管理独自コード(2)",
  "備考",
  "予約日",
  "照会番号",
  "案件申請日",
  "判定結果コード",
  "判定結果",
  "加盟年月日",
  "加盟店番号",
  "審査判定結果詳細理由",
  "返却理由詳細",
  "結果報告準備完了日",
];

function isoBirthdayToYyyymmdd(iso: string): string {
  if (!iso) return "";
  return iso.replace(/-/g, "");
}

// 71カラムの行データに変換 (空欄は "" のまま、JCB側で fill-in する後半項目はブランク固定)
export function applicationToRow(app: JcbEcApplication): string[] {
  const isCorpWithNo = app.corpIndiv === "1";
  const isCorporation = app.corpIndiv === "1" || app.corpIndiv === "2";
  const isIndividual = app.corpIndiv === "3";

  return [
    AUTO_VALUES.requestType,
    AUTO_VALUES.enterpriseCode,
    app.contractCode,
    "", // 対象加盟店番号 (新規はブランク)
    app.corpIndiv,
    isCorporation ? app.companyNameKanji : "",
    isCorporation ? app.companyNameKana : "",
    isCorporation ? app.companyPostalCode : "",
    isCorporation ? app.companyAddrKanji : "",
    isCorporation ? app.companyAddrKana : "",
    isCorporation ? app.companyTel : "",
    isCorpWithNo ? app.corpNo : "",
    app.repFamilyNameKanji,
    app.repNameKanji,
    app.repFamilyNameKana,
    app.repNameKana,
    isoBirthdayToYyyymmdd(app.repBirthday),
    isIndividual ? app.repPostalCode : "",
    isIndividual ? app.repAddrKanji : "",
    isIndividual ? app.repAddrKana : "",
    isIndividual ? app.repTel : "",
    app.tenantNameKanji,
    app.tenantNameKana,
    app.tenantNameLatin,
    app.tenantPostalCode,
    app.tenantAddrKanji,
    app.tenantAddrKana,
    app.tenantTel,
    app.tenantURL,
    app.bizCatCode,
    app.salesStyle,
    app.bizOverview,
    app.handlingProducts,
    AUTO_VALUES.d2DSales,
    AUTO_VALUES.teleMktgSales,
    AUTO_VALUES.multiLvlMktg,
    AUTO_VALUES.bizOfferInvitSales,
    AUTO_VALUES.jSecure2,
    app.tenantNameLatin, // J/S Merchant Name = 店舗名アルファベットからコピー
    AUTO_VALUES.protectBuy,
    AUTO_VALUES.amexSafekey,
    AUTO_VALUES.cardInfoRetainStatus,
    AUTO_VALUES.pcidssComplStatus,
    AUTO_VALUES.verifyServiceImplStatus,
    AUTO_VALUES.cscImplStatus,
    AUTO_VALUES.illegalShipInfoUseStatus,
    AUTO_VALUES.attrBehavAnlysImplStatus,
    AUTO_VALUES.otherOrigMeas,
    "", // その他の対策コメント
    app.posBranchCode1,
    "", // POS支店コード(2)
    "", // POS支店コード(3)
    "", // POS支店コード(4)
    "", // POS支店コード(5)
    "", // 包括KA営業事前連携サイン
    "", // 二重営業事前連携サイン
    app.merchantUseNo,
    "", // 売上データ用相手先番号
    "", // 加盟店管理独自コード(1)
    "", // 加盟店管理独自コード(2)
    app.notes,
    "", // 予約日
    "", // 照会番号
    "", // 案件申請日
    "", // 判定結果コード
    "", // 判定結果
    "", // 加盟年月日
    "", // 加盟店番号
    "", // 審査判定結果詳細理由
    "", // 返却理由詳細
    "", // 結果報告準備完了日
  ];
}

// バリデーション
const HALF_KANA_RE = /^[｡-ﾟ \-.]*$/; // 名前カナ: 半角カナ + 半角スペース + ハイフン + ピリオド
const HALF_KANA_ADDR_RE = /^[｡-ﾟ0-9 \-.()]*$/; // 住所カナ: 名前カナ + 半角数字 + カッコ (仕様書 例:ﾄｳｷﾖｳﾄ…5-1-22)
const FORBIDDEN_YOON_RE = /[ｧｨｩｪｫｬｭｮｯ]/; // 拗音・促音 (半角)
const FORBIDDEN_FW_YOON_RE = /[ァィゥェォャュョッ]/; // 全角拗音・促音 (誤入力警告用)

export interface ValidationIssue {
  field: keyof JcbEcApplication | "general";
  level: "error" | "warning";
  message: string;
}

export function validateApplication(app: JcbEcApplication): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const isCorpWithNo = app.corpIndiv === "1";
  const isCorporation = app.corpIndiv === "1" || app.corpIndiv === "2";
  const isIndividual = app.corpIndiv === "3";

  const required = (v: string, field: keyof JcbEcApplication, label: string) => {
    if (!v || v.trim().length === 0) {
      issues.push({ field, level: "error", message: `${label} は必須です。` });
    }
  };
  const maxLen = (v: string, field: keyof JcbEcApplication, label: string, max: number) => {
    if (!v) return;
    const len = Array.from(v).length;
    if (len > max) {
      issues.push({ field, level: "error", message: `${label} は最大${max}文字です（現在${len}文字）。` });
    }
  };
  const digits = (v: string, field: keyof JcbEcApplication, label: string, len: number) => {
    if (v && !new RegExp(`^\\d{${len}}$`).test(v)) {
      issues.push({ field, level: "error", message: `${label} は${len}桁の数字で入力してください。` });
    }
  };
  const checkKana = (v: string, field: keyof JcbEcApplication, label: string) => {
    if (!v) return;
    if (!HALF_KANA_RE.test(v)) {
      issues.push({ field, level: "error", message: `${label} は半角カナで入力してください（許可: 半角カナ、ハイフン、ピリオド、スペース）。` });
    }
    if (FORBIDDEN_YOON_RE.test(v)) {
      issues.push({ field, level: "warning", message: `${label} に拗音・促音 (ｧｨｩｪｫｬｭｮｯ) が含まれます。大文字 (ｱｲｳｴｵﾔﾕﾖﾂ) に置換してください。` });
    }
    if (FORBIDDEN_FW_YOON_RE.test(v)) {
      issues.push({ field, level: "warning", message: `${label} に全角拗音・促音 (ァィゥェォャュョッ) が含まれます。半角の大文字 (ｱｲｳｴｵﾔﾕﾖﾂ) に置換してください。` });
    }
  };
  const checkAddrKana = (v: string, field: keyof JcbEcApplication, label: string) => {
    if (!v) return;
    if (!HALF_KANA_ADDR_RE.test(v)) {
      issues.push({ field, level: "error", message: `${label} は半角カナ・半角数字・ハイフン等のみで入力してください。` });
    }
    if (FORBIDDEN_YOON_RE.test(v) || FORBIDDEN_FW_YOON_RE.test(v)) {
      issues.push({ field, level: "warning", message: `${label} に拗音・促音が含まれます。大文字に置換してください。` });
    }
  };

  // 必須 (区分共通)
  required(app.corpIndiv, "corpIndiv", "法人/個人区分");
  required(app.companyTel, "companyTel", "会社電話番号");
  required(app.repFamilyNameKanji, "repFamilyNameKanji", "代表者姓（漢字）");
  required(app.repNameKanji, "repNameKanji", "代表者名（漢字）");
  required(app.repFamilyNameKana, "repFamilyNameKana", "代表者姓（カナ）");
  required(app.repNameKana, "repNameKana", "代表者名（カナ）");
  required(app.repBirthday, "repBirthday", "代表者生年月日");
  required(app.tenantNameKanji, "tenantNameKanji", "店舗名（漢字）");
  required(app.tenantNameKana, "tenantNameKana", "店舗名（カナ）");
  required(app.tenantNameLatin, "tenantNameLatin", "店舗名（アルファベット）");
  required(app.tenantPostalCode, "tenantPostalCode", "店舗郵便番号");
  required(app.tenantAddrKanji, "tenantAddrKanji", "店舗住所（漢字）");
  required(app.tenantAddrKana, "tenantAddrKana", "店舗住所（カナ）");
  required(app.tenantTel, "tenantTel", "店舗電話番号");
  required(app.bizCatCode, "bizCatCode", "業態コード");
  required(app.salesStyle, "salesStyle", "販売形態区分");
  required(app.bizOverview, "bizOverview", "業種業務内容");
  required(app.handlingProducts, "handlingProducts", "取扱商材");
  required(app.contractCode, "contractCode", "契約コード");
  required(app.posBranchCode1, "posBranchCode1", "POS支店コード(1)");

  // 法人専用必須
  if (isCorporation) {
    required(app.companyNameKanji, "companyNameKanji", "会社名（漢字）");
    required(app.companyNameKana, "companyNameKana", "会社名（カナ）");
    required(app.companyPostalCode, "companyPostalCode", "会社郵便番号");
    required(app.companyAddrKanji, "companyAddrKanji", "会社住所（漢字）");
    required(app.companyAddrKana, "companyAddrKana", "会社住所（カナ）");
  }
  if (isCorpWithNo) required(app.corpNo, "corpNo", "会社法人番号");

  // 個人専用必須
  if (isIndividual) {
    required(app.repPostalCode, "repPostalCode", "代表者郵便番号");
    required(app.repAddrKanji, "repAddrKanji", "代表者住所（漢字）");
    required(app.repAddrKana, "repAddrKana", "代表者住所（カナ）");
    required(app.repTel, "repTel", "代表者電話番号");
  }

  // 桁数・形式
  digits(app.contractCode, "contractCode", "契約コード", 6);
  if (isCorpWithNo) digits(app.corpNo, "corpNo", "会社法人番号", 13);
  digits(app.tenantPostalCode, "tenantPostalCode", "店舗郵便番号", 7);
  if (isCorporation) digits(app.companyPostalCode, "companyPostalCode", "会社郵便番号", 7);
  if (isIndividual) digits(app.repPostalCode, "repPostalCode", "代表者郵便番号", 7);
  digits(app.bizCatCode, "bizCatCode", "業態コード", 5);
  if (app.posBranchCode1) digits(app.posBranchCode1, "posBranchCode1", "POS支店コード(1)", 13);

  // 電話番号: 数字とハイフンのみ
  const phoneRe = /^[\d-]+$/;
  if (app.companyTel && !phoneRe.test(app.companyTel)) issues.push({ field: "companyTel", level: "error", message: "会社電話番号は数字とハイフンのみ。" });
  if (app.tenantTel && !phoneRe.test(app.tenantTel)) issues.push({ field: "tenantTel", level: "error", message: "店舗電話番号は数字とハイフンのみ。" });
  if (app.repTel && !phoneRe.test(app.repTel)) issues.push({ field: "repTel", level: "error", message: "代表者電話番号は数字とハイフンのみ。" });

  // 文字数
  maxLen(app.companyNameKanji, "companyNameKanji", "会社名（漢字）", 50);
  maxLen(app.companyNameKana, "companyNameKana", "会社名（カナ）", 100);
  maxLen(app.companyAddrKanji, "companyAddrKanji", "会社住所（漢字）", 60);
  maxLen(app.companyAddrKana, "companyAddrKana", "会社住所（カナ）", 100);
  maxLen(app.repFamilyNameKanji, "repFamilyNameKanji", "代表者姓（漢字）", 49);
  maxLen(app.repNameKanji, "repNameKanji", "代表者名（漢字）", 49);
  maxLen(app.repFamilyNameKana, "repFamilyNameKana", "代表者姓（カナ）", 99);
  maxLen(app.repNameKana, "repNameKana", "代表者名（カナ）", 99);
  maxLen(app.repAddrKanji, "repAddrKanji", "代表者住所（漢字）", 60);
  maxLen(app.repAddrKana, "repAddrKana", "代表者住所（カナ）", 100);
  maxLen(app.tenantNameKanji, "tenantNameKanji", "店舗名（漢字）", 20);
  maxLen(app.tenantNameKana, "tenantNameKana", "店舗名（カナ）", 30);
  maxLen(app.tenantNameLatin, "tenantNameLatin", "店舗名（アルファベット）", 25);
  maxLen(app.tenantAddrKanji, "tenantAddrKanji", "店舗住所（漢字）", 60);
  maxLen(app.tenantAddrKana, "tenantAddrKana", "店舗住所（カナ）", 100);
  maxLen(app.bizOverview, "bizOverview", "業種業務内容", 256);
  maxLen(app.handlingProducts, "handlingProducts", "取扱商材", 256);
  maxLen(app.notes, "notes", "備考", 500);
  maxLen(app.merchantUseNo, "merchantUseNo", "包括加盟店使用番号", 30);

  // カナチェック
  checkKana(app.companyNameKana, "companyNameKana", "会社名（カナ）");
  checkAddrKana(app.companyAddrKana, "companyAddrKana", "会社住所（カナ）");
  checkKana(app.repFamilyNameKana, "repFamilyNameKana", "代表者姓（カナ）");
  checkKana(app.repNameKana, "repNameKana", "代表者名（カナ）");
  checkAddrKana(app.repAddrKana, "repAddrKana", "代表者住所（カナ）");
  checkKana(app.tenantNameKana, "tenantNameKana", "店舗名（カナ）");
  checkAddrKana(app.tenantAddrKana, "tenantAddrKana", "店舗住所（カナ）");

  // アルファベット (大文字のみ、記号不可)
  if (app.tenantNameLatin && !/^[A-Z0-9 ]*$/.test(app.tenantNameLatin)) {
    issues.push({
      field: "tenantNameLatin",
      level: "error",
      message: "店舗名（アルファベット）は半角英大文字と数字のみ（記号不可）。",
    });
  }

  // 包括加盟店使用番号 (半角英数字)
  if (app.merchantUseNo && !/^[A-Za-z0-9]*$/.test(app.merchantUseNo)) {
    issues.push({
      field: "merchantUseNo",
      level: "error",
      message: "包括加盟店使用番号は半角英数字のみ。",
    });
  }

  // 18歳以上チェック
  if (app.repBirthday && /^\d{4}-\d{2}-\d{2}$/.test(app.repBirthday)) {
    const birth = new Date(app.repBirthday);
    if (Number.isNaN(birth.getTime())) {
      issues.push({ field: "repBirthday", level: "error", message: "代表者生年月日が不正です。" });
    } else {
      const now = new Date();
      const age =
        now.getFullYear() -
        birth.getFullYear() -
        (now.getMonth() < birth.getMonth() ||
        (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
          ? 1
          : 0);
      if (age < 18) {
        issues.push({
          field: "repBirthday",
          level: "error",
          message: `代表者は18歳以上である必要があります（現在 ${age} 歳）。`,
        });
      }
      if (birth > now) {
        issues.push({
          field: "repBirthday",
          level: "error",
          message: "代表者生年月日が未来の日付になっています。",
        });
      }
    }
  }

  return issues;
}

export async function generateJcbEcExcel(app: JcbEcApplication): Promise<Uint8Array<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "QOLC";
  wb.created = new Date();
  const ws = wb.addWorksheet("【別紙】申請データFMT");
  ws.addRow(COLUMN_HEADERS);
  ws.addRow(applicationToRow(app));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  ws.columns.forEach((col, i) => {
    const header = COLUMN_HEADERS[i] ?? "";
    col.width = Math.max(header.length * 2, 10);
  });

  const data = (await wb.xlsx.writeBuffer()) as ArrayBuffer | Uint8Array;
  // ArrayBuffer-backed Uint8Array に正規化 (Blob互換)
  if (data instanceof Uint8Array) {
    const buffer = new ArrayBuffer(data.byteLength);
    const view = new Uint8Array(buffer);
    view.set(data);
    return view;
  }
  return new Uint8Array(data as ArrayBuffer);
}

export function buildExcelFilename(tenantName: string, date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const safe = (tenantName || "新規申請").replace(/[\\/:*?"<>|]/g, "_").slice(0, 30);
  return `JCB_EC_申請_${safe}_${yyyy}${mm}${dd}.xlsx`;
}

export const SALES_STYLES: Array<{ value: SalesStyle; label: string }> = [
  { value: "01", label: "01: 一般 (カタログ通販等)" },
  { value: "04", label: "04: OLS (オンラインショッピング)" },
  { value: "06", label: "06: 登録型 (継続課金/都度オーソリなし)" },
  { value: "11", label: "11: 登録型 (都度オーソリあり)" },
];

export const CORP_INDIV_OPTIONS: Array<{ value: CorpIndiv; label: string }> = [
  { value: "1", label: "法人 (法人番号有)" },
  { value: "2", label: "法人 (法人番号無)" },
  { value: "3", label: "個人" },
];

export const COLUMN_COUNT = COLUMN_HEADERS.length;
