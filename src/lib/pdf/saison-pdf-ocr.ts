import type { SaisonPdfData, SaisonPdfExtractor } from "./saison-pdf";

// 画像ベースPDF用のOCR抽出器プレースホルダ。
// 実装候補: Tesseract.js (on-device) / Google Cloud Vision API / Amazon Textract。
// 実装時はこのファイルで extract() を実装し、saison-pdf.ts の DEFAULT_EXTRACTORS に
// ocrExtractor を追加すればテキストレイヤ失敗時に自動フォールバックします。

export const ocrExtractor: SaisonPdfExtractor = {
  name: "ocr",
  async extract(_file: File): Promise<SaisonPdfData> {
    throw new Error(
      "画像ベースPDFのOCR抽出は未実装です。現在はテキストベースPDFのみ対応。",
    );
  },
};
