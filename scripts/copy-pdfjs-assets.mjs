// Copy pdfjs-dist cmaps and standard_fonts into public/pdfjs/ so Next.js
// can serve them to the browser. Needed for Japanese PDF text extraction.
// Runs on `npm install` via the "postinstall" script.

import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const pdfjsSrc = path.join(projectRoot, "node_modules", "pdfjs-dist");
const dest = path.join(projectRoot, "public", "pdfjs");

if (!existsSync(pdfjsSrc)) {
  console.log("[copy-pdfjs-assets] pdfjs-dist not installed yet, skipping.");
  process.exit(0);
}

await mkdir(dest, { recursive: true });
await cp(path.join(pdfjsSrc, "cmaps"), path.join(dest, "cmaps"), { recursive: true });
await cp(path.join(pdfjsSrc, "standard_fonts"), path.join(dest, "standard_fonts"), { recursive: true });
console.log("[copy-pdfjs-assets] Copied cmaps + standard_fonts to public/pdfjs/");
