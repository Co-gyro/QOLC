"use client";

/** ブラウザの印刷ダイアログを開くボタン（領収書のPDF保存・印刷用） */
export function PrintButton() {
  return (
    <button type="button" className="up-btn" onClick={() => window.print()}>
      印刷・PDF保存
    </button>
  );
}
