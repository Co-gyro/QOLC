/**
 * 申請 payload のうち、管理画面の内容編集で消してはいけないキーの保護
 *
 * 管理画面の「申請内容の編集」はフォームが持つ項目だけを組み立てて payload を
 * 全置換する。そのため、フォームに項目が無い記録（申請区分・規約同意の証跡）が
 * 編集のたびに黙って消えてしまう。これらは監査・法務上の記録なので、
 * 編集内容とは独立に必ず引き継ぐ。
 */

/**
 * 内容編集の対象外で、必ず前の値を引き継ぐキー。
 * - applyType      … 申請区分（介護施設向け / 一般）
 * - termsAgreement … 加盟店規約への同意日時と提示した規約の記録
 */
export const PRESERVED_PAYLOAD_KEYS = ["applyType", "termsAgreement"] as const;

/**
 * 編集後の payload に、保護対象キーの元の値をマージして返す。
 * 編集フォームが送ってきたキーは尊重し（空欄クリアの挙動を壊さない）、
 * 保護対象キーだけは元の値で上書きする。
 * @param prev 保存済みの payload
 * @param next 編集フォームから送られてきた payload
 */
export function mergePreservedPayload(
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...next };
  const source = prev ?? {};
  for (const key of PRESERVED_PAYLOAD_KEYS) {
    if (source[key] !== undefined) merged[key] = source[key];
    else delete merged[key];
  }
  return merged;
}
