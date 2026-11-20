import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import MassEditor from "@/components/mass-editor";
import UserMenu, { UserMenuSkeleton } from "@/components/user-menu";
import { getCurrentUser } from "@/lib/auth";
import { listPrayers } from "@/lib/prayers";
import { listSavedSections } from "@/lib/saved-sections";
import { getMySlideById, listMySlides } from "@/lib/slides";
import { listSongs } from "@/lib/songs";

export const metadata: Metadata = { title: "Soạn slide Thánh lễ | Pptmass" };

export default function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <EditorLoader searchParams={searchParams} />
    </Suspense>
  );
}

async function EditorLoader({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const requestedSlideId = typeof params.id === "string" ? params.id.trim() : "";

  const [user, { songs }, { prayers }, { sections: savedSections }, { slides: savedSlides, tableMissing: slidesTableMissing }, loadedSlide] =
    await Promise.all([
      getCurrentUser(),
      listSongs(200),
      listPrayers(200),
      listSavedSections(200),
      listMySlides(50),
      requestedSlideId ? getMySlideById(requestedSlideId) : Promise.resolve({ slide: null, tableMissing: false }),
    ]);

  const todayVi = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

  return (
    <MassEditor
      key={loadedSlide.slide?.id ?? "new-draft"}
      initialMass={loadedSlide.slide}
      initialSavedSlides={savedSlides}
      slidesTableMissing={slidesTableMissing || loadedSlide.tableMissing}
      initialSongs={songs}
      initialPrayers={prayers}
      initialSavedSections={savedSections}
      currentUser={user}
      defaultDate={todayVi}
      userMenu={
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu />
        </Suspense>
      }
    />
  );
}

function EditorSkeleton() {
  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      <div className="h-16 border-b border-slate-200 bg-white" />
      <div className="h-24 border-b border-slate-200 bg-white/80" />
      <div className="grid min-h-[calc(100vh-160px)] grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)_295px]">
        <div className="border-r border-slate-200 bg-white p-4">
          <div className="h-64 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className="p-6">
          <div className="mx-auto aspect-video max-w-[640px] animate-pulse rounded-2xl bg-white" />
        </div>
        <div className="border-l border-slate-200 bg-white p-4">
          <div className="h-80 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}
