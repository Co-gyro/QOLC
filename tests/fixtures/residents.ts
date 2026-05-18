export interface ResidentFixture {
  id: string;
  facility_id: string;
  name_last: string;
  name_first: string;
  insurance_number: string;
}

export const RESIDENT_TANAKA: ResidentFixture = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
  facility_id: "ffffffff-ffff-ffff-ffff-fffffffffff1",
  name_last: "田中",
  name_first: "太郎",
  insurance_number: "0000001234",
};

export const RESIDENT_SUZUKI: ResidentFixture = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
  facility_id: "ffffffff-ffff-ffff-ffff-fffffffffff1",
  name_last: "鈴木",
  name_first: "花子",
  insurance_number: "0000005678",
};

export const RESIDENT_SATO: ResidentFixture = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
  facility_id: "ffffffff-ffff-ffff-ffff-fffffffffff2",
  name_last: "佐藤",
  name_first: "次郎",
  insurance_number: "0000009999",
};

export const RESIDENTS = [RESIDENT_TANAKA, RESIDENT_SUZUKI, RESIDENT_SATO];
