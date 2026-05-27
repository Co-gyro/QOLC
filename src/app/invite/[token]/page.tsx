"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import type { ApiResponse } from "@/types/api";

interface InviteInfo {
  residentName: string;
  facilityName: string;
  accountType: "self" | "family";
  isPaymentOwner: boolean;
}

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/invite?token=${encodeURIComponent(token)}`);
        const json = (await res.json()) as ApiResponse<InviteInfo>;
        if (!json.success) setLoadError(json.error);
        else setInfo(json.data);
      } catch {
        setLoadError("招待情報の取得に失敗しました");
      }
    })();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, password, displayName }),
      });
      const json = (await res.json()) as ApiResponse<{ email: string }>;
      if (!json.success) {
        setSubmitError(json.error);
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "登録に失敗しました");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--qolc-bg-soft)" }}>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center" style={{ color: "var(--qolc-primary)" }}>
            QOLC 家族登録
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="text-base text-center" style={{ color: "#DC2626" }}>
              {loadError}
            </p>
          ) : !info ? (
            <div className="flex justify-center py-6">
              <LoadingSpinner />
            </div>
          ) : done ? (
            <div className="text-center space-y-4">
              <p className="text-base">登録が完了しました。</p>
              <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
                登録したメールアドレスとパスワードでログインできます。
              </p>
              <a
                href="/login"
                className="qolc-btn inline-block px-6 py-3 rounded text-white font-medium"
                style={{ backgroundColor: "var(--qolc-primary)", minHeight: 48 }}
              >
                ログインへ
              </a>
            </div>
          ) : (
            <>
              <div className="mb-4 p-3 rounded text-sm" style={{ backgroundColor: "var(--qolc-bg-soft)" }}>
                <p>
                  <strong>{info.facilityName}</strong> の
                  <strong>{info.residentName}</strong> さんの
                  {info.accountType === "self" ? "ご本人" : "ご家族"}アカウントを作成します。
                </p>
                {info.isPaymentOwner && (
                  <p className="mt-1" style={{ color: "var(--qolc-accent)" }}>
                    あなたが支払い担当者として登録されます（カード登録が可能になります）。
                  </p>
                )}
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="iv-name">お名前</Label>
                  <Input id="iv-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={{ minHeight: 44 }} />
                </div>
                <div>
                  <Label htmlFor="iv-email">メールアドレス</Label>
                  <Input id="iv-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ minHeight: 44 }} />
                </div>
                <div>
                  <Label htmlFor="iv-pw">パスワード（8文字以上）</Label>
                  <Input id="iv-pw" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ minHeight: 44 }} />
                </div>
                {submitError && <p className="text-sm" style={{ color: "#DC2626" }}>{submitError}</p>}
                <Button type="submit" disabled={submitting} className="w-full" style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 48 }}>
                  {submitting ? "登録中..." : "登録する"}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
