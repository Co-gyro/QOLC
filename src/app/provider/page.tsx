/** /provider は /provider/dashboard へリダイレクト（Phase 0 モックアップ廃止） */
import { redirect } from "next/navigation";

export default function ProviderIndex() {
  redirect("/provider/dashboard");
}
