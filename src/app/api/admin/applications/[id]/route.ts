/**
 * GET   /api/admin/applications/[id]  … 詳細 + 変更履歴タイムライン
 * PATCH /api/admin/applications/[id]  … 状態/優先度/担当者/期限/次アクションを更新し履歴を追記
 *
 * - admin のみ（RLS で担保。認証チェックも実施）
 * - 更新ごとに application_events を追記（actor_id=操作した admin の user.id）
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, isUuid } from "@/lib/applications/server";
import {
  toApplicationRow,
  toApplicationEvent,
  type RawApplication,
  type RawApplicationEvent,
} from "@/lib/applications/mappers";
import { apiError, apiOk } from "@/types/api";
import { ALL_STATUSES, ALL_PRIORITIES } from "@/lib/applications/labels";
import type { ApplicationDetail } from "@/lib/applications/types";

const SELECT_COLS =
  "id, source, status, priority, applicant_name, applicant_org, applicant_email, applicant_phone, message, payload, assignee_id, due_date, next_action, merchant_id, created_at, updated_at";

const patchSchema = z
  .object({
    status: z.enum(ALL_STATUSES as unknown as [string, ...string[]]).optional(),
    priority: z.enum(ALL_PRIORITIES as unknown as [string, ...string[]]).optional(),
    assignee_id: z.string().uuid().nullable().optional(),
    due_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "日付は YYYY-MM-DD 形式で入力してください")
      .nullable()
      .optional(),
    next_action: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "更新項目がありません" });

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }
  if (!isUuid(params.id)) {
    return NextResponse.json(apiError("不正なID", "BAD_REQUEST"), { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data: appData, error: appErr } = await supabase
    .from("applications")
    .select(SELECT_COLS)
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (appErr) {
    return NextResponse.json(apiError(`取得に失敗しました: ${appErr.message}`, "DB"), {
      status: 500,
    });
  }
  if (!appData) {
    return NextResponse.json(apiError("申請が見つかりません", "NOT_FOUND"), { status: 404 });
  }
  const raw = appData as unknown as RawApplication;

  const { data: evData, error: evErr } = await supabase
    .from("application_events")
    .select("id, kind, detail, actor_id, created_at")
    .eq("application_id", params.id)
    .order("created_at", { ascending: false });
  if (evErr) {
    return NextResponse.json(apiError(`履歴の取得に失敗しました: ${evErr.message}`, "DB"), {
      status: 500,
    });
  }
  const rawEvents = (evData ?? []) as unknown as RawApplicationEvent[];

  const nameOf = await buildNameResolver([
    raw.assignee_id,
    ...rawEvents.map((e) => e.actor_id),
  ]);

  const detail: ApplicationDetail = {
    ...toApplicationRow(raw, nameOf),
    payload: raw.payload,
    events: rawEvents.map((e) => toApplicationEvent(e, nameOf)),
  };
  return NextResponse.json(apiOk(detail));
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  }
  if (!isUuid(params.id)) {
    return NextResponse.json(apiError("不正なID", "BAD_REQUEST"), { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError("不正なリクエスト", "BAD_REQUEST"), { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError("入力検証エラー", "VALIDATION_ERROR"), { status: 400 });
  }
  const patch = parsed.data;

  const admin = getSupabaseAdminClient();

  // 変更前の値を取得（履歴の before/after 記録用）
  const { data: before, error: beforeErr } = await admin
    .from("applications")
    .select("status, priority, assignee_id, due_date, next_action")
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (beforeErr) {
    return NextResponse.json(apiError(`取得に失敗しました: ${beforeErr.message}`, "DB"), {
      status: 500,
    });
  }
  if (!before) {
    return NextResponse.json(apiError("申請が見つかりません", "NOT_FOUND"), { status: 404 });
  }
  const prev = before as {
    status: string;
    priority: string;
    assignee_id: string | null;
    due_date: string | null;
    next_action: string | null;
  };

  // 実際に値が変化するカラムのみ更新対象にする
  const updates: Record<string, string | null> = {};
  const events: Array<{ kind: string; detail: Record<string, unknown> }> = [];
  const norm = (v: string | null | undefined): string | null =>
    v === undefined ? null : v === "" ? null : v;

  if (patch.status !== undefined && patch.status !== prev.status) {
    updates.status = patch.status;
    events.push({ kind: "status_changed", detail: { from: prev.status, to: patch.status } });
  }
  if (patch.priority !== undefined && patch.priority !== prev.priority) {
    updates.priority = patch.priority;
    events.push({ kind: "priority_changed", detail: { from: prev.priority, to: patch.priority } });
  }
  if (patch.assignee_id !== undefined && norm(patch.assignee_id) !== prev.assignee_id) {
    updates.assignee_id = norm(patch.assignee_id);
    events.push({ kind: "assigned", detail: { from: prev.assignee_id, to: norm(patch.assignee_id) } });
  }
  if (patch.due_date !== undefined && norm(patch.due_date) !== prev.due_date) {
    updates.due_date = norm(patch.due_date);
    events.push({ kind: "due_changed", detail: { from: prev.due_date, to: norm(patch.due_date) } });
  }
  if (patch.next_action !== undefined && norm(patch.next_action) !== prev.next_action) {
    updates.next_action = norm(patch.next_action);
    events.push({ kind: "next_action", detail: { from: prev.next_action, to: norm(patch.next_action) } });
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(apiError("変更内容がありません", "NO_CHANGE"), { status: 400 });
  }

  const { error: updErr } = await admin
    .from("applications")
    .update(updates)
    .eq("id", params.id);
  if (updErr) {
    return NextResponse.json(apiError(`更新に失敗しました: ${updErr.message}`, "DB"), {
      status: 500,
    });
  }

  // 変更ごとに履歴を追記（actor_id=操作した admin）
  const { error: evErr } = await admin.from("application_events").insert(
    events.map((e) => ({
      application_id: params.id,
      actor_id: auth.user.id,
      kind: e.kind,
      detail: e.detail,
    }))
  );
  if (evErr) {
    return NextResponse.json(apiError(`履歴の記録に失敗しました: ${evErr.message}`, "DB"), {
      status: 500,
    });
  }

  return NextResponse.json(apiOk({ id: params.id, updated: Object.keys(updates) }));
}

/** actor/assignee の ID 群 → 表示名 解決関数（profiles.display_name） */
async function buildNameResolver(
  ids: Array<string | null>
): Promise<(id: string | null) => string | null> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0) return () => null;
  const admin = getSupabaseAdminClient();
  const { data } = await admin.from("profiles").select("id, display_name").in("id", unique);
  const map = new Map<string, string | null>();
  for (const p of (data ?? []) as Array<{ id: string; display_name: string | null }>) {
    map.set(p.id, p.display_name);
  }
  return (id: string | null) => (id ? map.get(id) ?? null : null);
}
