"use client";

export default function FacilityHeader() {
  // ダミーデータ
  const facilityName = "さくら介護施設";
  const userName = "佐藤 管理者";

  return (
    <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{facilityName}</p>
          <p className="text-xs text-gray-500">{userName}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-medium">
          {userName.charAt(0)}
        </div>
      </div>
    </header>
  );
}
