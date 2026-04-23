import { textLayerExtractor } from "./saison-pdf-text";
// import { ocrExtractor } from "./saison-pdf-ocr"; // OCR実装時に有効化

export interface SaisonPdfData {
  merchantNo: string;
  merchantStoreNo: string;
  merchantName: string;
  closingDate: string;
  transferDate: string;
  totalAmount: number;
  totalFee: number;
  totalTransfer: number;
  rawText: string;
  extractor: ExtractorName;
}

export type ExtractorName = "text-layer" | "ocr";

export interface SaisonPdfExtractor {
  readonly name: ExtractorName;
  extract(file: File): Promise<SaisonPdfData>;
}

// 順に試行、最初に成功した抽出器の結果を返す。OCR実装後は ocrExtractor を追加する。
const DEFAULT_EXTRACTORS: readonly SaisonPdfExtractor[] = [textLayerExtractor];

export async function parseSaisonPdfFromFile(
  file: File,
  extractors: readonly SaisonPdfExtractor[] = DEFAULT_EXTRACTORS,
): Promise<SaisonPdfData> {
  const errors: Array<{ name: ExtractorName; message: string }> = [];
  for (const ex of extractors) {
    try {
      return await ex.extract(file);
    } catch (err) {
      errors.push({
        name: ex.name,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const detail = errors.map((e) => `${e.name}: ${e.message}`).join(" / ");
  throw new Error(`PDFを読み取れませんでした。${detail}`);
}
