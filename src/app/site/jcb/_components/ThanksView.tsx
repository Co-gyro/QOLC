"use client";

import { useState } from "react";
import type { JSX } from "react";

/** コールバック希望の時間帯候補 */
const TIME_SLOTS = [
  "9:00〜10:00",
  "10:00〜11:00",
  "11:00〜12:00",
  "13:00〜14:00",
  "14:00〜15:00",
  "15:00〜16:00",
] as const;

/** コールバック希望日候補 */
const CALLBACK_DATES = [
  "7月16日（水）",
  "7月17日（木）",
  "7月18日（金）",
  "7月22日（火）",
  "7月23日（水）",
] as const;

/**
 * 送信完了（thanks）表示。ワイヤーフレーム page-thanks 相当。
 * @param onBackToTop トップページ（LP）へ戻る操作
 */
export default function ThanksView({
  onBackToTop,
}: {
  onBackToTop: () => void;
}): JSX.Element {
  const [slot, setSlot] = useState<string>("13:00〜14:00");

  return (
    <div className="thanks-page">
      <section className="thanks-hero">
        <div className="thanks-hero-bg" />
        <div className="thanks-hero-content">
          <div className="thanks-icon">&#10003;</div>
          <h1>ご相談を受け付けました</h1>
          <p>お送りいただきありがとうございます</p>
        </div>
      </section>

      <div className="form-progress">
        <div className="prog-step done">
          <div className="prog-num">1</div> LP
        </div>
        <span className="prog-arrow">&rarr;</span>
        <div className="prog-step done">
          <div className="prog-num">2</div> フォーム
        </div>
        <span className="prog-arrow">&rarr;</span>
        <div className="prog-step active">
          <div className="prog-num">3</div> 完了
        </div>
      </div>

      <div className="thanks-content">
        <div className="card">
          <p className="receipt-label">受付番号</p>
          <p className="receipt-number">20260715-0042</p>
          <div className="receipt-info">
            受付日時：2026年7月15日 14:32
            <br />
            お名前：山田 太郎 様
            <br />
            ご連絡先：090-****-5678
          </div>
        </div>

        {/* Callback */}
        <div className="card">
          <h3>コールバックのご予約</h3>
          <p className="card-sub">
            ご希望の日時がございましたらお選びください（任意）
          </p>
          <div className="form-group">
            <label className="form-label">ご希望日</label>
            <select className="form-select" defaultValue="">
              <option value="" disabled>
                日付を選択
              </option>
              {CALLBACK_DATES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="form-label">ご希望時間帯</label>
            <div className="time-slots">
              {TIME_SLOTS.map((t) => (
                <button
                  type="button"
                  key={t}
                  className={`time-slot${slot === t ? " selected" : ""}`}
                  onClick={() => setSlot(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {/* TODO: 予約確定APIに接続 */}
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginTop: 16, width: "100%", justifyContent: "center" }}
          >
            予約を確定する
          </button>
        </div>

        {/* Next Steps */}
        <div className="note-card">
          <h4>今後のながれ</h4>
          <ul>
            <li>2営業日以内に、担当コンシェルジュよりお電話いたします</li>
            <li>お電話では、お困りごとを詳しくお伺いします（約15〜20分）</li>
            <li>
              ヒアリング内容をもとに、最適なサービスやプランをご提案します
            </li>
          </ul>
        </div>

        <div className="tel-card">
          <p className="tel-label">お急ぎの方はこちら</p>
          <p className="tel-num">03-6281-8882</p>
          <p className="tel-hours">受付時間: 平日 9:00〜18:00</p>
        </div>

        <button
          type="button"
          className="btn btn-outline"
          style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
          onClick={onBackToTop}
        >
          トップページに戻る
        </button>
      </div>
    </div>
  );
}
