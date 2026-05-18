export interface FacilityFixture {
  id: string;
  group_id: string | null;
  name: string;
  address: string;
  phone: string;
  mall_code: string | null;
  merchant_id: string | null;
}

export const FACILITY_A: FacilityFixture = {
  id: "ffffffff-ffff-ffff-ffff-fffffffffff1",
  group_id: null,
  name: "〇〇介護施設",
  address: "東京都千代田区1-1-1",
  phone: "03-0000-0001",
  mall_code: "A300",
  merchant_id: null,
};

export const FACILITY_B: FacilityFixture = {
  id: "ffffffff-ffff-ffff-ffff-fffffffffff2",
  group_id: null,
  name: "△△ケアホーム",
  address: "東京都中央区2-2-2",
  phone: "03-0000-0002",
  mall_code: "A301",
  merchant_id: null,
};

export const FACILITIES = [FACILITY_A, FACILITY_B];
