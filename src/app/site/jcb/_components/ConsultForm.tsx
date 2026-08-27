"use client";

import { useRef, useState } from "react";
import type { JSX } from "react";
import { SelfFields, FamilyFields } from "./ConsultFormFields";
import ThanksView from "./ThanksView";
import { validateConsultPayload } from "@/lib/site/consult-validation";

/** ご相談対象（ご自身／ご家族） */
type FormType = "self" | "family";

/** お困りごと選択肢（フィルタリングの最重要ポイント） */
const CONCERNS = [
  "シニアレジデンス（住まい）を探している",
  "住み替えの時期やエリアについて相談したい",
  "住み替え後のサポート（見守り・生活支援）を知りたい",
  "まだ具体的ではないが情報を集めたい",
  "その他（下記にご記入ください）",
] as const;

/** 連絡希望時間帯 */
const CONTACT_TIMES = [
  "午前（9:00〜12:00）",
  "午後（12:00〜17:00）",
  "夕方以降（17:00〜19:00）",
  "いつでも可",
] as const;

/**
 * 無料相談フォーム。ご自身／ご家族で入力項目を動的切替。
 * 送信すると /api/applications へ送信し、同ページ内の完了表示へ切り替える。
 * @param onBackToTop 確認不要でトップ（LP）へ戻る操作（完了画面用）
 * @param onRequestBack LPへ戻る要求（入力途中なら親が破棄確認ポップアップを出す）
 * @param onDirtyChange 入力の有無を親へ通知（破棄確認の要否判定に使う）
 */
export default function ConsultForm({
  onBackToTop,
  onRequestBack,
  onDirtyChange,
}: {
  onBackToTop: () => void;
  onRequestBack: () => void;
  onDirtyChange: (dirty: boolean) => void;
}): JSX.Element {
  const [formType, setFormType] = useState<FormType>("self");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [agreed, setAgreed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * フォームDOMから入力値を name 指定で収集する（非制御フィールドを確実に取得）。
   * ラジオ/チェックは value を優先し、無ければラベル文言でフォールバック。
   * @returns 各フィールドを name キーで格納したペイロード
   */
  const collectPayload = (): Record<string, unknown> => {
    const root = containerRef.current;
    const data: Record<string, string> = {};
    if (root) {
      const fields = root.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input[name], select[name], textarea[name]");
      fields.forEach((el) => {
        const name = el.getAttribute("name");
        if (!name) return;
        if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) {
          if (!el.checked) return;
          const label = el.value || el.parentElement?.textContent?.trim() || "";
          data[name] =
            el.type === "checkbox" && data[name] ? `${data[name]}, ${label}` : label;
        } else if (el.value && el.value.trim()) {
          data[name] = el.value.trim();
        }
      });
    }
    return { formType, ...data, note };
  };

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    const payload = collectPayload();
    const validationErrors = validateConsultPayload(payload);
    if (validationErrors.length > 0) {
      setError(validationErrors.join("／"));
      return;
    }
    setSubmitting(true);
    try {
      const lastName = (payload.self_last_name as string) || (payload.fam_last_name as string) || "";
      const firstName =
        (payload.self_first_name as string) || (payload.fam_first_name as string) || "";
      const name = `${lastName} ${firstName}`.trim();
      const email = (payload.self_email as string) || (payload.fam_email as string) || "";
      const phone = (payload.self_phone as string) || (payload.fam_phone as string) || "";
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "jcb_consult",
          applicant_name: name || undefined,
          applicant_email: email || undefined,
          applicant_phone: phone || undefined,
          message: note || undefined,
          payload,
        }),
      });
      if (!res.ok) {
        setError("送信に失敗しました。時間をおいて再度お試しください。");
        return;
      }
      onDirtyChange(false);
      setSubmitted(true);
      window.scrollTo(0, 0);
    } catch {
      setError("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <ThanksView onBackToTop={onBackToTop} />;
  }

  return (
    <div className="form-page">
      <button type="button" className="form-back" onClick={onRequestBack}>
        &larr; 相談をやめてLPに戻る
      </button>

      <div className="form-progress">
        <div className="prog-step done">
          <div className="prog-num">1</div> LP
        </div>
        <span className="prog-arrow">&rarr;</span>
        <div className="prog-step active">
          <div className="prog-num">2</div> フォーム
        </div>
        <span className="prog-arrow">&rarr;</span>
        <div className="prog-step">
          <div className="prog-num">3</div> 完了
        </div>
      </div>

      <div
        className="form-container"
        ref={containerRef}
        onInput={() => onDirtyChange(true)}
        onChange={() => onDirtyChange(true)}
      >
        {/* WHO: ご自身 or ご家族（動的切り替え） */}
        <div className="form-section">
          <h3 className="form-section-title">どなたのご相談ですか？</h3>
          <div className="form-toggle-group">
            <button
              type="button"
              className={`form-toggle-btn${formType === "self" ? " active" : ""}`}
              onClick={() => setFormType("self")}
            >
              <span className="toggle-icon">👤</span>
              <span className="toggle-label">ご自身のこと</span>
            </button>
            <button
              type="button"
              className={`form-toggle-btn${formType === "family" ? " active" : ""}`}
              onClick={() => setFormType("family")}
            >
              <span className="toggle-icon">👨‍👩‍👦</span>
              <span className="toggle-label">ご家族のこと</span>
            </button>
          </div>
        </div>

        {formType === "self" ? <SelfFields /> : <FamilyFields />}

        {/* COMMON: 住み替えについて */}
        <div className="form-section">
          <h3 className="form-section-title">住み替えについて</h3>
          <div className="form-group">
            <label className="form-label">
              住み替えの検討時期 <span className="req">必須</span>
            </label>
            <div className="radio-col">
              {[
                "すぐにでも（〜3ヶ月以内）",
                "半年以内",
                "1年以内",
                "まだ先（情報収集中）",
              ].map((v) => (
                <label className="form-radio" key={v}>
                  <input type="radio" name="timing" value={v} /> {v}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">
              ご希望エリア <span className="opt">任意</span>
            </label>
            <input
              type="text"
              name="area"
              className="form-input"
              placeholder="例：東京都内、神奈川県湘南エリア"
            />
          </div>
        </div>

        {/* ご相談内容 */}
        <div className="form-section">
          <h3 className="form-section-title">ご相談内容</h3>
          <div className="form-group">
            <label className="form-label">
              お困りごと（複数選択可） <span className="req">必須</span>
            </label>
            <div className="radio-col">
              {CONCERNS.map((v) => (
                <label className="form-check" key={v}>
                  <input type="checkbox" name="concerns" value={v} /> {v}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">
              詳しい状況やご要望 <span className="opt">任意</span>
            </label>
            <textarea
              className="form-textarea"
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：母が一人暮らしをしており、そろそろ住み替えを考えています。東京都内で、なるべく静かな環境を希望しています。（500文字まで）"
            />
            <p className="char-count">{note.length} / 500文字</p>
          </div>
        </div>

        {/* ご連絡について */}
        <div className="form-section">
          <h3 className="form-section-title">ご連絡について</h3>
          <div className="form-group">
            <label className="form-label">
              ご希望の連絡方法 <span className="req">必須</span>
            </label>
            <div className="radio-col">
              {["メール", "お電話", "どちらでも可"].map((v) => (
                <label className="form-radio" key={v}>
                  <input type="radio" name="contact_method" value={v} /> {v}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">
              ご都合の良い時間帯 <span className="opt">任意</span>
            </label>
            <div className="radio-col">
              {CONTACT_TIMES.map((v) => (
                <label className="form-check" key={v}>
                  <input type="checkbox" name="contact_time" value={v} /> {v}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Privacy & Submit */}
        <div className="form-section">
          <h3 className="form-section-title">個人情報の取り扱い</h3>
          <div className="privacy-box">
            株式会社ユニバーサル・デベロップメント（以下「当社」）は、お客様からお預かりした個人情報を、以下の目的でのみ利用いたします。
            <br />
            <br />
            1. ご相談内容への回答およびサービスのご案内
            <br />
            2. 電話・メール等によるご連絡
            <br />
            3. サービス向上のための統計データの作成（個人を特定しない形式）
            <br />
            <br />
            お預かりした個人情報は、お客様の同意なく第三者に提供することはありません。
          </div>
          <label className="privacy-agree">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />{" "}
            個人情報の取り扱いに同意する
          </label>
          <button
            type="button"
            className="btn btn-gold"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => void handleSubmit()}
            disabled={submitting || !agreed}
          >
            {submitting ? "送信中..." : "この内容で送信する"}{" "}
            {!submitting && <span className="arrow">&rarr;</span>}
          </button>
          {error && (
            <p className="form-submit-note" style={{ color: "#C0392B", fontWeight: 600 }}>
              {error}
            </p>
          )}
          <p className="form-submit-note">
            送信後、担当コンシェルジュよりご連絡いたします
          </p>
        </div>
      </div>
    </div>
  );
}
