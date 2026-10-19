import type { SupabaseClient } from "@supabase/supabase-js";

/** テスト用のテーブル（行の配列） */
export type FakeTables = Record<string, Record<string, unknown>[]>;

type Filter = (row: Record<string, unknown>) => boolean;

/**
 * Supabase クライアントの最小限の偽物（UD Payment の課金テスト用）。
 * select / update / insert / upsert / delete と eq・neq・lte・lt・in・is・order・maybeSingle・single に対応する。
 * update は条件に合う行だけを書き換え、select を付けると書き換えた行を返す（条件付き UPDATE の検証用）。
 */
export function fakeSupabase(tables: FakeTables): SupabaseClient {
  function builder(table: string) {
    const rows = (tables[table] ??= []);
    const filters: Filter[] = [];
    let mode: "select" | "update" | "insert" | "delete" = "select";
    let patch: Record<string, unknown> = {};
    let returning = false;
    let counting = false;
    const api = {
      select(_cols?: string, opts?: { count?: string }) {
        if (mode !== "select") returning = true;
        if (opts?.count) counting = true;
        return api;
      },
      update(v: Record<string, unknown>) {
        mode = "update";
        patch = v;
        return api;
      },
      delete() {
        mode = "delete";
        return api;
      },
      insert(v: Record<string, unknown> | Record<string, unknown>[]) {
        mode = "insert";
        for (const r of Array.isArray(v) ? v : [v]) rows.push({ id: `id-${rows.length + 1}`, ...r });
        return api;
      },
      upsert(v: Record<string, unknown>, opts: { onConflict: string }) {
        mode = "insert";
        const hit = rows.find((r) => r[opts.onConflict] === v[opts.onConflict]);
        if (hit) Object.assign(hit, v);
        else rows.push({ id: `id-${rows.length + 1}`, ...v });
        return api;
      },
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), api),
      neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), api),
      lte: (k: string, v: string) => (filters.push((r) => String(r[k]) <= v), api),
      lt: (k: string, v: string) => (filters.push((r) => String(r[k]) < v), api),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), api),
      is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), api),
      order: () => api,
      limit: () => api,
      run() {
        const hit = rows.filter((r) => filters.every((f) => f(r)));
        if (mode === "update") {
          for (const r of hit) Object.assign(r, patch, { updated_at: new Date().toISOString() });
          return { data: returning ? hit.map((r) => ({ ...r })) : null, error: null };
        }
        if (mode === "insert") return { data: null, error: null };
        if (mode === "delete") {
          for (const r of hit) rows.splice(rows.indexOf(r), 1);
          return { data: null, error: null };
        }
        return { data: hit.map((r) => ({ ...r })), error: null, count: counting ? hit.length : null };
      },
      maybeSingle: async () => {
        const r = api.run();
        return { data: (r.data as unknown[] | null)?.[0] ?? null, error: null };
      },
      single: async () => api.maybeSingle(),
      then(resolve: (v: unknown) => void) {
        resolve(api.run());
      },
    };
    return api;
  }
  return { from: (t: string) => builder(t) } as unknown as SupabaseClient;
}
