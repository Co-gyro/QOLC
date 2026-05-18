/**
 * QOLC API 共通レスポンス型
 */

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = { success: false; error: string; code?: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export type PaginatedResponse<T> = ApiResponse<{
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}>;

/**
 * API 成功レスポンスを構築するヘルパー
 */
export function apiOk<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

/**
 * API 失敗レスポンスを構築するヘルパー
 */
export function apiError(error: string, code?: string): ApiFailure {
  return { success: false, error, ...(code ? { code } : {}) };
}
