/**
 * JCB LP で使用するインライン SVG アイコン群。
 * ワイヤーフレームの <svg> をそのまま React 要素へ移植したもの。
 */
import type { JSX } from "react";

/** クレジットカード（ヒーローのクレカ訴求バッジ用） */
export function CardIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

/** 家（シニアレジデンスのご紹介） */
export function HomeIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v9h14v-9" />
      <path d="M10 19v-5h4v5" />
    </svg>
  );
}

/** クリップボード（住み替えプランニング） */
export function ClipboardIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <path d="M9 5a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

/** ハート（アフターフォロー） */
export function HeartIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 21s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 11c0 5.5-7 10-7 10z" />
    </svg>
  );
}

/** 盾＋チェック（個人情報保護） */
export function ShieldIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/** 円＋チェック（無料） */
export function CheckCircleIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 12.5l2 2 3.5-4" />
    </svg>
  );
}

/** 人物（専任コンシェルジュ） */
export function PersonIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5S20 17 20 21" />
    </svg>
  );
}

/** カード（JCB提携） */
export function CardBadgeIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

/** 建物イラスト（提携レジデンスカード共通・イメージ図） */
export function ResidenceIllust(): JSX.Element {
  return (
    <svg className="fac-illust" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="12" y="12" width="24" height="44" rx="1.5" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.4" />
      <rect x="36" y="26" width="16" height="30" rx="1.5" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.4" />
      <g fill="rgba(255,255,255,0.72)">
        <rect x="16" y="17" width="4" height="4" rx="0.5" /><rect x="22" y="17" width="4" height="4" rx="0.5" /><rect x="28" y="17" width="4" height="4" rx="0.5" />
        <rect x="16" y="25" width="4" height="4" rx="0.5" /><rect x="22" y="25" width="4" height="4" rx="0.5" /><rect x="28" y="25" width="4" height="4" rx="0.5" />
        <rect x="16" y="33" width="4" height="4" rx="0.5" /><rect x="22" y="33" width="4" height="4" rx="0.5" /><rect x="28" y="33" width="4" height="4" rx="0.5" />
        <rect x="16" y="41" width="4" height="4" rx="0.5" /><rect x="22" y="41" width="4" height="4" rx="0.5" /><rect x="28" y="41" width="4" height="4" rx="0.5" />
        <rect x="40" y="31" width="3.5" height="3.5" rx="0.5" /><rect x="46" y="31" width="3.5" height="3.5" rx="0.5" />
        <rect x="40" y="38" width="3.5" height="3.5" rx="0.5" /><rect x="46" y="38" width="3.5" height="3.5" rx="0.5" />
        <rect x="40" y="45" width="3.5" height="3.5" rx="0.5" /><rect x="46" y="45" width="3.5" height="3.5" rx="0.5" />
      </g>
      <rect x="10" y="54" width="44" height="2.5" rx="1" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}
