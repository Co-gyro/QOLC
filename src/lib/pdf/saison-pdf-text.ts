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
  // 加盟店NO。全角ＮＯ・全角/半角コロンに対応。
  // ダミーPDFは "加盟店ＮＯ：<NO> P.<店舗>"、実明細は "加盟店ＮＯ：<NO> #"（P.無し）の2形式。
  const merchantMatch = text.match(/加盟店\s*ＮＯ[：:]\s*(\d+)(?:\s+P\.(\d+))?/);
  if (!merchantMatch) {
    throw new Error("加盟店NOを読み取れませんでした。");
  }
  const merchantNo = merchantMatch[1];
  // P.店舗番号が無い実明細では加盟店NOを店舗Noとして扱う（売上データCSVの加盟店店舗No.と一致）。
  const merchantStoreNo = merchantMatch[2] ?? merchantNo;

  const nameMatch = text.match(/^\s*([^\n]+?)\s*様\s*$/m);
  const merchantName = nameMatch ? nameMatch[1].trim() : "";

  // 計算期間の終了日＝締日。ダミーは "計算期間 …～YYYY年MM月DD日" の同一行、
  // 実明細はラベルと値が別行になり値行が "YYYY M D YYYY M D" 形式（年月日表記なし）。
  let closingDate = "";
  const periodInline = text.match(
    /計\s*算\s*期\s*間\s*\d{4}年\s*\d{1,2}月\s*\d{1,2}日\s*[～~]\s*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/,
  );
  if (periodInline) {
    closingDate = `${periodInline[1]}/${pad2(periodInline[2])}/${pad2(periodInline[3])}`;
  } else {
    // [^\S\r\n] = 改行を含まない空白。同一行内に収めて他行の数値と跨ってマッチしないようにする。
    const periodSplit = text.match(
      /(\d{4})[^\S\r\n]+(\d{1,2})[^\S\r\n]+(\d{1,2})[^\S\r\n]+(\d{4})[^\S\r\n]+(\d{1,2})[^\S\r\n]+(\d{1,2})/,
    );
    if (periodSplit) {
      closingDate = `${periodSplit[4]}/${pad2(periodSplit[5])}/${pad2(periodSplit[6])}`;
    }
  }
  if (!closingDate) {
    throw new Error("計算期間を読み取れませんでした。");
  }

  // お振込日。ラベル同一行（ダミー）と、値が単独行 "YYYY年M月D日"（実明細）の両対応。
  const transferMatch =
    text.match(/お\s*振\s*込\s*日\s+(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/) ??
    text.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (!transferMatch) {
    throw new Error("お振込日を読み取れませんでした。");
  }
  const transferDate = `${transferMatch[1]}/${pad2(transferMatch[2])}/${pad2(transferMatch[3])}`;

  // 売上金額Ⓐ・手数料・差引金額の合計。ダミーは "合計 Ⓐ Ⓒ 手数料 差引" の同一行、
  // 実明細は合計が数値のみ4列の独立行になる（最後の4数値行＝合計行を採用）。
  let totalAmount: number;
  let totalFee: number;
  let totalTransfer: number;
  // [^\S\r\n] で改行を跨がないようにする（"合計 4 2200" のような別行の数値と連結しない）。
  const totalsInline = text.match(
    /合[^\S\r\n]*計[^\S\r\n]+([\d,\-]+)[^\S\r\n]+([\d,\-]+)[^\S\r\n]+([\d,\-]+)[^\S\r\n]+([\d,\-]+)/,
  );
  if (totalsInline) {
    totalAmount = parseNum(totalsInline[1]);
    totalFee = parseNum(totalsInline[3]);
    totalTransfer = parseNum(totalsInline[4]);
  } else {
    const numericRows = Array.from(
      text.matchAll(/^[^\S\r\n]*([\d,]+)[^\S\r\n]+([\d,]+)[^\S\r\n]+([\d,]+)[^\S\r\n]+([\d,]+)[^\S\r\n]*$/gm),
    );
    const last = numericRows[numericRows.length - 1];
    if (!last) {
      throw new Error("合計行を読み取れませんでした。");
    }
    totalAmount = parseNum(last[1]);
    totalFee = parseNum(last[3]);
    totalTransfer = parseNum(last[4]);
  }

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
