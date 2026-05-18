/**
 * 厚労省標準CSV（介護レセコン伝送用）の解析結果型定義
 *
 * 仕様: interface_kyoutu.pdf（厚労省 介護給付費単位数表）
 *
 * 文字コード: Shift-JIS (CP932)
 * 改行: CRLF
 * 区切り: カンマ
 * 値: ダブルクォート囲み
 *
 * レコード種別:
 *  type=1 コントロール（事業所番号、データ種別、処理対象年月）
 *  type=2 データ
 *    レコード種別コード:
 *      7111: 施設サマリー
 *      7131-1: 入居者基本情報（被保険者番号、氏名）
 *      7131-2: サービス明細（サービスコード6桁、回数、単位数）
 *      7131-10: 入居者サマリー（合計単位、保険給付額、利用者負担額）
 *  type=3 エンド
 */

export interface ReceiptService {
  /** サービスコード（6桁） */
  serviceCode: string;
  /** サービス名（マスタから解決） */
  serviceName: string;
  /** 回数 */
  count: number;
  /** 単位数 */
  units: number;
}

export interface ReceiptResident {
  /** 被保険者番号 */
  insuranceNumber: string;
  /** 氏名 */
  name: string;
  services: ReceiptService[];
  /** 合計単位数 */
  totalUnits: number;
  /** 費用総額 (= totalUnits × regionalUnitPrice, 端数切捨て) */
  totalAmount: number;
  /** 保険給付額 */
  insuranceCoverage: number;
  /** 利用者自己負担額 */
  selfPayAmount: number;
}

export interface ReceiptData {
  /** 事業所番号（10桁） */
  facilityNumber: string;
  /** 処理対象年月 (YYYYMM) */
  processingMonth: string;
  /** 地域単価（例: 10.21） */
  regionalUnitPrice: number;
  residents: ReceiptResident[];
}

/** パース時の警告（フェイタルではない問題） */
export interface ReceiptParseWarning {
  line: number;
  code: string;
  message: string;
}

export interface ReceiptParseResult {
  data: ReceiptData;
  warnings: ReceiptParseWarning[];
}

/** サービスコード → サービス名 のマスタ */
export interface ServiceMasterEntry {
  code: string;
  name: string;
}

export type ServiceMaster = Map<string, string>;
