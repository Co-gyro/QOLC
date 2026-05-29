/** /user は /user/home へリダイレクト（Phase 0 モックアップ廃止） */
import { redirect } from "next/navigation";

export default function UserIndex() {
  redirect("/user/home");
}
