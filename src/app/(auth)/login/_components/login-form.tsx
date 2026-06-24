"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types";

/** ロール → ログイン後の遷移先 */
const ROLE_HOME: Record<UserRole, string> = {
  admin: "/admin/dashboard",
  facility_staff: "/facility/dashboard",
  provider: "/provider/dashboard",
  family: "/user/home",
};

/**
 * メール+パスワードのログインフォーム（クライアント）。
 * @param initialError サーバー（LINE コールバック等）から渡された初期エラーメッセージ
 */
export function LoginForm({ initialError }: { initialError?: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError || !data.user) {
        setError(signInError?.message ?? "ログインに失敗しました");
        setLoading(false);
        return;
      }

      // ロールを取得（profiles を自己参照、RLSで許可済み）
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      const role = (profile?.role as UserRole | undefined) ?? "family";

      // 全画面遷移で middleware に新しいセッションCookieを処理させる
      window.location.assign(ROLE_HOME[role]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "予期しないエラーが発生しました");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">メールアドレス</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ minHeight: 44 }}
        />
      </div>
      <div>
        <Label htmlFor="password">パスワード</Label>
        <Input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ minHeight: 44 }}
        />
      </div>
      {error && (
        <p className="text-sm" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={loading}
        className="w-full"
        style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}
      >
        {loading ? "ログイン中..." : "ログイン"}
      </Button>
    </form>
  );
}
