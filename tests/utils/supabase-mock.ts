/**
 * Supabase クライアントのチェーン可能なモック
 *
 * 使用例:
 *   const client = createSupabaseMock({
 *     residents: { select: () => [{ id: "r1", facility_id: "f1" }] },
 *     payments: { insert: (rows) => ({ data: rows, error: null }) },
 *   });
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type MockHandler = (
  context: MockChainState
) => unknown[] | { data?: unknown; error?: unknown };

export interface MockChainState {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert" | "rpc";
  filters: Record<string, unknown>;
  inFilters: Record<string, unknown[]>;
  isNullFilters: Record<string, boolean>;
  payload?: unknown;
  selectCols?: string;
  /** rpc 呼び出しの args */
  rpcArgs?: Record<string, unknown>;
}

export interface MockSpec {
  /** テーブル名 → ハンドラ（CRUDで一括対応） */
  tables?: Record<string, MockHandler>;
  /** rpc 関数 → ハンドラ */
  rpc?: Record<string, MockHandler>;
}

/**
 * 簡易 Supabase モックを構築する。
 */
export function createSupabaseMock(spec: MockSpec = {}): SupabaseClient {
  return {
    from(table: string) {
      return makeQueryBuilder(table, spec);
    },
    rpc(fn: string, args?: Record<string, unknown>) {
      const handler = spec.rpc?.[fn];
      if (!handler) {
        return Promise.resolve({ data: null, error: null });
      }
      const state: MockChainState = {
        table: "",
        op: "rpc",
        filters: {},
        inFilters: {},
        isNullFilters: {},
        rpcArgs: args,
      };
      const result = handler(state);
      return Promise.resolve(toResult(result));
    },
  } as unknown as SupabaseClient;
}

function makeQueryBuilder(table: string, spec: MockSpec) {
  const state: MockChainState = {
    table,
    op: "select",
    filters: {},
    inFilters: {},
    isNullFilters: {},
  };
  const handler = spec.tables?.[table];

  const exec = (): { data: unknown; error: unknown } => {
    if (!handler) return { data: null, error: null };
    return toResult(handler(state));
  };

  const builder = {
    select(cols?: string) {
      state.op = state.op === "select" ? "select" : state.op;
      state.selectCols = cols;
      return builder;
    },
    insert(row: unknown) {
      state.op = "insert";
      state.payload = row;
      return builder;
    },
    update(row: unknown) {
      state.op = "update";
      state.payload = row;
      return builder;
    },
    delete() {
      state.op = "delete";
      return builder;
    },
    upsert(row: unknown) {
      state.op = "upsert";
      state.payload = row;
      return builder;
    },
    eq(col: string, val: unknown) {
      state.filters[col] = val;
      return builder;
    },
    in(col: string, vals: unknown[]) {
      state.inFilters[col] = vals;
      return builder;
    },
    is(col: string, val: unknown) {
      if (val === null) state.isNullFilters[col] = true;
      return builder;
    },
    not(col: string, _op: string, val: unknown) {
      void val;
      void col;
      return builder;
    },
    single() {
      const { data, error } = exec();
      const first = Array.isArray(data) ? (data[0] ?? null) : data;
      return Promise.resolve({ data: first, error });
    },
    maybeSingle() {
      const { data, error } = exec();
      const first = Array.isArray(data) ? (data[0] ?? null) : data;
      return Promise.resolve({ data: first, error });
    },
    then(resolve: (r: { data: unknown; error: unknown }) => void) {
      resolve(exec());
    },
  };
  return builder;
}

function toResult(
  v: unknown[] | { data?: unknown; error?: unknown }
): { data: unknown; error: unknown } {
  if (Array.isArray(v)) return { data: v, error: null };
  if (v && typeof v === "object" && ("data" in v || "error" in v)) {
    return {
      data: (v as { data?: unknown }).data ?? null,
      error: (v as { error?: unknown }).error ?? null,
    };
  }
  return { data: v ?? null, error: null };
}
