import type { Metadata } from "next";
import { Suspense } from "react";

import AppHeader from "@/components/app-header";
import SongForm from "@/components/song-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Tạo bài hát mới | Pptmass",
  description: "Thêm bài hát mới vào thư viện Pptmass.",
};

export default function NewSongPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <AppHeader />
      <main>
        <Suspense fallback={<SongFormSkeleton />}>
          <NewSongSection />
        </Suspense>
      </main>
    </div>
  );
}

async function NewSongSection() {
  const user = await getCurrentUser();
  return <SongForm currentUserName={user?.name} />;
}

function SongFormSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-7 lg:px-8 lg:py-9">
      <div className="h-7 w-44 animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
