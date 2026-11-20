"use client";

import { Music2, Plus, Search, UserCheck, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { SONG_CATEGORY_FILTERS, type SongFilterScope } from "@/components/editor/section-meta";
import type { Song } from "@/lib/pptmass-types";
import { cn } from "@/lib/utils";

export function SongLibraryModal({
  songs,
  usingDemoSongs,
  currentUserId,
  readOnly,
  onSelectSong,
  onClose,
}: {
  songs: Song[];
  usingDemoSongs: boolean;
  currentUserId?: string;
  readOnly: boolean;
  onSelectSong: (song: Song) => void;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<SongFilterScope>("all");
  const [category, setCategory] = useState("Tất cả");
  const [query, setQuery] = useState("");

  const filteredSongs = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi-VN");
    return songs.filter((song) => {
      const isMine = Boolean(currentUserId && song.createdBy === currentUserId);
      const isPublic = song.isPublic !== false;
      if (scope === "mine" && !isMine) return false;
      if (scope === "public" && !isPublic) return false;

      const cats = song.categories ?? song.tags ?? [];
      if (category !== "Tất cả" && !cats.includes(category)) return false;

      if (!keyword) return true;
      const hay = [song.title, song.author ?? "", ...cats, ...(song.topics ?? [])].join(" ").toLocaleLowerCase("vi-VN");
      return hay.includes(keyword);
    });
  }, [songs, currentUserId, scope, category, query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-xs sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Thư viện bài hát"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
              <Music2 className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Chọn bài hát từ Thư viện bài hát</h2>
              <p className="text-[11px] text-slate-500">
                {usingDemoSongs ? "Đang dùng bài mẫu (chưa có bài trên Supabase)" : `${songs.length} bài hát khả dụng`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thư viện bài hát"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute top-2.5 left-3 size-3.5 text-slate-400" />
              <input
                value={query}
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-8 text-xs outline-none placeholder:text-slate-400 focus:border-violet-400"
                placeholder="Tìm tên bài, tác giả, lời..."
              />
            </div>

            <div className="inline-flex shrink-0 rounded-xl bg-slate-200/70 p-1">
              {(
                [
                  { id: "all", label: "Tất cả" },
                  { id: "mine", label: "Của tôi" },
                  { id: "public", label: "Công khai" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setScope(tab.id)}
                  className={cn(
                    "rounded-lg px-3 py-1 text-[11px] font-semibold transition",
                    scope === tab.id ? "bg-white text-violet-700 shadow-2xs" : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SONG_CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition",
                  category === cat
                    ? "border-violet-500 bg-violet-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700",
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {filteredSongs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-xs text-slate-400">
              Không có bài hát phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {filteredSongs.map((song) => {
                const isMine = Boolean(currentUserId && song.createdBy === currentUserId);
                const labels = song.categories?.length ? song.categories : song.tags;

                return (
                  <div
                    key={song.id}
                    className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 transition hover:border-violet-300 hover:bg-violet-50/30"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                      <Music2 className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-xs font-bold text-slate-900">{song.title}</span>
                        {isMine && (
                          <span title="Bài hát của bạn" className="shrink-0">
                            <UserCheck className="size-3 text-violet-600" />
                          </span>
                        )}
                      </div>
                      <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                        {labels.length > 0 ? labels.join(" · ") : `${song.parts.length} phần`}
                        {song.author ? ` · ${song.author}` : ""}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => onSelectSong(song)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus className="size-3.5" /> Thêm
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
          <Link
            href="/songs/new"
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-violet-300 bg-white px-3.5 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-50"
          >
            <Plus className="size-3.5" /> Tạo bài hát mới
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
