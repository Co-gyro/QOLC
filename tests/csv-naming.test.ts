import { describe, it, expect } from "vitest";

import {
  buildCsvFilename,
  formatClosingDate,
  isValidClosingDate,
  isValidPayeeNumber,
  isoToSlashed,
  yyyymmddToSlashed,
} from "@/lib/csv/naming";

describe("buildCsvFilename", () => {
  it("builds JCB UR filename from ISO date", () => {
    expect(
      buildCsvFilename({
        issuer: "JCB",
        dataType: "UR",
        closingDate: "2026-03-15",
        payeeNumber: "156742401",
      }),
    ).toBe("JCB_UR_20260315_156742401.csv");
  });

  it("covers all JCB data types", () => {
    for (const dataType of ["UR", "FI", "FM"] as const) {
      expect(
        buildCsvFilename({
          issuer: "JCB",
          dataType,
          closingDate: "2026-03-15",
          payeeNumber: "156742401",
        }),
      ).toBe(`JCB_${dataType}_20260315_156742401.csv`);
    }
  });

  it("covers all SAISON data types", () => {
    for (const dataType of ["UR", "FI", "FM"] as const) {
      expect(
        buildCsvFilename({
          issuer: "SAISON",
          dataType,
          closingDate: "2026-03-31",
          payeeNumber: "156742401",
        }),
      ).toBe(`SAISON_${dataType}_20260331_156742401.csv`);
    }
  });

  it("accepts already-YYYYMMDD closingDate as-is", () => {
    expect(
      buildCsvFilename({
        issuer: "SAISON",
        dataType: "FM",
        closingDate: "20260315",
        payeeNumber: "156742401",
      }),
    ).toBe("SAISON_FM_20260315_156742401.csv");
  });
});

describe("formatClosingDate", () => {
  it("removes hyphens from ISO date", () => {
    expect(formatClosingDate("2026-03-15")).toBe("20260315");
  });
  it("passes through YYYYMMDD", () => {
    expect(formatClosingDate("20260315")).toBe("20260315");
  });
});

describe("isValidPayeeNumber", () => {
  it("accepts exactly 9 digits", () => {
    expect(isValidPayeeNumber("156742401")).toBe(true);
  });
  it.each([
    ["8 digits", "12345678"],
    ["10 digits", "1234567890"],
    ["letters", "12345678a"],
    ["empty", ""],
    ["with hyphens", "156-74-2401"],
  ])("rejects %s", (_label, value) => {
    expect(isValidPayeeNumber(value)).toBe(false);
  });
});

describe("isValidClosingDate", () => {
  it("accepts YYYY-MM-DD", () => {
    expect(isValidClosingDate("2026-03-15")).toBe(true);
  });
  it.each([
    ["YYYYMMDD", "20260315"],
    ["YYYY/MM/DD", "2026/03/15"],
    ["single-digit month", "2026-3-15"],
  ])("rejects %s", (_label, value) => {
    expect(isValidClosingDate(value)).toBe(false);
  });
});

describe("yyyymmddToSlashed", () => {
  it("formats 8-digit date", () => {
    expect(yyyymmddToSlashed("20260315")).toBe("2026/03/15");
  });
  it("passes through non-matching input", () => {
    expect(yyyymmddToSlashed("2026-03-15")).toBe("2026-03-15");
  });
});

describe("isoToSlashed", () => {
  it("converts ISO to slashed", () => {
    expect(isoToSlashed("2026-03-15")).toBe("2026/03/15");
  });
});
