export type CardIssuer = "JCB" | "SAISON";
export type DataType = "UR" | "FI" | "FM";

export interface NamingParams {
  issuer: CardIssuer;
  dataType: DataType;
  closingDate: string;
  payeeNumber: string;
}

export function formatClosingDate(iso: string): string {
  return iso.replace(/-/g, "");
}

export function buildCsvFilename(params: NamingParams): string {
  const { issuer, dataType, closingDate, payeeNumber } = params;
  const yyyymmdd = formatClosingDate(closingDate);
  return `${issuer}_${dataType}_${yyyymmdd}_${payeeNumber}.csv`;
}

export function isValidPayeeNumber(value: string): boolean {
  return /^\d{9}$/.test(value);
}

export function isValidClosingDate(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso);
}
