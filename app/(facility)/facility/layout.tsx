import FacilitySidebar from "@/components/facility/FacilitySidebar";
import FacilityHeader from "@/components/facility/FacilityHeader";

export default function FacilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <FacilitySidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <FacilityHeader />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
