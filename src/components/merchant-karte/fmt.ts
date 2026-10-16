/** ISO 日時を「YYYY/M/D HH:mm」（日本時間）にする。空なら「—」 */
export function jstDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** ISO 日時を「YYYY/M/D」（日本時間）にする */
export function jstDate(iso: string | null | undefined): string {
  return iso ? jstDateTime(iso).split(" ")[0] : "—";
}
