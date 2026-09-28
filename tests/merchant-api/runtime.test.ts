import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { credentialSecrets } from "@/lib/merchant-api/runtime";
import { encryptSecret } from "@/lib/merchant-api/secret";
import { makeCredential } from "./helpers";

const key = randomBytes(32);

describe("credentialSecrets", () => {
  it("現行鍵のみ（旧鍵なし）", () => {
    const cred = makeCredential({ secret_enc: encryptSecret("sk_test_new", key) });
    expect(credentialSecrets(cred, new Date(), key)).toEqual(["sk_test_new"]);
  });

  it("再発行後24時間は旧鍵も有効、期限後は現行鍵のみ", () => {
    const cred = makeCredential({
      secret_enc: encryptSecret("sk_test_new", key),
      previous_secret_enc: encryptSecret("sk_test_old", key),
      previous_secret_expires_at: "2026-09-29T00:00:00Z",
    });
    expect(credentialSecrets(cred, new Date("2026-09-28T23:59:59Z"), key)).toEqual(["sk_test_new", "sk_test_old"]);
    expect(credentialSecrets(cred, new Date("2026-09-29T00:00:00Z"), key)).toEqual(["sk_test_new"]);
  });
});
