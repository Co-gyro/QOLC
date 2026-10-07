/**
 * QOLC Wallet: 記録の状態を変える共通処理。
 * 状態を条件にした UPDATE で、二重送信や状態の食い違いを防ぐ（条件に合わなければ 409）。
 */
import { NextResponse } from "next/server";
import { logActivity } from "@/lib/audit/activity-log";
import { apiOk } from "@/types/api";
import { DECLARATION_SELECT, type DeclarationRow, loadDeclaration, signedImageUrl, toDto } from "./declarations";
import { walletError, type WalletStaff } from "./auth";

/** 状態の変更の指定 */
export interface TransitionSpec {
  id: string;
  allowed: string[];
  patch: Record<string, unknown>;
  action: string;
  metadata?: Record<string, unknown>;
}

/** 自施設の記録を、許された状態のときだけ書き換えて返す */
export async function transitionDeclaration(staff: WalletStaff, spec: TransitionSpec): Promise<NextResponse> {
  const current = await loadDeclaration(staff.admin, staff.facilityId, spec.id);
  if (!current) return walletError("記録が見つかりません", "NOT_FOUND", 404).response;

  const { data, error } = await staff.admin
    .from("purchase_declarations")
    .update(spec.patch)
    .eq("id", spec.id)
    .eq("facility_id", staff.facilityId)
    .in("status", spec.allowed)
    .is("deleted_at", null)
    .select(DECLARATION_SELECT)
    .maybeSingle();
  if (error) return walletError("記録を更新できませんでした", "DB_ERROR", 500).response;
  if (!data) return walletError("この記録は、いまの状態では変更できません", "CONFLICT", 409).response;

  const row = data as unknown as DeclarationRow;
  await logActivity({
    actorId: staff.userId,
    facilityId: staff.facilityId,
    action: spec.action,
    targetType: "purchase_declaration",
    targetId: row.id,
    targetLabel: row.residents ? `${row.residents.name_last} ${row.residents.name_first}` : null,
    metadata: { from: current.status, to: row.status, ...spec.metadata },
  });
  return NextResponse.json(apiOk({ declaration: toDto(row, await signedImageUrl(staff.admin, row)) }));
}

/** 施設の有効なカード（1施設1枚の前提。無ければ null） */
export async function activeCardId(staff: WalletStaff): Promise<string | null> {
  const { data } = await staff.admin
    .from("facility_cards")
    .select("id")
    .eq("facility_id", staff.facilityId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
