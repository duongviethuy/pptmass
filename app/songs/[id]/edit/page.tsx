import { AlertCircle, ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import AppHeader from "@/components/app-header";
import SongForm from "@/components/song-form";
import { getCurrentUser } from "@/lib/auth";
import { getSongByIdForEdit } from "@/lib/songs";

export const metadata: Metadata = {
  title: "Chỉnh sửa bài hát | Pptmass",
  description: "Chỉnh sửa thông tin, lời bài hát và tờ nhạc PDF trên Pptmass.",
};

export default function EditSongPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <AppHeader />
      <main>
        <Suspense fallback={<EditSongSkeleton />}>
          <EditSongLoader params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function EditSongLoader({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  const { song, reason } = await getSongByIdForEdit(id);

  if (!song) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12 text-center">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-2xs">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <AlertCircle className="size-6" />
          </span>
          <h1 className="mt-4 text-lg font-bold text-slate-900">
            {reason === "unauthenticated"
              ? "Vui lòng đăng nhập để chỉnh sửa bài hát"
              : "Không tìm thấy bài hát hoặc bạn không có quyền sửa"}
          </h1>
          <p className="mt-1.5 text-xs leading-5 text-slate-500">
            Chỉ người tạo bài hát mới có quyền chỉnh sửa nội dung và tờ nhạc PDF của bài hát đó.
          </p>
          <div className="mt-6 flex justify-center gap-2.5">
            <Link
              href="/songs"
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-violet-700"
            >
              <ArrowLeft className="size-3.5" /> Quay lại Thư viện bài hát
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <SongForm currentUserName={user?.name} initialSong={song} />;
}

function EditSongSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-7 lg:px-8 lg:py-9">
      <div className="h-7 w-52 animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
