"use client";

import type { JSX } from "react";

/** 都道府県セレクトの選択肢（ワイヤーの代表例） */
const PREFS = ["東京都", "神奈川県", "千葉県", "埼玉県", "..."] as const;

/**
 * 「ご自身のこと」選択時に表示するご本人情報フィールド群。
 */
export function SelfFields(): JSX.Element {
  return (
    <div className="form-section">
      <h3 className="form-section-title">ご本人の情報</h3>

      <div className="form-group">
        <label className="form-label">
          お名前 <span className="req">必須</span>
        </label>
        <div className="form-inline">
          <input type="text" className="form-input" placeholder="姓" />
          <input type="text" className="form-input" placeholder="名" />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">
          ご年齢 <span className="req">必須</span>
        </label>
        <select className="form-select" defaultValue="">
          <option value="" disabled>
            選択してください
          </option>
          <option>60歳未満</option>
          <option>60〜64歳</option>
          <option>65〜69歳</option>
          <option>70〜74歳</option>
          <option>75〜79歳</option>
          <option>80歳以上</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">
          お電話番号 <span className="req">必須</span>
        </label>
        <input type="tel" className="form-input" placeholder="090-1234-5678" />
      </div>

      <div className="form-group">
        <label className="form-label">
          メールアドレス <span className="opt">任意</span>
        </label>
        <input type="email" className="form-input" placeholder="example@email.com" />
      </div>

      <div className="form-group">
        <label className="form-label">
          お住まいの地域 <span className="req">必須</span>
        </label>
        <select className="form-select" defaultValue="">
          <option value="" disabled>
            都道府県を選択
          </option>
          {PREFS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">
          現在のお住まいの状況 <span className="opt">任意</span>
        </label>
        <div className="radio-col">
          {["一人暮らし", "ご夫婦でお住まい", "ご家族と同居", "その他"].map(
            (v) => (
              <label className="form-radio" key={v}>
                <input type="radio" name="self-living" /> {v}
              </label>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 「ご家族のこと」選択時に表示するご相談者情報＋対象家族フィールド群。
 */
export function FamilyFields(): JSX.Element {
  return (
    <>
      <div className="form-section">
        <h3 className="form-section-title">ご相談者（あなた）の情報</h3>

        <div className="form-group">
          <label className="form-label">
            お名前 <span className="req">必須</span>
          </label>
          <div className="form-inline">
            <input type="text" className="form-input" placeholder="姓" />
            <input type="text" className="form-input" placeholder="名" />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            ご年代 <span className="req">必須</span>
          </label>
          <select className="form-select" defaultValue="">
            <option value="" disabled>
              選択してください
            </option>
            <option>30代以下</option>
            <option>40代</option>
            <option>50代</option>
            <option>60代</option>
            <option>70代以上</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">
            お電話番号 <span className="req">必須</span>
          </label>
          <input type="tel" className="form-input" placeholder="090-1234-5678" />
        </div>

        <div className="form-group">
          <label className="form-label">
            メールアドレス <span className="opt">任意</span>
          </label>
          <input
            type="email"
            className="form-input"
            placeholder="example@email.com"
          />
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">対象のご家族について</h3>

        <div className="form-group">
          <label className="form-label">
            ご関係 <span className="req">必須</span>
          </label>
          <div className="radio-wrap">
            {["父", "母", "配偶者", "その他"].map((v) => (
              <label className="form-radio" key={v}>
                <input type="radio" name="relation" /> {v}
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            対象の方のご年齢 <span className="req">必須</span>
          </label>
          <select className="form-select" defaultValue="">
            <option value="" disabled>
              選択してください
            </option>
            <option>60歳未満</option>
            <option>60〜64歳</option>
            <option>65〜69歳</option>
            <option>70〜74歳</option>
            <option>75〜79歳</option>
            <option>80〜84歳</option>
            <option>85歳以上</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">
            お住まいの地域 <span className="req">必須</span>
          </label>
          <select className="form-select" defaultValue="">
            <option value="" disabled>
              都道府県を選択
            </option>
            {PREFS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">
            現在のお住まいの状況 <span className="req">必須</span>
          </label>
          <div className="radio-col">
            {[
              "一人暮らし",
              "ご夫婦でお住まい",
              "ご家族と同居",
              "施設に入居中",
            ].map((v) => (
              <label className="form-radio" key={v}>
                <input type="radio" name="fam-living" /> {v}
              </label>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
