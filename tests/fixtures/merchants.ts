export interface MerchantFixture {
  id: string;
  name: string;
  name_kana: string;
  address: string;
  phone: string;
  mall_code: string;
  terminal_id: string;
}

export const MERCHANT_CLINIC: MerchantFixture = {
  id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1",
  name: "テスト診療所",
  name_kana: "テストシンリョウショ",
  address: "東京都新宿区3-3-3",
  phone: "03-0000-1111",
  mall_code: "A300",
  terminal_id: "3124620001000",
};

export const MERCHANT_PHARMACY: MerchantFixture = {
  id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2",
  name: "テスト薬局",
  name_kana: "テストヤッキョク",
  address: "東京都新宿区4-4-4",
  phone: "03-0000-1112",
  mall_code: "A301",
  terminal_id: "3124620001001",
};

export const MERCHANTS = [MERCHANT_CLINIC, MERCHANT_PHARMACY];
