import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Node向けのpdfjs-distテキスト抽出ヘルパー。ブラウザ実装と同一のロジック
// (レイアウトY座標で行分割) だが、cMap/font の URL を絶対パスで指定する点が違う
// (pdfjs-dist v5 の NodeBinaryDataFactory は fs.readFile を使うため)。
const PDFJS_ROOT = path.dirname(
  fileURLToPath(
    new URL("../../node_modules/pdfjs-dist/package.json", import.meta.url),
  ),
);

export async function extractPdfTextInNode(filePath: string): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const buf = await readFile(filePath);
  const pdf = await getDocument({
    data: new Uint8Array(buf),
    cMapUrl: `${PDFJS_ROOT}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDFJS_ROOT}/standard_fonts/`,
  }).promise;

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
