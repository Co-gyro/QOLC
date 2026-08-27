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
import { merchantApplyFormBaseSchema } from "@/lib/applications/schema";
import { mergePreservedPayload } from "@/lib/applications/payload-preserve";
import {
  parseUdInput,
  describeUdFieldChanges,
  validateUdInputFields,
} from "@/lib/applications/ud-input";
import type { ApplicationDetail } from "@/lib/applications/types";

const SELECT_COLS =
  "id, source, status, priority, applicant_name, applicant_org, applicant_email, applicant_phone, message, payload, assignee_id, due_date, next_action, merchant_id, created_at, updated_at";

/** ud_input（migration 031）付きの SELECT。列未適用の環境では SELECT_COLS へフォールバック */
const SELECT_COLS_WITH_UD = `${SELECT_COLS}, ud_input`;

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
    ud_input: z
      .record(z.string(), z.unknown())
      .superRefine((v, ctx) => {
        // 形式エラーの UD 追記（桁数・数値形式）は申請書生成を壊すため保存時に弾く
        const msg = validateUdInputFields(v);
        if (msg) ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
      })
      .nullable()
      .optional(),
    // 申請内容の補完・修正（手動起票案件用）。入力済み項目のみ形式検証し、
    // 段階的な入力を許容する（完全性は申請書生成時に担保）。
    payload: z
      .record(z.string(), z.unknown())
      .superRefine((v, ctx) => {
        const r = merchantApplyFormBaseSchema.partial().safeParse(v);
        if (!r.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: r.error.issues[0]?.message ?? "申請内容の形式が正しくありません",
          });
        }
      })
      .optional(),
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
  // ud_input 列（migration 031）が未適用の環境でも詳細表示を壊さないよう段階フォールバック
  const first = await supabase
    .from("applications")
    .select(SELECT_COLS_WITH_UD)
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  let appData: unknown = first.data;
  let appErr: { message: string } | null = first.error;
  if (appErr) {
    const fallback = await supabase
      .from("applications")
      .select(SELECT_COLS)
      .eq("id", params.id)
      .is("deleted_at", null)
      .maybeSingle();
    appData = fallback.data;
    appErr = fallback.error;
  }
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
    udInput: raw.ud_input ?? null,
    workflowRun: await fetchWorkflowRunSummary(params.id),
    events: rawEvents.map((e) => toApplicationEvent(e, nameOf)),
  };
  return NextResponse.json(apiOk(detail));
}

/**
 * 案件に紐づくワークフロー起票の進捗サマリを取得する。
 * workflow テーブル（migration 030）が未適用の環境では null を返し、詳細表示を壊さない。
 */
async function fetchWorkflowRunSummary(
  applicationId: string
): Promise<ApplicationDetail["workflowRun"]> {
  const admin = getSupabaseAdminClient();
  const { data: runs, error: runErr } = await admin
    .from("workflow_runs")
    .select("id, title, status")
    .eq("application_id", applicationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (runErr || !runs || runs.length === 0) return null;
  const run = runs[0] as { id: string; title: string; status: "open" | "done" | "canceled" };
  const { data: steps, error: stepErr } = await admin
    .from("workflow_run_steps")
    .select("status")
    .eq("run_id", run.id);
  if (stepErr) return null;
  const all = (steps ?? []) as Array<{ status: string }>;
  return {
    id: run.id,
    title: run.title,
    status: run.status,
    doneCount: all.filter((s) => s.status === "done").length,
    totalCount: all.length,
  };
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
    // admin 向けのため、どの項目が不正かをそのまま返す（UD追記の形式エラー等）
    const reason = parsed.error.issues[0]?.message ?? "入力検証エラー";
    return NextResponse.json(apiError(reason, "VALIDATION_ERROR"), { status: 400 });
  }
  const patch = parsed.data;

  const admin = getSupabaseAdminClient();

  // 変更前の値を取得（履歴の before/after 記録用）。
  // ud_input（migration 031）未適用の環境では ud_input を除いて取得する。
  const needsUdInput = patch.ud_input !== undefined;
  const beforeCols = "status, priority, assignee_id, due_date, next_action, payload";
  const firstBefore = await admin
    .from("applications")
    .select(`${beforeCols}, ud_input`)
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  let before: unknown = firstBefore.data;
  let beforeErr: { message: string } | null = firstBefore.error;
  if (beforeErr) {
    if (needsUdInput) {
      return NextResponse.json(
        apiError(
          "UD追記情報を保存できません（DBに ud_input 列がありません。migration 031 を適用してください）",
          "MIGRATION_REQUIRED"
        ),
        { status: 500 }
      );
    }
    const fallback = await admin
      .from("applications")
      .select(beforeCols)
      .eq("id", params.id)
      .is("deleted_at", null)
      .maybeSingle();
    before = fallback.data;
    beforeErr = fallback.error;
  }
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
    payload: Record<string, unknown> | null;
    ud_input?: Record<string, unknown> | null;
  };

  // 実際に値が変化するカラムのみ更新対象にする
  const updates: Record<string, unknown> = {};
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
  if (patch.payload !== undefined) {
    const prevPayload = prev.payload ?? {};
    // 内容編集フォームは自分が持つ項目だけで payload を組み立てて全置換するため、
    // 申請区分・規約同意の証跡が消える。保護対象キーは元の値を引き継ぐ。
    const nextPayload = mergePreservedPayload(prevPayload, patch.payload);
    if (JSON.stringify(prevPayload) !== JSON.stringify(nextPayload)) {
      updates.payload = nextPayload;
      const changed = Object.keys({ ...prevPayload, ...nextPayload }).filter(
        (k) => JSON.stringify(prevPayload[k]) !== JSON.stringify(nextPayload[k])
      );
      events.push({
        kind: "payload_updated",
        detail: { changed, before: prevPayload, after: nextPayload },
      });
    }
  }
  if (patch.ud_input !== undefined) {
    const prevUd = prev.ud_input ?? null;
    const nextUd = patch.ud_input;
    if (JSON.stringify(prevUd) !== JSON.stringify(nextUd)) {
      updates.ud_input = nextUd;
      const changed = describeUdFieldChanges(
        parseUdInput(prevUd).fields,
        parseUdInput(nextUd).fields
      );
      events.push({
        kind: "ud_input_updated",
        detail: { before: prevUd, after: nextUd, changed },
      });
    }
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
