import Link from "next/link";
import { loadView } from "@/lib/udpay/view-source";
import { udpayPaths, type UdpayMode } from "@/lib/udpay/mode";
import { NoAccess } from "./no-access";
import { UdpayHeader } from "../header";
import { EditCustomerForm } from "../customers/[id]/edit-customer-form";


/**
 * 顧客情報の編集画面（ランサイド様要望 2026-10-08）。
 * 登録内容の誤り・担当者の変更・メールアドレスの変更に対応する。カード情報は変わらない。
 */
export async function CustomerEditView({ params, mode }: { params: { id: string }; mode: UdpayMode }) {
  const view = await loadView(mode);
  if (!view.ok) return <NoAccess />;
  const { store, member } = view;
  const { base } = udpayPaths(mode);
  const customer = store.customers.find((c) => c.id === params.id);
  return (
    <div>
      <UdpayHeader memberName={member?.displayName} />
      <main className="up-container" style={{ maxWidth: 640 }}>
        <p style={{ marginBottom: 8 }}>
          <Link href={`${base}/customers`}>← 顧客管理へ戻る</Link>
        </p>
        {!customer ? (
          <p className="up-error">顧客が見つかりません。</p>
        ) : (
          <>
            <h1>顧客情報の編集</h1>
            <p className="up-lead">
              変更した宛先・担当者名は、これから送る請求メールから反映されます。決済日の変更は、これから決済確定する請求から反映されます
              （決済確定済みの請求の課金日は変わりません）。登録カードはそのままです。
            </p>
            <EditCustomerForm customerId={customer.id} initial={customer} />
          </>
        )}
      </main>
    </div>
  );
}
