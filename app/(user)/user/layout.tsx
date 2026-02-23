import MobileHeader from "@/components/user/MobileHeader";
import TabBar from "@/components/user/TabBar";
import CardRegistrationModal from "@/components/user/CardRegistrationModal";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-[428px] mx-auto min-h-screen bg-white shadow-[0_0_10px_rgba(0,0,0,0.1)] flex flex-col relative">
        <MobileHeader />
        <main className="flex-1 pb-20">{children}</main>
        <TabBar />
        <CardRegistrationModal />
      </div>
    </div>
  );
}
