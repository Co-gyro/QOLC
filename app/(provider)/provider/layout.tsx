import ProviderSidebar from "@/components/provider/ProviderSidebar";
import ProviderHeader from "@/components/provider/ProviderHeader";

export default function ProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <ProviderSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <ProviderHeader />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
