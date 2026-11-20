import type { Metadata } from "next";
import { Suspense } from "react";

import AppHeader from "@/components/app-header";
import SavedSectionStudio, { type SavedSectionWithLabel } from "@/components/saved-section-studio";
import { getCurrentUser } from "@/lib/auth";
import { listSavedSections } from "@/lib/saved-sections";
import { formatDateTimeVi, listSongs } from "@/lib/songs";

export const metadata: Metadata = {
  title: "Section đã lưu & Trình chỉnh sửa Slide | Pptmass",
  description: "Chỉnh sửa trực tiếp slide section như PowerPoint và lưu lại để dùng riêng cho các Thánh lễ.",
};

export default function SectionsPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <AppHeader />
      <main>
        <Suspense fallback={<SectionsSkeleton />}>
          <SectionsLoader />
        </Suspense>
      </main>
    </div>
  );
}

async function SectionsLoader() {
  const [user, { sections, tableMissing }, { songs }] = await Promise.all([
    getCurrentUser(),
    listSavedSections(200),
    listSongs(200),
  ]);

  const items: SavedSectionWithLabel[] = sections.map((item) => ({
    ...item,
    updatedAtLabel: formatDateTimeVi(item.updatedAt),
  }));

  return (
    <SavedSectionStudio
      initialSections={items}
      songs={songs}
      isLoggedIn={Boolean(user)}
      tableMissing={tableMissing}
    />
  );
}

function SectionsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-7 lg:px-8">
      <div className="h-9 w-72 animate-pulse rounded-xl bg-slate-200" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[310px_minmax(0,1fr)]">
        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        <div className="h-[520px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
