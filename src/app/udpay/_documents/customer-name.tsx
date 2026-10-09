import { splitCustomerName } from "@/lib/udpay/documents";

/**
 * 帳票の宛名（「〇〇　御中」）。長い法人名は法人名と医院名の区切りで改行し、
 * 「御中」は最後の行に付けて単独で行頭に来ないようにする。
 */
export function CustomerName({ name }: { name: string }) {
  const lines = splitCustomerName(name);
  return (
    <>
      {lines.map((line, i) => (
        <div key={i}>
          {line}
          {i === lines.length - 1 && <span style={{ whiteSpace: "nowrap" }}>　御中</span>}
        </div>
      ))}
    </>
  );
}
