import ExcelJS from "exceljs";

import type { JcbEcApplication, ValidationIssue } from "./jcb-ec";

export type StoreSalesStyle = "01" | "03" | "07";
// 01=一般[固定店舗], 03=催事[可動式店舗], 07=自動精算機使用

export type IcSetStatus = "1" | "3";
// 1=対応している, 3=対応予定なし

// 店頭版固有の追加入力項目 (EC版 JcbEcApplication と組み合わせて使う)
export interface JcbStoreExtras {
  storeSalesStyle: StoreSalesStyle;
  icSetStatus: IcSetStatus;
  posBranchCode2: string;
  posBranchCode3: string;
  posBranchCode4: string;
  posBranchCode5: string;
  qpPosBranchCode1: string;
  qpPosBranchCode2: string;
  qpPosBranchCode3: string;
  qpPosBranchCode4: string;
  qpPosBranchCode5: string;
  transSprwid1: string;
  transSprwid2: string;
  transSprwid3: string;
  transSprwid4: string;
  transSprwid5: string;
}

export const EMPTY_STORE_EXTRAS: JcbStoreExtras = {
  storeSalesStyle: "01",
  icSetStatus: "1",
  posBranchCode2: "",
  posBranchCode3: "",
  posBranchCode4: "",
  posBranchCode5: "",
  qpPosBranchCode1: "",
  qpPosBranchCode2: "",
  qpPosBranchCode3: "",
  qpPosBranchCode4: "",
  qpPosBranchCode5: "",
  transSprwid1: "",
  transSprwid2: "",
  transSprwid3: "",
  transSprwid4: "",
  transSprwid5: "",
};

// 店頭版で固定の自動値 (EC版とは内容が一部異なる)
export const STORE_AUTO_VALUES = {
  requestType: "1",
  enterpriseCode: "0160",
  d2DSales: "0",
  teleMktgSales: "0",
  multiLvlMktg: "0",
  bizOfferInvitSales: "0",
  cardInfoRetainStatus: "2",  // 非保持
  pcidssComplStatus: "1",     // 準拠
  // EC版にあった J/Secure / Protect Buy / AMEX Safekey / 本人認証 / セキュリティコード /
  // 不正配送先 / 属性行動分析 / その他独自対策 は店頭版には存在しない
} as const;

// 店頭版の【別紙】申請データFMT 71列ヘッダー (店頭版仕様書準拠)
const STORE_COLUMN_HEADERS: readonly string[] = [
  "申請区分",                                  // 1
  "包括事業者コード",                            // 2
  "契約コード",                                 // 3
  "対象加盟店番号",                              // 4
  "法人/個人区分",                              // 5
  "会社名（漢字）",                              // 6
  "会社名（カナ）",                              // 7
  "会社郵便番号",                                // 8
  "会社住所（漢字）",                            // 9
  "会社住所（カナ）",                            // 10
  "会社電話番号",                                // 11
  "会社法人番号",                                // 12
  "代表者姓（漢字）",                            // 13
  "代表者名（漢字）",                            // 14
  "代表者姓（カナ）",                            // 15
  "代表者名（カナ）",                            // 16
  "代表者生年月日",                              // 17
  "代表者郵便番号",                              // 18
  "代表者住所（漢字）",                          // 19
  "代表者住所（カナ）",                          // 20
  "代表者電話番号",                              // 21
  "店舗名（漢字）",                              // 22
  "店舗名（カナ）",                              // 23
  "店舗名（アルファベット）",                     // 24
  "店舗郵便番号",                                // 25
  "店舗住所（漢字）",                            // 26
  "店舗住所（カナ）",                            // 27
  "店舗電話番号",                                // 28
  "URL",                                       // 29
  "業態コード",                                 // 30
  "店舗形態",                                   // 31 (EC版「販売形態区分」相当)
  "業種業務内容",                                // 32
  "取扱商材",                                   // 33
  "訪問販売有無",                                // 34
  "電話勧誘販売有無",                            // 35
  "連鎖販売取引有無",                            // 36
  "業務提供誘引販売有無",                         // 37
  "カード情報保持状況",                          // 38
  "PCIDSS準拠状況",                             // 39
  "IC端末設置状況",                              // 40 (店頭版固有)
  "クレジット/PREMO用POS支店コード(1)",          // 41
  "クレジット/PREMO用POS支店コード(2)",          // 42
  "クレジット/PREMO用POS支店コード(3)",          // 43
  "クレジット/PREMO用POS支店コード(4)",          // 44
  "クレジット/PREMO用POS支店コード(5)",          // 45
  "QUICPay/iD用POS支店コード(1)",               // 46 (店頭版固有)
  "QUICPay/iD用POS支店コード(2)",               // 47
  "QUICPay/iD用POS支店コード(3)",               // 48
  "QUICPay/iD用POS支店コード(4)",               // 49
  "QUICPay/iD用POS支店コード(5)",               // 50
  "交通系SPRWID(1)",                            // 51 (店頭版固有)
  "交通系SPRWID(2)",                            // 52
  "交通系SPRWID(3)",                            // 53
  "交通系SPRWID(4)",                            // 54
  "交通系SPRWID(5)",                            // 55
  "包括KA営業事前連携サイン",                     // 56
  "二重営業事前連携サイン",                       // 57
  "包括加盟店使用番号",                          // 58
  "加盟店管理独自コード(1)",                      // 59
  "加盟店管理独自コード(2)",                      // 60
  "備考",                                      // 61
  "予約日",                                    // 62
  "照会番号",                                   // 63
  "案件申請日",                                  // 64
  "判定結果コード",                              // 65
  "判定結果",                                   // 66
  "加盟年月日",                                 // 67
  "加盟店番号",                                 // 68
  "審査判定結果詳細理由",                         // 69
  "返却理由詳細",                                // 70
  "結果報告準備完了日",                          // 71
];

function isoBirthdayToYyyymmdd(iso: string): string {
  if (!iso) return "";
  return iso.replace(/-/g, "");
}

export function applicationToStoreRow(
  app: JcbEcApplication,
  extras: JcbStoreExtras,
): string[] {
  const isCorpWithNo = app.corpIndiv === "1";
  const isCorporation = app.corpIndiv === "1" || app.corpIndiv === "2";
  const isIndividual = app.corpIndiv === "3";

  return [
    STORE_AUTO_VALUES.requestType,                           // 1
    STORE_AUTO_VALUES.enterpriseCode,                        // 2
    app.contractCode,                                        // 3
    "",                                                      // 4 対象加盟店番号
    app.corpIndiv,                                           // 5
    isCorporation ? app.companyNameKanji : "",               // 6
    isCorporation ? app.companyNameKana : "",                // 7
    isCorporation ? app.companyPostalCode : "",              // 8
    isCorporation ? app.companyAddrKanji : "",               // 9
    isCorporation ? app.companyAddrKana : "",                // 10
    isCorporation ? app.companyTel : "",                     // 11
    isCorpWithNo ? app.corpNo : "",                          // 12
    app.repFamilyNameKanji,                                  // 13
    app.repNameKanji,                                        // 14
    app.repFamilyNameKana,                                   // 15
    app.repNameKana,                                         // 16
    isoBirthdayToYyyymmdd(app.repBirthday),                  // 17
    isIndividual ? app.repPostalCode : "",                   // 18
    isIndividual ? app.repAddrKanji : "",                    // 19
    isIndividual ? app.repAddrKana : "",                     // 20
    isIndividual ? app.repTel : "",                          // 21
    app.tenantNameKanji,                                     // 22
    app.tenantNameKana,                                      // 23
    app.tenantNameLatin,                                     // 24
    app.tenantPostalCode,                                    // 25
    app.tenantAddrKanji,                                     // 26
    app.tenantAddrKana,                                      // 27
    app.tenantTel,                                           // 28
    app.tenantURL,                                           // 29
    app.bizCatCode,                                          // 30
    extras.storeSalesStyle,                                  // 31
    app.bizOverview,                                         // 32
    app.handlingProducts,                                    // 33
    STORE_AUTO_VALUES.d2DSales,                              // 34
    STORE_AUTO_VALUES.teleMktgSales,                         // 35
    STORE_AUTO_VALUES.multiLvlMktg,                          // 36
    STORE_AUTO_VALUES.bizOfferInvitSales,                    // 37
    STORE_AUTO_VALUES.cardInfoRetainStatus,                  // 38
    STORE_AUTO_VALUES.pcidssComplStatus,                     // 39
    extras.icSetStatus,                                      // 40
    app.posBranchCode1,                                      // 41
    extras.posBranchCode2,                                   // 42
    extras.posBranchCode3,                                   // 43
    extras.posBranchCode4,                                   // 44
    extras.posBranchCode5,                                   // 45
    extras.qpPosBranchCode1,                                 // 46
    extras.qpPosBranchCode2,                                 // 47
    extras.qpPosBranchCode3,                                 // 48
    extras.qpPosBranchCode4,                                 // 49
    extras.qpPosBranchCode5,                                 // 50
    extras.transSprwid1,                                     // 51
    extras.transSprwid2,                                     // 52
    extras.transSprwid3,                                     // 53
    extras.transSprwid4,                                     // 54
    extras.transSprwid5,                                     // 55
    "",                                                      // 56 包括KA営業事前連携サイン
    "",                                                      // 57 二重営業事前連携サイン
    app.merchantUseNo,                                       // 58
    "",                                                      // 59 加盟店管理独自コード(1)
    "",                                                      // 60 加盟店管理独自コード(2)
    app.notes,                                               // 61
    "",                                                      // 62 予約日
    "",                                                      // 63 照会番号
    "",                                                      // 64 案件申請日
    "",                                                      // 65 判定結果コード
    "",                                                      // 66 判定結果
    "",                                                      // 67 加盟年月日
    "",                                                      // 68 加盟店番号
    "",                                                      // 69 審査判定結果詳細理由
    "",                                                      // 70 返却理由詳細
    "",                                                      // 71 結果報告準備完了日
  ];
}

export type StoreField = keyof JcbStoreExtras;

export function validateStoreExtras(
  extras: JcbStoreExtras,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // POS支店コード(1)はEC版/共通フィールドで検証されるためここでは扱わない。
  // (2)〜(5) は任意だが、入力された場合は13桁数字。
  const branchKeys: StoreField[] = [
    "posBranchCode2", "posBranchCode3", "posBranchCode4", "posBranchCode5",
    "qpPosBranchCode1", "qpPosBranchCode2", "qpPosBranchCode3",
    "qpPosBranchCode4", "qpPosBranchCode5",
  ];
  for (const key of branchKeys) {
    const v = extras[key];
    if (v && !/^\d{13}$/.test(v)) {
      issues.push({
        field: "general",
        level: "error",
        message: `${key} は13桁の半角数字で入力してください。`,
      });
    }
  }

  // 交通系SPRWID(1-5): 13文字英数字 (ハイフン不可)
  const sprwidKeys: StoreField[] = [
    "transSprwid1", "transSprwid2", "transSprwid3", "transSprwid4", "transSprwid5",
  ];
  for (const key of sprwidKeys) {
    const v = extras[key];
    if (v && !/^[A-Za-z0-9]{13}$/.test(v)) {
      issues.push({
        field: "general",
        level: "error",
        message: `${key} は13桁の半角英数字で入力してください (ハイフン不可)。`,
      });
    }
  }

  // POS支店コードの一意性 (クレジット系 1-5 同士)
  const credCodes = [
    /* posBranchCode1 はEC側のフィールドだがチェック対象に含めるべきは利用側の責任で渡す */
    extras.posBranchCode2, extras.posBranchCode3, extras.posBranchCode4, extras.posBranchCode5,
  ].filter((s) => s.length > 0);
  if (new Set(credCodes).size !== credCodes.length) {
    issues.push({
      field: "general",
      level: "error",
      message: "クレジット/PREMO用POS支店コード(2)〜(5)に重複があります。",
    });
  }

  const qpCodes = [
    extras.qpPosBranchCode1, extras.qpPosBranchCode2, extras.qpPosBranchCode3,
    extras.qpPosBranchCode4, extras.qpPosBranchCode5,
  ].filter((s) => s.length > 0);
  if (new Set(qpCodes).size !== qpCodes.length) {
    issues.push({
      field: "general",
      level: "error",
      message: "QUICPay/iD用POS支店コード(1)〜(5)に重複があります。",
    });
  }

  const sprwidValues = sprwidKeys.map((k) => extras[k]).filter((s) => s.length > 0);
  if (new Set(sprwidValues).size !== sprwidValues.length) {
    issues.push({
      field: "general",
      level: "error",
      message: "交通系SPRWID(1)〜(5)に重複があります。",
    });
  }

  return issues;
}

export async function generateJcbStoreExcel(
  app: JcbEcApplication,
  extras: JcbStoreExtras,
): Promise<Uint8Array<ArrayBuffer>> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "QOLC";
  wb.created = new Date();
  const ws = wb.addWorksheet("【別紙】申請データFMT");
  ws.addRow(STORE_COLUMN_HEADERS);
  ws.addRow(applicationToStoreRow(app, extras));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  ws.columns.forEach((col, i) => {
    const header = STORE_COLUMN_HEADERS[i] ?? "";
    col.width = Math.max(header.length * 2, 10);
  });

  const data = (await wb.xlsx.writeBuffer()) as ArrayBuffer | Uint8Array;
  if (data instanceof Uint8Array) {
    const buffer = new ArrayBuffer(data.byteLength);
    const view = new Uint8Array(buffer);
    view.set(data);
    return view;
  }
  return new Uint8Array(data as ArrayBuffer);
}

export function buildStoreExcelFilename(tenantName: string, date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const safe = (tenantName || "新規申請").replace(/[\\/:*?"<>|]/g, "_").slice(0, 30);
  return `JCB_店頭_申請_${safe}_${yyyy}${mm}${dd}.xlsx`;
}

export const STORE_SALES_STYLES: Array<{ value: StoreSalesStyle; label: string }> = [
  { value: "01", label: "01: 一般 (固定店舗)" },
  { value: "03", label: "03: 催事 (可動式店舗)" },
  { value: "07", label: "07: 自動精算機使用" },
];

export const IC_SET_STATUSES: Array<{ value: IcSetStatus; label: string }> = [
  { value: "1", label: "1: 対応している" },
  { value: "3", label: "3: 対応予定なし" },
];

export const STORE_COLUMN_COUNT = STORE_COLUMN_HEADERS.length;
