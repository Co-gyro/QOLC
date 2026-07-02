"use client";

import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { FACILITIES, type Facility } from "./facilities-data";
import { ResidenceIllust } from "./icons";

/** カード幅 + gap（20px）。ドット同期のスクロール計算に使用 */
const GAP = 20;

/**
 * Fisher-Yates シャッフル（元配列を破壊しない）。序列回避のため使用。
 */
function shuffle<T>(input: readonly T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 単一の施設カード */
function FacilityCard({ f }: { f: Facility }): JSX.Element {
  return (
    <div className="fac-card">
      <div className="fac-photo" style={{ background: f.gradient }}>
        <ResidenceIllust />
        <span className="fac-badge">カード決済対応</span>
      </div>
      <div className="fac-info">
        <span className="fac-brand">{f.brand}</span>
        <h3>{f.name}</h3>
        <div className="fac-loc">{f.location}</div>
        <p className="fac-desc">{f.desc}</p>
        <div className="fac-tags">
          {f.tags.map((t) => (
            <span className="fac-tag" key={t}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 提携シニアレジデンスのカルーセル。
 * - 初期描画は DOM順（hydration不整合を避ける）。
 * - マウント後に useEffect でシャッフルし序列を回避。
 * - 横スクロール量に応じてドットを同期、ドットクリックでスクロール。
 */
export default function FacilitiesCarousel(): JSX.Element {
  const [items, setItems] = useState<readonly Facility[]>(FACILITIES);
  const [active, setActive] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  // マウント後にシャッフル（初期描画はDOM順のまま）
  useEffect(() => {
    setItems(shuffle(FACILITIES));
  }, []);

  /** スクロール位置からアクティブなドットを算出 */
  const handleScroll = (): void => {
    const el = carouselRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".fac-card");
    if (!card) return;
    const cardWidth = card.offsetWidth + GAP;
    const idx = Math.max(
      0,
      Math.min(Math.round(el.scrollLeft / cardWidth), items.length - 1),
    );
    setActive(idx);
  };

  /** ドットクリックで該当カードへスクロール */
  const scrollToIndex = (i: number): void => {
    const el = carouselRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".fac-card");
    if (!card) return;
    const cardWidth = card.offsetWidth + GAP;
    el.scrollTo({ left: i * cardWidth, behavior: "smooth" });
  };

  return (
    <div className="fac-carousel-wrap">
      <div className="fac-carousel" ref={carouselRef} onScroll={handleScroll}>
        {items.map((f) => (
          <FacilityCard f={f} key={f.id} />
        ))}
      </div>
      <div className="fac-dots">
        {items.map((f, i) => (
          <button
            type="button"
            key={f.id}
            className={`fac-dot${i === active ? " active" : ""}`}
            aria-label={`${i + 1}番目の施設へ`}
            onClick={() => scrollToIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}
