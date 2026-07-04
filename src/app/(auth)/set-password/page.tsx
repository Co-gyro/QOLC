/**
 * 初期パスワード設定ページ（サーバーコンポーネント）。
 *
 * 管理者が発行した招待リンク（Supabase invite）の着地先。
 * リンク検証後にURLハッシュで渡されるセッショントークンをクライアント側で
 * 取り込み、新しいパスワードを設定してロール別ホームへ遷移する。
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SetPasswordForm } from "./_components/set-password-form";

export default function SetPasswordPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--qolc-bg-soft)" }}
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center" style={{ color: "var(--qolc-primary)" }}>
            パスワードの設定
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-4" style={{ color: "var(--qolc-muted)" }}>
            QOLCへようこそ。ログインに使用するパスワードを設定してください。
            設定が完了すると、そのままご利用のポータル画面へ移動します。
          </p>
          <SetPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
