import type { Metadata } from "next";
import { Suspense } from "react";

import AppHeader from "@/components/app-header";
import PrayerManager, { type PrayerWithLabel } from "@/components/prayer-manager";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { listPrayers } from "@/lib/prayers";
import { formatDateTimeVi } from "@/lib/songs";

export const metadata: Metadata = {
  title: "Thư viện & Quản lý Kinh | Pptmass",
  description: "Quản lý danh sách các kinh thường dùng trong Thánh lễ.",
};

export default function PrayersPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <AppHeader />
      <main>
        <Suspense fallback={<PrayersSkeleton />}>
          <PrayersSection />
        </Suspense>
      </main>
    </div>
  );
}

async function PrayersSection() {
  const user = await getCurrentUser();
  const [admin, { prayers, tableMissing }] = await Promise.all([isAdminUser(user?.id), listPrayers(200)]);

  const items: PrayerWithLabel[] = prayers.map((prayer) => ({
    ...prayer,
    updatedAtLabel: formatDateTimeVi(prayer.updatedAt),
  }));

  return <PrayerManager initialPrayers={items} isAdmin={admin} currentUserId={user?.id} tableMissing={tableMissing} />;
}

function PrayersSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-7 lg:px-8 lg:py-9">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
