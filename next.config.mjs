/** @type {import('next').NextConfig} */
const nextConfig = {
  // 領収書PDF生成(@react-pdf)で使う日本語フォントを、サーバーレス関数のバンドルに
  // 確実に含める。public/ はランタイムFSに無いことがあるため明示的に同梱する。
  outputFileTracingIncludes: {
    "/api/receipts/**": ["./public/fonts/NotoSansJP-Regular.ttf"],
    // セゾン加盟店申請（審査FMT）テンプレートをサーバーレス関数に同梱する
    "/api/admin/applications/**": ["./templates/saison-shinsa-fmt.xlsx"],
  },
};

export default nextConfig;
