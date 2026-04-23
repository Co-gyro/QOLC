import type { SaisonPdfData, SaisonPdfExtractor } from "./saison-pdf";

let pdfjsModule: typeof import("pdfjs-dist") | null = null;

// pdfjs-dist v5 は内部でwebpackバンドル済みのESM。Next.jsのwebpackで二重ラッピング
// しようとすると __webpack_require__.r が Object.defineProperty called on non-object
// で失敗する。webpackIgnore コメントで webpack の処理をバイパスし、ブラウザに
// ネイティブの import() で直接ロードさせる (public/pdfjs/ から配信)。
async function loadPdfjs() {
  if (pdfjsModule) return pdfjsModule;
  const url = "/pdfjs/pdf.min.mjs";
  const mod = (await import(/* webpackIgnore: true */ url)) as typeof import("pdfjs-dist");
  mod.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  pdfjsModule = mod;
  return pdfjsModule;
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await loadPdfjs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
  });
  const pdf = await loadingTask.promise;
  const lines: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let currentY: number | null = null;
    let buf: string[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = (item as { transform: number[] }).transform[5];
      if (currentY !== null && Math.abs(y - currentY) > 2) {
        lines.push(buf.join(" "));
        buf = [];
      }
      if (item.str) buf.push(item.str);
      currentY = y;
      if ("hasEOL" in item && item.hasEOL) {
        lines.push(buf.join(" "));
        buf = [];
        currentY = null;
      }
    }
    if (buf.length) lines.push(buf.join(" "));
  }
  return lines.join("\n");
}

function parseNum(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

function pad2(s: string): string {
  return s.padStart(2, "0");
}

export function parseSaisonPdfText(text: string): SaisonPdfData {
  const merchantMatch = text.match(/加盟店\s*ＮＯ[：:]\s*(\d+)\s+P\.(\d+)/);
  if (!merchantMatch) {
    throw new Error("加盟店NOを読み取れませんでした。");
  }
  const merchantNo = merchantMatch[1];
  const merchantStoreNo = merchantMatch[2];

  const nameMatch = text.match(/^\s*([^\n]+?)\s*様\s*$/m);
  const merchantName = nameMatch ? nameMatch[1].trim() : "";

  const periodMatch = text.match(
    /計\s*算\s*期\s*間\s*\d{4}年\s*\d{1,2}月\s*\d{1,2}日\s*[～~]\s*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/,
  );
  if (!periodMatch) {
    throw new Error("計算期間を読み取れませんでした。");
  }
  const closingDate = `${periodMatch[1]}/${pad2(periodMatch[2])}/${pad2(periodMatch[3])}`;

  const transferMatch = text.match(
    /お\s*振\s*込\s*日\s+(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/,
  );
  if (!transferMatch) {
    throw new Error("お振込日を読み取れませんでした。");
  }
  const transferDate = `${transferMatch[1]}/${pad2(transferMatch[2])}/${pad2(transferMatch[3])}`;

  const totalsMatch = text.match(
    /合\s*計\s+([\d,\-]+)\s+([\d,\-]+)\s+([\d,\-]+)\s+([\d,\-]+)/,
  );
  if (!totalsMatch) {
    throw new Error("合計行を読み取れませんでした。");
  }
  const totalAmount = parseNum(totalsMatch[1]);
  const totalFee = parseNum(totalsMatch[3]);
  const totalTransfer = parseNum(totalsMatch[4]);

  return {
    merchantNo,
    merchantStoreNo,
    merchantName,
    closingDate,
    transferDate,
    totalAmount,
    totalFee,
    totalTransfer,
    rawText: text,
    extractor: "text-layer",
  };
}

export const textLayerExtractor: SaisonPdfExtractor = {
  name: "text-layer",
  async extract(file: File): Promise<SaisonPdfData> {
    const buffer = await file.arrayBuffer();
    const text = await extractPdfText(buffer);
    if (text.trim().length === 0) {
      throw new Error(
        "テキストレイヤから文字列を抽出できませんでした（画像ベースPDFの可能性）。",
      );
    }
    try {
      return parseSaisonPdfText(text);
    } catch (err) {
      console.error(
        `[saison-pdf-text] parse failed for "${file.name}". Extracted text:\n${text}`,
      );
      throw err;
    }
  },
};
