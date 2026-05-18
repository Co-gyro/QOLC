import { describe, it, expect } from "vitest";
import {
  matchInsuranceNumber,
  getActiveFacilityIdsForMerchant,
} from "../../src/lib/upload/matcher";
import type { SupabaseClient } from "@supabase/supabase-js";

/** チェーン可能な簡易モックビルダー */
function buildClient(handlers: {
  residents?: (filters: { ins: string; facilityIds: string[] }) => unknown[];
  relations?: (filters: { merchantId: string }) => Array<{ facility_id: string }>;
}): SupabaseClient {
  return {
    from(table: string) {
      if (table === "residents") {
        const state = { ins: "", facilityIds: [] as string[] };
        const chain = {
          select: () => chain,
          eq: (col: string, v: string) => {
            if (col === "insurance_number") state.ins = v;
            return chain;
          },
          in: (col: string, v: string[]) => {
            if (col === "facility_id") state.facilityIds = v;
            return chain;
          },
          is: () => chain,
          then: (resolve: (r: { data: unknown[]; error: null }) => void) => {
            const result = handlers.residents?.(state) ?? [];
            resolve({ data: result, error: null });
          },
        };
        return chain;
      }
      if (table === "facility_merchant_relations") {
        const state = { merchantId: "" };
        const chain = {
          select: () => chain,
          eq: (col: string, v: string) => {
            if (col === "merchant_id") state.merchantId = v;
            return chain;
          },
          then: (resolve: (r: { data: Array<{ facility_id: string }>; error: null }) => void) => {
            const result = handlers.relations?.(state) ?? [];
            resolve({ data: result, error: null });
          },
        };
        return chain;
      }
      throw new Error(`unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;
}

describe("matchInsuranceNumber", () => {
  it("施設ID空配列なら unmatched", async () => {
    const c = buildClient({});
    const r = await matchInsuranceNumber(c, {
      insuranceNumber: "0000000001",
      facilityIds: [],
    });
    expect(r.status).toBe("unmatched");
  });

  it("該当なしで unmatched", async () => {
    const c = buildClient({ residents: () => [] });
    const r = await matchInsuranceNumber(c, {
      insuranceNumber: "0000000001",
      facilityIds: ["f1", "f2"],
    });
    expect(r.status).toBe("unmatched");
  });

  it("1件ヒットで matched", async () => {
    const c = buildClient({
      residents: () => [{ id: "r1", facility_id: "f1" }],
    });
    const r = await matchInsuranceNumber(c, {
      insuranceNumber: "0000000001",
      facilityIds: ["f1", "f2", "f3"],
    });
    expect(r.status).toBe("matched");
    expect(r.residentId).toBe("r1");
    expect(r.facilityId).toBe("f1");
  });

  it("複数ヒットで ambiguous", async () => {
    const c = buildClient({
      residents: () => [
        { id: "r1", facility_id: "f1" },
        { id: "r2", facility_id: "f2" },
      ],
    });
    const r = await matchInsuranceNumber(c, {
      insuranceNumber: "0000000001",
      facilityIds: ["f1", "f2"],
    });
    expect(r.status).toBe("ambiguous");
  });
});

describe("getActiveFacilityIdsForMerchant", () => {
  it("active な施設のIDを配列で返す", async () => {
    const c = buildClient({
      relations: () => [{ facility_id: "f1" }, { facility_id: "f2" }],
    });
    const ids = await getActiveFacilityIdsForMerchant(c, "m1");
    expect(ids).toEqual(["f1", "f2"]);
  });
});
