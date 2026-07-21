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
/**
 * JCB 契約コード（包括契約の締結時に JCB から付与済みの固定値。全店子申請で共通）。
 * 申請ごとに新たに取得するものではない。変更があればここを更新する。
 */
export const JCB_CONTRACT_CODE = "010003";

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

  // 住所は都道府県名から開始する必要がある（JCB審査要件）
  const addrPrefKanji = (v: string, field: keyof JcbEcApplication, label: string) => {
    if (v && !startsWithPrefectureKanji(v)) {
      issues.push({ field, level: "error", message: `${label} は都道府県名（例: 東京都）から入力してください。` });
    }
  };
  const addrPrefKana = (v: string, field: keyof JcbEcApplication, label: string) => {
    if (v && !startsWithPrefectureKana(v)) {
      issues.push({ field, level: "error", message: `${label} は都道府県名（例: ﾄｳｷﾖｳﾄ）から入力してください。` });
    }
  };
  addrPrefKanji(app.tenantAddrKanji, "tenantAddrKanji", "店舗住所（漢字）");
  addrPrefKana(app.tenantAddrKana, "tenantAddrKana", "店舗住所（カナ）");
  if (isCorporation) {
    addrPrefKanji(app.companyAddrKanji, "companyAddrKanji", "会社住所（漢字）");
    addrPrefKana(app.companyAddrKana, "companyAddrKana", "会社住所（カナ）");
  }

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
  // JCBはファイル名に空白（半角・全角スペース）を許可しないため "_" に置換する。
  const safe = (tenantName || "新規申請").replace(/[\\/:*?"<>|\s　]/g, "_").slice(0, 30);
  return `JCB_EC_申請_${safe}_${yyyy}${mm}${dd}.xlsx`;
}

export const SALES_STYLES: Array<{ value: SalesStyle; label: string }> = [
  { value: "01", label: "01: 一般 (カタログ通販等)" },
  { value: "04", label: "04: OLS (オンラインショッピング)" },
  { value: "06", label: "06: 登録型 (継続課金/都度オーソリなし)" },
  { value: "11", label: "11: 登録型 (都度オーソリあり)" },
];

/**
 * EC(非対面)で設定可能なJCB業態コード（JCB提供「Accel設定可能業態コード(EC).xlsx」全118件）。
 * ★店頭(Accel)専用コード（介護サービス60801・歯科60202・タクシー80302・調剤薬局20504等）はECでは
 *   不正値となり申請が差戻される。EC申請ではこのマスタ以外を選べないようドロップダウンを構成する。
 * QOLCのサービス提供者は直接対応コードが無いものが多いため、JCB確認の上で近い区分を選ぶ
 *   （例: 訪問診療・クリニック=60207単科病院 / 60201総合病院 / 60299医療(その他)）。
 * code=5桁業態コード（bizCatCode）, label=ドロップダウン表示名。
 */
export const BIZ_CATEGORIES: ReadonlyArray<{ code: string; label: string }> = [
  { code: "00101", label: "百貨店" },
  { code: "00199", label: "百貨店（その他）" },
  { code: "00201", label: "スーパー" },
  { code: "00299", label: "スーパー（その他）" },
  { code: "00301", label: "ショッピングセンター" },
  { code: "00399", label: "ショッピングセンター（その他）" },
  { code: "10101", label: "総合衣料" },
  { code: "10201", label: "紳士用品" },
  { code: "10301", label: "婦人用品" },
  { code: "10401", label: "子供用品" },
  { code: "10599", label: "洋装雑貨" },
  { code: "10601", label: "呉服" },
  { code: "19999", label: "物品販売業（身装用品）その他" },
  { code: "20101", label: "家具" },
  { code: "20203", label: "総合インテリア" },
  { code: "20401", label: "家電" },
  { code: "20599", label: "医薬品（その他）" },
  { code: "20601", label: "化粧品" },
  { code: "20799", label: "家庭雑貨（その他）" },
  { code: "29999", label: "物品販売業（家庭用品・その他）" },
  { code: "30101", label: "貴金属" },
  { code: "30202", label: "文具" },
  { code: "30204", label: "書籍" },
  { code: "30209", label: "新聞購読料" },
  { code: "30301", label: "スポーツ用品" },
  { code: "30501", label: "美術品" },
  { code: "30401", label: "楽器・音響" },
  { code: "30601", label: "日曜大工" },
  { code: "30701", label: "園芸" },
  { code: "30802", label: "ペット" },
  { code: "30901", label: "玩具・ホビー" },
  { code: "31004", label: "カー用品" },
  { code: "31099", label: "車両（その他）" },
  { code: "39999", label: "物品販売業（趣味・娯楽，その他）" },
  { code: "40201", label: "食品（食料品）" },
  { code: "40203", label: "酒屋" },
  { code: "40210", label: "健康食品" },
  { code: "40301", label: "郷土品（土産品）" },
  { code: "40504", label: "質屋" },
  { code: "40799", label: "印刷（その他）" },
  { code: "40800", label: "電話" },
  { code: "40899", label: "電話（その他）" },
  { code: "49999", label: "物品販売業（その他）" },
  { code: "60201", label: "総合病院" },
  { code: "60207", label: "単科病院" },
  { code: "60299", label: "医療（その他）" },
  { code: "60399", label: "学校（その他）" },
  { code: "60499", label: "各種修理（その他）" },
  { code: "60599", label: "コンサルティング（その他）" },
  { code: "60601", label: "生命保険（保険）" },
  { code: "60699", label: "保険（その他）" },
  { code: "69999", label: "サービス業（人的・その他）" },
  { code: "70206", label: "ホテル" },
  { code: "70299", label: "宿泊施設（その他）" },
  { code: "70307", label: "総合スポーツ" },
  { code: "70699", label: "結婚・葬儀（その他）" },
  { code: "79999", label: "サービス業（施設・その他）" },
  { code: "80101", label: "一般旅行業（第１種）" },
  { code: "80102", label: "国内旅行業（第２種）" },
  { code: "80104", label: "旅行代理店業（第３種）" },
  { code: "80199", label: "旅行斡旋（その他）" },
  { code: "80201", label: "エアーライン" },
  { code: "80499", label: "運輸（貨物・その他）" },
  { code: "80599", label: "レンタリース（その他）" },
  { code: "80699", label: "プレイガイド（その他）" },
  { code: "89999", label: "サービス業（その他）" },
  { code: "90101", label: "総合小売業" },
  { code: "90204", label: "各種会費" },
  { code: "90207", label: "インターネット接続サービス（プロバイダー）" },
  { code: "90211", label: "通販一般" },
  { code: "90212", label: "定期購読・頒布会" },
  { code: "90213", label: "教育" },
  { code: "90218", label: "放送サービス" },
  { code: "90219", label: "携帯・ＰＨＳ（通話料）" },
  { code: "90220", label: "双方向デジタル放送サービス" },
  { code: "90221", label: "不動産（月次不動産賃料）" },
  { code: "90224", label: "ケーブルＴＶ利用料" },
  { code: "90225", label: "ガソリンスタンド宅配" },
  { code: "90226", label: "燃料店宅配" },
  { code: "90228", label: "月極駐車場" },
  { code: "90231", label: "ＩＰ電話" },
  { code: "90233", label: "モバイルコマース" },
  { code: "90234", label: "国際クレジット通話" },
  { code: "90901", label: "企業間取引（包括）" },
  { code: "90903", label: "企業間取引（一般）" },
  { code: "90904", label: "Ｐカード専用（共通）" },
  { code: "90905", label: "Ｐカード専用（ＪＣＢ社内経費）" },
  { code: "91002", label: "地方税" },
  { code: "91099", label: "税・公的費用（その他）" },
  { code: "91101", label: "電力" },
  { code: "91102", label: "都市ガス" },
  { code: "91103", label: "その他ガス" },
  { code: "91104", label: "水道" },
  { code: "91199", label: "公共料金（その他）" },
  { code: "92005", label: "ブランド品" },
  { code: "92207", label: "パソコン関連（ハード）" },
  { code: "92208", label: "パソコン関連（ソフト）" },
  { code: "92312", label: "ＡＶソフト" },
  { code: "92313", label: "ゲーム" },
  { code: "92407", label: "デジタルコンテンツ" },
  { code: "92506", label: "証券" },
  { code: "92507", label: "情報サービス" },
  { code: "92508", label: "個人輸入代行" },
  { code: "92509", label: "ｅラーニング" },
  { code: "92702", label: "運輸（空）" },
  { code: "92703", label: "運輸（陸）" },
  { code: "92707", label: "募金" },
  { code: "92708", label: "オークション" },
  { code: "92709", label: "デジタルマネー" },
  { code: "92710", label: "金券" },
  { code: "92711", label: "運輸（海）" },
  { code: "92801", label: "ＡＳＰ" },
  { code: "92802", label: "各種年会費" },
  { code: "92803", label: "通信・ＩＳＰ系各種費用" },
  { code: "92804", label: "レンタルサーバー" },
  { code: "92901", label: "アダルト" },
  { code: "92902", label: "出会い" },
  { code: "99999", label: "その他" },
];

/** 都道府県名（漢字）。住所先頭が都道府県で始まることの検証に使う。 */
export const PREFECTURES_KANJI: readonly string[] = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県",
  "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
  "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

/** 都道府県名（半角カナ・拗音/促音は大書きに正規化済み）。カナ住所の先頭検証に使う。 */
export const PREFECTURES_KANA: readonly string[] = [
  "ﾎﾂｶｲﾄﾞｳ", "ｱｵﾓﾘｹﾝ", "ｲﾜﾃｹﾝ", "ﾐﾔｷﾞｹﾝ", "ｱｷﾀｹﾝ", "ﾔﾏｶﾞﾀｹﾝ", "ﾌｸｼﾏｹﾝ", "ｲﾊﾞﾗｷｹﾝ", "ﾄﾁｷﾞｹﾝ", "ｸﾞﾝﾏｹﾝ",
  "ｻｲﾀﾏｹﾝ", "ﾁﾊﾞｹﾝ", "ﾄｳｷﾖｳﾄ", "ｶﾅｶﾞﾜｹﾝ", "ﾆｲｶﾞﾀｹﾝ", "ﾄﾔﾏｹﾝ", "ｲｼｶﾜｹﾝ", "ﾌｸｲｹﾝ", "ﾔﾏﾅｼｹﾝ", "ﾅｶﾞﾉｹﾝ",
  "ｷﾞﾌｹﾝ", "ｼｽﾞｵｶｹﾝ", "ｱｲﾁｹﾝ", "ﾐｴｹﾝ", "ｼｶﾞｹﾝ", "ｷﾖｳﾄﾌ", "ｵｵｻｶﾌ", "ﾋﾖｳｺﾞｹﾝ", "ﾅﾗｹﾝ", "ﾜｶﾔﾏｹﾝ",
  "ﾄﾂﾄﾘｹﾝ", "ｼﾏﾈｹﾝ", "ｵｶﾔﾏｹﾝ", "ﾋﾛｼﾏｹﾝ", "ﾔﾏｸﾞﾁｹﾝ", "ﾄｸｼﾏｹﾝ", "ｶｶﾞﾜｹﾝ", "ｴﾋﾒｹﾝ", "ｺｳﾁｹﾝ", "ﾌｸｵｶｹﾝ",
  "ｻｶﾞｹﾝ", "ﾅｶﾞｻｷｹﾝ", "ｸﾏﾓﾄｹﾝ", "ｵｵｲﾀｹﾝ", "ﾐﾔｻﾞｷｹﾝ", "ｶｺﾞｼﾏｹﾝ", "ｵｷﾅﾜｹﾝ",
];

/** 半角カナの拗音・促音(ｧｨｩｪｫｬｭｮｯ)を大書き(ｱｲｳｴｵﾔﾕﾖﾂ)に正規化する（住所カナの都道府県照合用）。 */
export function normalizeHalfKana(value: string): string {
  return value
    .replace(/ｧ/g, "ｱ").replace(/ｨ/g, "ｲ").replace(/ｩ/g, "ｳ").replace(/ｪ/g, "ｴ").replace(/ｫ/g, "ｵ")
    .replace(/ｬ/g, "ﾔ").replace(/ｭ/g, "ﾕ").replace(/ｮ/g, "ﾖ").replace(/ｯ/g, "ﾂ");
}

/** 漢字住所が都道府県名で始まるか。 */
export function startsWithPrefectureKanji(addr: string): boolean {
  return PREFECTURES_KANJI.some((p) => addr.startsWith(p));
}

/** カナ住所が都道府県名（半角カナ）で始まるか（拗音/促音は正規化して照合）。 */
export function startsWithPrefectureKana(addr: string): boolean {
  const n = normalizeHalfKana(addr);
  return PREFECTURES_KANA.some((p) => n.startsWith(p));
}

export const CORP_INDIV_OPTIONS: Array<{ value: CorpIndiv; label: string }> = [
  { value: "1", label: "法人 (法人番号有)" },
  { value: "2", label: "法人 (法人番号無)" },
  { value: "3", label: "個人" },
];

export const COLUMN_COUNT = COLUMN_HEADERS.length;
