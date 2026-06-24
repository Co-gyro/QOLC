/**
 * ログインページ（サーバーコンポーネント）。
 *
 * - 家族向け: LINE ログイン（環境変数が揃っている場合のみ表示）
 * - 全ロール: メール+パスワードログイン
 * - LINE コールバック等からのエラーコード（?error=）を利用者向け文言で表示
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineLoginButton } from "@/components/shared/line-login-button";
import { isLineLoginConfigured } from "@/lib/line/config";
import { lineErrorMessage } from "@/lib/line/error-messages";
import { LoginForm } from "./_components/login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const lineEnabled = isLineLoginConfigured();
  const errorMessage = lineErrorMessage(searchParams.error);
  const next = searchParams.next;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "var(--qolc-bg-soft)" }}
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center" style={{ color: "var(--qolc-primary)" }}>
            QOLC ログイン
          </CardTitle>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <p
              className="mb-4 p-3 rounded text-sm text-center"
              style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}
            >
              {errorMessage}
            </p>
          )}

          {lineEnabled && (
            <>
              <div className="mb-2">
                <LineLoginButton label="LINEでログイン" next={next || "/user/home"} />
              </div>
              <p className="text-center text-sm mb-4" style={{ color: "var(--qolc-muted)" }}>
                ご家族の方はこちら
              </p>
              <div className="flex items-center gap-3 mb-4">
                <span className="flex-1 border-t" style={{ borderColor: "var(--qolc-border)" }} />
                <span className="text-sm" style={{ color: "var(--qolc-muted)" }}>
                  または
                </span>
                <span className="flex-1 border-t" style={{ borderColor: "var(--qolc-border)" }} />
              </div>
            </>
          )}

          <LoginForm initialError={null} />
        </CardContent>
      </Card>
    </div>
  );
}
