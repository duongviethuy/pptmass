import type { Metadata } from "next";
import { Suspense } from "react";

import AppHeader from "@/components/app-header";
import SongLibrary, { type SongWithLabels } from "@/components/song-library";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTimeVi, listSongs } from "@/lib/songs";

export const metadata: Metadata = {
  title: "Thư viện bài hát | Pptmass",
  description: "Quản lý và tra cứu các bài hát của bạn và bài hát công khai.",
};

export default function SongsPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <AppHeader />
      <main>
        <Suspense fallback={<SongLibrarySkeleton />}>
          <SongLibrarySection />
        </Suspense>
      </main>
    </div>
  );
}

async function SongLibrarySection() {
  const [user, { songs, tableMissing }] = await Promise.all([getCurrentUser(), listSongs(200)]);

  const songsWithLabels: SongWithLabels[] = songs.map((song) => ({
    ...song,
    createdAtLabel: formatDateTimeVi(song.createdAt),
    updatedAtLabel: formatDateTimeVi(song.updatedAt),
  }));

  return <SongLibrary songs={songsWithLabels} currentUserId={user?.id} tableMissing={tableMissing} />;
}

function SongLibrarySkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-7 lg:px-8 lg:py-9">
      <div className="h-8 w-52 animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-6 h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-3">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
