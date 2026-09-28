/** @type {import('next').NextConfig} */
const nextConfig = {
  // 領収書PDF生成(@react-pdf)で使う日本語フォントを、サーバーレス関数のバンドルに
  // 確実に含める。public/ はランタイムFSに無いことがあるため明示的に同梱する。
  outputFileTracingIncludes: {
    "/api/receipts/**": ["./public/fonts/NotoSansJP-Regular.ttf"],
    // セゾン加盟店申請（審査FMT）テンプレートをサーバーレス関数に同梱する
    "/api/admin/applications/**": ["./templates/saison-shinsa-fmt.xlsx"],
  },
  /**
   * 加盟店向け決済画面（/checkout/{session_id}）はフレーム内への埋め込みを禁止する
   * （接続仕様書 第6章）。URL に session_id を含むため、外部へは origin だけを送る。
   */
  async headers() {
    return [
      {
        source: "/checkout/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Referrer-Policy", value: "strict-origin" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
