import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

import {
  RECURRING_RULE_SEEDS,
  WORKFLOW_TEMPLATE_SEEDS,
} from "@/lib/workflow/seeds";
import { validateTemplateSteps } from "@/lib/workflow/utils";
import type { WorkflowTemplateStep } from "@/lib/workflow/types";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/030_create_workflow_engine.sql"
);

describe("ワークフローテンプレートシードの整合", () => {
  it("テンプレは4種（精算2・加盟店申請・日次確認）", () => {
    expect(WORKFLOW_TEMPLATE_SEEDS.map((t) => t.code)).toEqual([
      "monthly_settlement_15",
      "monthly_settlement_eom",
      "merchant_application",
      "daily_ops_check",
    ]);
  });

  it("code は一意", () => {
    const codes = WORKFLOW_TEMPLATE_SEEDS.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it.each(WORKFLOW_TEMPLATE_SEEDS.map((t) => [t.code, t.steps] as const))(
    "%s: steps が検証を通過する（seq連番・title/guide必須・URLとラベル対）",
    (_code, steps) => {
      expect(validateTemplateSteps(steps)).toEqual([]);
    }
  );

  it("月次精算はどちらも8工程", () => {
    for (const code of ["monthly_settlement_15", "monthly_settlement_eom"]) {
      const t = WORKFLOW_TEMPLATE_SEEDS.find((s) => s.code === code);
      expect(t?.steps).toHaveLength(8);
    }
  });

  it("加盟店申請は13工程・日次確認は3工程", () => {
    expect(
      WORKFLOW_TEMPLATE_SEEDS.find((s) => s.code === "merchant_application")?.steps
    ).toHaveLength(13);
    expect(
      WORKFLOW_TEMPLATE_SEEDS.find((s) => s.code === "daily_ops_check")?.steps
    ).toHaveLength(3);
  });

  it("guide はマニュアル代わりになる具体性（完了条件を必ず含む）", () => {
    for (const t of WORKFLOW_TEMPLATE_SEEDS) {
      for (const s of t.steps) {
        expect(s.guide, `${t.code} seq=${s.seq}`).toContain("完了条件");
        expect(s.guide.length, `${t.code} seq=${s.seq} のguideが短すぎる`).toBeGreaterThan(50);
      }
    }
  });
});

describe("定期起票ルールシードの整合", () => {
  it("ルールは3件で、参照するテンプレコードが存在する", () => {
    expect(RECURRING_RULE_SEEDS).toHaveLength(3);
    const templateCodes = new Set(WORKFLOW_TEMPLATE_SEEDS.map((t) => t.code));
    for (const r of RECURRING_RULE_SEEDS) {
      expect(templateCodes.has(r.template_code), r.code).toBe(true);
    }
  });

  it("monthly は day_of_month 必須・daily は null", () => {
    for (const r of RECURRING_RULE_SEEDS) {
      if (r.cadence === "monthly") {
        expect(r.day_of_month).toBeGreaterThanOrEqual(1);
        expect(r.day_of_month).toBeLessThanOrEqual(31);
      } else {
        expect(r.day_of_month).toBeNull();
      }
    }
  });

  it("起票日: 15日締め=毎月20日 / 末日締め=毎月5日 / 日次=daily", () => {
    const byCode = new Map(RECURRING_RULE_SEEDS.map((r) => [r.code, r]));
    expect(byCode.get("settlement_15_monthly")?.day_of_month).toBe(20);
    expect(byCode.get("settlement_eom_monthly")?.day_of_month).toBe(5);
    expect(byCode.get("daily_ops_daily")?.cadence).toBe("daily");
  });
});

describe("migration 030 とシード定義の一致", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  it("$json$ ブロックがテンプレ数と同数あり、steps が完全一致する", () => {
    const blocks = Array.from(sql.matchAll(/\$json\$([\s\S]*?)\$json\$/g)).map(
      (m) => m[1]
    );
    expect(blocks).toHaveLength(WORKFLOW_TEMPLATE_SEEDS.length);
    blocks.forEach((raw, i) => {
      const parsed = JSON.parse(raw) as WorkflowTemplateStep[];
      expect(parsed, WORKFLOW_TEMPLATE_SEEDS[i].code).toEqual(
        WORKFLOW_TEMPLATE_SEEDS[i].steps
      );
    });
  });

  it("テンプレの code / name / description / category が SQL に含まれる", () => {
    for (const t of WORKFLOW_TEMPLATE_SEEDS) {
      expect(sql).toContain(`'${t.code}'`);
      expect(sql).toContain(`'${t.name.replaceAll("'", "''")}'`);
      expect(sql).toContain(`'${t.description.replaceAll("'", "''")}'`);
      expect(sql).toContain(`'${t.category}'`);
    }
  });

  it("定期起票ルールの INSERT が SQL に含まれる", () => {
    for (const r of RECURRING_RULE_SEEDS) {
      const day = r.day_of_month === null ? "NULL" : String(r.day_of_month);
      expect(sql).toContain(
        `VALUES ('${r.code}', '${r.name}', '${r.template_code}', '${r.cadence}', ${day}, '${r.title_pattern}', ${r.enabled})`
      );
    }
  });
});
