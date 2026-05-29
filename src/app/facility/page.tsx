/** /facility は /facility/dashboard へリダイレクト（Phase 0 モックアップ廃止） */
import { redirect } from "next/navigation";

export default function FacilityIndex() {
  redirect("/facility/dashboard");
}
