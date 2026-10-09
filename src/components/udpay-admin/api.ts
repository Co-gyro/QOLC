import type { ApiResponse } from "@/types/api";

/** UD Payment 管理 API を呼ぶ（失敗時はメッセージ付きで throw） */
export async function udpayAdminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) throw new Error(json.error);
  return json.data;
}
