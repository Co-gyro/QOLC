"use client";

/**
 * UD追記フォーム系の共通テキスト入力（ラベル + 補足 + 44px 高さ）
 */

export const UD_INPUT_CLASS = "border rounded px-2 py-2 text-sm w-full bg-white";
export const UD_INPUT_STYLE = { borderColor: "var(--qolc-border)", minHeight: 44 };

export function UdTextField(props: {
  label: string;
  value: string;
  hint?: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span style={{ color: "var(--qolc-muted)" }}>{props.label}</span>
      <input
        type="text"
        className={UD_INPUT_CLASS}
        style={UD_INPUT_STYLE}
        value={props.value}
        placeholder={props.placeholder}
        maxLength={256}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.hint && (
        <span className="text-xs" style={{ color: "var(--qolc-muted)" }}>
          {props.hint}
        </span>
      )}
    </label>
  );
}
