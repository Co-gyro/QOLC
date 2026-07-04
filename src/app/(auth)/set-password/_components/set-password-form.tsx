"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { parseAuthCallbackHash } from "@/lib/auth/invite-callback";
import { ROLE_HOME } from "@/lib/auth/role-home";
import type { UserRole } from "@/types";

/** ページの状態: セッション確認中 → 入力可 / リンク無効 → 完了 */
type Phase = "checking" | "ready" | "invalid";

/**
 * 初期パスワード設定フォーム（クライアント）。
 * 招待リンクのコールバック（URLハッシュのトークン or PKCEコード）から
 * セッションを確立し、パスワード設定後にロール別ホームへ遷移する。
 */
export function SetPasswordForm() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [invalidReason, setInvalidReason] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    /** 招待リンクのコールバックからセッションを確立する。 */
    async function prepareSession() {
      const supabase = createSupabaseBrowserClient();

      const parsed = parseAuthCallbackHash(window.location.hash);
      if (parsed.kind === "error") {
        setInvalidReason(parsed.message);
        setPhase("invalid");
        return;
      }
      if (parsed.kind === "tokens") {
        const { error: setErr } = await supabase.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        });
        if (!setErr) {
          window.history.replaceState(null, "", window.location.pathname);
          setPhase("ready");
          return;
        }
      }

      // PKCEコード（?code=）の場合
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (!exErr) {
          setPhase("ready");
          return;
        }
      }

      // detectSessionInUrl 等で既にセッションが確立しているケース
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setPhase("ready");
        return;
      }
      setInvalidReason(
        "リンクの有効期限が切れているか、すでに使用済みの可能性があります。管理者に再発行を依頼してください。"
      );
      setPhase("invalid");
    }
    void prepareSession();
  }, []);

  /** パスワードを保存してロール別ホームへ遷移する。 */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("パスワードは8文字以上で設定してください");
      return;
    }
    if (password !== confirm) {
      setError("確認用パスワードが一致しません");
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr || !data.user) {
        setError(upErr?.message ?? "パスワードの設定に失敗しました");
        setLoading(false);
        return;
      }
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

  if (phase === "checking") {
    return (
      <p className="text-sm text-center py-4" style={{ color: "var(--qolc-muted)" }}>
        招待リンクを確認しています…
      </p>
    );
  }

  if (phase === "invalid") {
    return (
      <div className="p-3 rounded text-sm" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
        <p className="font-bold mb-1">リンクを確認できませんでした</p>
        <p>{invalidReason}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="new-password">新しいパスワード（8文字以上）</Label>
        <Input
          id="new-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ minHeight: 44 }}
        />
      </div>
      <div>
        <Label htmlFor="confirm-password">新しいパスワード（確認用）</Label>
        <Input
          id="confirm-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
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
        {loading ? "設定中..." : "パスワードを設定してはじめる"}
      </Button>
    </form>
  );
}
