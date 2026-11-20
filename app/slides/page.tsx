import type { Metadata } from "next";
import { Suspense } from "react";

import AppHeader from "@/components/app-header";
import SlideManager, { type SavedSlideWithLabels } from "@/components/slide-manager";
import { getCurrentUser } from "@/lib/auth";
import { listMySlides } from "@/lib/slides";
import { formatDateTimeVi } from "@/lib/songs";

export const metadata: Metadata = {
  title: "Quản lý Slide Thánh lễ | Pptmass",
};

export default function SlidesPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <AppHeader />
      <Suspense fallback={<SlidesSkeleton />}>
        <SlidesLoader />
      </Suspense>
    </div>
  );
}

async function SlidesLoader() {
  const [user, { slides, tableMissing }] = await Promise.all([getCurrentUser(), listMySlides(200)]);

  const slidesWithLabels: SavedSlideWithLabels[] = slides.map((slide) => ({
    ...slide,
    createdAtLabel: formatDateTimeVi(slide.createdAt),
    updatedAtLabel: formatDateTimeVi(slide.updatedAt),
  }));

  return (
    <SlideManager
      initialSlides={slidesWithLabels}
      isLoggedIn={Boolean(user)}
      tableMissing={tableMissing}
    />
  );
}

function SlidesSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-7 lg:px-8 lg:py-9">
      <div className="mb-6 h-16 w-72 animate-pulse rounded-2xl bg-white" />
      <div className="mb-6 h-16 animate-pulse rounded-2xl bg-white" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((idx) => (
          <div key={idx} className="h-64 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    </div>
  );
}
