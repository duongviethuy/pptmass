"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Library,
  Loader2,
  Lock,
  Music2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { deleteSong } from "@/app/songs/actions";
import type { Song, SongPartKind } from "@/lib/pptmass-types";
import { cn } from "@/lib/utils";

export type SongWithLabels = Song & {
  createdAtLabel: string;
  updatedAtLabel: string;
};

type ScopeFilter = "all" | "mine" | "public" | "private";

const CATEGORY_FILTERS = ["Tất cả", "Nhập lễ", "Đáp ca", "Alleluia", "Dâng lễ", "Hiệp lễ", "Kết lễ", "Chầu Thánh Thể"];

const PART_BADGE_CLASS: Record<SongPartKind, string> = {
  verse: "bg-sky-100 text-sky-700",
  chorus: "bg-rose-100 text-rose-700",
  bridge: "bg-amber-100 text-amber-700",
};

export default function SongLibrary({
  songs,
  currentUserId,
  tableMissing,
}: {
  songs: SongWithLabels[];
  currentUserId?: string;
  tableMissing?: boolean;
}) {
  const [songList, setSongList] = useState<SongWithLabels[]>(songs);
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("Tất cả");
  const [query, setQuery] = useState("");
  const [selectedSongId, setSelectedSongId] = useState<string | null>(songs[0]?.id ?? null);

  // Modal xóa bài hát (hỗ trợ 2 lựa chọn khi có PDF: tải về rồi mới xóa hoặc xóa luôn PDF)
  const [deleteTarget, setDeleteTarget] = useState<SongWithLabels | null>(null);
  const [deleteAction, setDeleteAction] = useState<"idle" | "downloading" | "deleting">("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Chỉ giữ những bài do người dùng hiện tại thêm HOẶC có trạng thái công khai.
  const accessibleSongs = useMemo(
    () =>
      songList.filter((song) => {
        const isMine = Boolean(currentUserId && song.createdBy === currentUserId);
        const isPublic = song.isPublic !== false;
        return isMine || isPublic;
      }),
    [songList, currentUserId],
  );

  const counts = useMemo(() => {
    let mine = 0;
    let pub = 0;
    let priv = 0;
    for (const song of accessibleSongs) {
      const isMine = Boolean(currentUserId && song.createdBy === currentUserId);
      const isPublic = song.isPublic !== false;
      if (isMine) mine += 1;
      if (isPublic) pub += 1;
      if (isMine && !isPublic) priv += 1;
    }
    return { all: accessibleSongs.length, mine, public: pub, private: priv };
  }, [accessibleSongs, currentUserId]);

  const filteredSongs = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi-VN");

    return accessibleSongs.filter((song) => {
      const isMine = Boolean(currentUserId && song.createdBy === currentUserId);
      const isPublic = song.isPublic !== false;

      if (scope === "mine" && !isMine) return false;
      if (scope === "public" && !isPublic) return false;
      if (scope === "private" && !(isMine && !isPublic)) return false;

      if (categoryFilter !== "Tất cả" && !(song.categories ?? []).includes(categoryFilter)) {
        return false;
      }

      if (!keyword) return true;

      const haystack = [
        song.title,
        song.author ?? "",
        song.notes ?? "",
        song.createdByName ?? "",
        ...(song.categories ?? []),
        ...(song.topics ?? []),
        ...song.parts.map((part) => part.lyrics),
      ]
        .join(" ")
        .toLocaleLowerCase("vi-VN");

      return haystack.includes(keyword);
    });
  }, [accessibleSongs, currentUserId, scope, categoryFilter, query]);

  const selectedSong = useMemo(
    () => filteredSongs.find((song) => song.id === selectedSongId) ?? filteredSongs[0] ?? null,
    [filteredSongs, selectedSongId],
  );

  const selectedParts = selectedSong?.parts ?? [];
  const isSelectedSongMine = Boolean(selectedSong && currentUserId && selectedSong.createdBy === currentUserId);

  async function executeDelete(song: SongWithLabels, downloadFirst: boolean) {
    if (deleteAction !== "idle") return;
    setDeleteError(null);

    if (downloadFirst && song.pdfUrl) {
      setDeleteAction("downloading");
      try {
        const response = await fetch(`/api/download-song-pdf?id=${encodeURIComponent(song.id)}`);
        if (!response.ok) {
          const errJson = (await response.json().catch(() => null)) as { error?: string } | null;
          setDeleteError(errJson?.error ?? "Không thể tải tệp PDF về máy. Bài hát chưa bị xóa.");
          setDeleteAction("idle");
          return;
        }

        const disposition = response.headers.get("Content-Disposition") ?? "";
        const fileNameMatch = /filename="([^"]+)"/.exec(disposition);
        const fileName = fileNameMatch?.[1] ?? `${song.title}.pdf`;

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
      } catch {
        setDeleteError("Lỗi kết nối khi tải tệp PDF về máy. Bài hát chưa bị xóa.");
        setDeleteAction("idle");
        return;
      }
    }

    setDeleteAction("deleting");
    try {
      const result = await deleteSong(song.id);
      if (result.status === "deleted") {
        setSongList((prev) => prev.filter((item) => item.id !== song.id));
        if (selectedSongId === song.id) {
          setSelectedSongId(null);
        }
        setDeleteTarget(null);
        setNotice(
          downloadFirst && song.pdfUrl
            ? `Đã tải tệp PDF về máy và xóa bài hát "${song.title}" cùng tệp PDF trên Bunny Storage.`
            : result.pdfDeleted
              ? `Đã xóa bài hát "${song.title}" và tệp PDF đã lưu trên Bunny Storage.`
              : `Đã xóa bài hát "${song.title}".`,
        );
      } else {
        setDeleteError(result.message);
      }
    } finally {
      setDeleteAction("idle");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-7 lg:px-8 lg:py-9">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-violet-700">
            <ArrowLeft className="size-3.5" /> Quay lại trang chủ
          </Link>
          <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900">
            <span className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Library className="size-5" />
            </span>
            Thư viện bài hát
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Hiển thị các bài hát do bạn đã thêm và các bài hát có trạng thái công khai.
          </p>
        </div>

        <Link
          href="/songs/new"
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700"
        >
          <Plus className="size-4" /> Tạo bài hát mới
        </Link>
      </div>

      {notice && (
        <div role="status" className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            {notice}
          </span>
          <button type="button" onClick={() => setNotice(null)} className="font-bold text-emerald-700 hover:underline">
            Đóng
          </button>
        </div>
      )}

      {tableMissing && (
        <div role="alert" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="text-xs leading-5">
              <p className="text-sm font-bold text-amber-900">Bảng `songs` trên Supabase chưa được tạo hoặc chưa cập nhật</p>
              <p className="mt-1 text-amber-800">
                Hãy mở Supabase Dashboard → SQL Editor và chạy nội dung file `supabase/schema.sql` để tạo bảng và cột `is_public`.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bộ lọc tìm kiếm, trạng thái và phân loại */}
      <div className="mb-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div
            role="tablist"
            aria-label="Lọc theo quyền hiển thị"
            className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1 sm:rounded-full"
          >
            {(
              [
                { id: "all", label: `Tất cả (${counts.all})` },
                { id: "mine", label: `Của tôi (${counts.mine})` },
                { id: "public", label: `Công khai (${counts.public})` },
                { id: "private", label: `Riêng tư (${counts.private})` },
              ] as const
            ).map((tab) => {
              const active = scope === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setScope(tab.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                    active ? "bg-white text-violet-700 shadow-xs" : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3.5 top-2.5 size-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm tên bài, tác giả, lời hát..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pr-3.5 pl-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-3 focus:ring-violet-100"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
          {CATEGORY_FILTERS.map((category) => {
            const active = categoryFilter === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setCategoryFilter(category)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition",
                  active
                    ? "border-violet-500 bg-violet-600 text-white shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700",
                )}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      {filteredSongs.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Music2 className="size-6" />
          </span>
          <p className="mt-4 text-base font-bold text-slate-800">Không tìm thấy bài hát nào</p>
          <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
            {accessibleSongs.length === 0
              ? "Thư viện hiện chưa có bài hát nào. Hãy bấm \"Tạo bài hát mới\" để thêm bài hát đầu tiên lên Supabase."
              : "Không có bài hát nào khớp với bộ lọc hiện tại. Hãy thử đổi từ khóa hoặc chọn lại bộ lọc."}
          </p>
          <Link
            href="/songs/new"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700"
          >
            <Plus className="size-4" /> Tạo bài hát mới
          </Link>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
          <div className="space-y-3">
            {filteredSongs.map((song) => {
              const selected = selectedSong?.id === song.id;
              const isMine = Boolean(currentUserId && song.createdBy === currentUserId);
              const isPublic = song.isPublic !== false;
              const categories = song.categories ?? [];
              const topics = song.topics ?? [];

              return (
                <button
                  key={song.id}
                  type="button"
                  onClick={() => setSelectedSongId(song.id)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition",
                    selected
                      ? "border-violet-400 bg-violet-50/50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-violet-200 hover:bg-slate-50/40",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-bold text-slate-900">{song.title}</h2>
                        {isMine && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                            <UserCheck className="size-3" /> Của bạn
                          </span>
                        )}
                        {song.pdfUrl && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                            <FileText className="size-3" /> PDF
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {song.author ? `Tác giả: ${song.author}` : "Chưa rõ tác giả"} · {song.parts.length} phần lời
                      </p>
                    </div>

                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                        isPublic ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700",
                      )}
                    >
                      {isPublic ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
                      {isPublic ? "Công khai" : "Riêng tư"}
                    </span>
                  </div>

                  {(categories.length > 0 || topics.length > 0) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {categories.map((cat) => (
                        <span key={`c-${cat}`} className="rounded-full bg-violet-100/80 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">
                          {cat}
                        </span>
                      ))}
                      {topics.map((top) => (
                        <span key={`t-${top}`} className="rounded-full bg-amber-100/80 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                          {top}
                        </span>
                      ))}
                    </div>
                  )}

                  {song.notes && <p className="mt-2.5 text-xs italic text-slate-500">Ghi chú: {song.notes}</p>}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">
                    <span>Thêm bởi: <strong className="font-semibold text-slate-600">{song.createdByName || "Không rõ"}</strong></span>
                    <span>Tạo: {song.createdAtLabel} · Sửa cuối: {song.updatedAtLabel}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Khung xem chi tiết, tờ nhạc PDF & lời bài hát đang chọn */}
          {selectedSong && (
            <aside className="space-y-4 lg:sticky lg:top-24">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 whitespace-nowrap text-sm font-bold text-slate-900">
                    <Eye className="size-4 shrink-0 text-violet-600" />
                    <span>Chi tiết bài hát</span>
                  </h3>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      title={selectedSong.isPublic !== false ? "Bài hát công khai" : "Bài hát riêng tư"}
                      aria-label={selectedSong.isPublic !== false ? "Công khai" : "Riêng tư"}
                      className={cn(
                        "inline-flex size-7 items-center justify-center rounded-full",
                        selectedSong.isPublic !== false ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {selectedSong.isPublic !== false ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
                    </span>
                    {isSelectedSongMine && (
                      <>
                        <Link
                          href={`/songs/${selectedSong.id}/edit`}
                          title="Chỉnh sửa bài hát này"
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-[11px] font-bold text-violet-700 transition hover:bg-violet-50"
                        >
                          <Pencil className="size-3.5" /> Sửa
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteTarget(selectedSong);
                          }}
                          title="Xóa bài hát này"
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-600 transition hover:bg-rose-50"
                        >
                          <Trash2 className="size-3.5" /> Xóa
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mb-3 border-b border-slate-100 pb-3">
                  <h4 className="text-base font-bold text-slate-900">{selectedSong.title}</h4>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {selectedSong.author ? `Tác giả: ${selectedSong.author}` : "Chưa rõ tác giả"} · {selectedParts.length} phần lời
                  </p>
                </div>

                {selectedSong.pdfUrl && (
                  <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700">
                        <FileText className="size-3.5 shrink-0" /> Tờ nhạc PDF
                      </span>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={selectedSong.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <ExternalLink className="size-3" /> Mở lớn
                        </a>
                        <a
                          href={`/api/download-song-pdf?id=${encodeURIComponent(selectedSong.id)}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-100"
                        >
                          <Download className="size-3" /> Tải về
                        </a>
                      </div>
                    </div>
                    <iframe
                      key={selectedSong.pdfUrl}
                      src={`${selectedSong.pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                      title={`Tờ nhạc PDF - ${selectedSong.title}`}
                      className="h-[460px] w-full bg-slate-100"
                    />
                  </div>
                )}

                <div
                  className={cn(
                    "space-y-2 overflow-y-auto pr-1",
                    selectedSong.pdfUrl ? "max-h-72 border-t border-slate-100 pt-3" : "max-h-[520px]",
                  )}
                >
                  {selectedParts.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-6 text-center text-xs text-slate-400">
                      Bài hát này chưa có phần lời.
                    </p>
                  ) : (
                    selectedParts.map((part) => (
                      <div
                        key={part.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5"
                      >
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold",
                            PART_BADGE_CLASS[part.kind] ?? "bg-slate-100 text-slate-700",
                          )}
                        >
                          {part.label}
                        </span>
                        <p className="mt-1.5 whitespace-pre-line text-xs leading-5 text-slate-700">{part.lyrics}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      )}
      {/* Modal xác nhận xóa bài hát (khi có PDF: cho chọn Tải PDF về rồi xóa HOẶC Xóa luôn PDF) */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận xóa bài hát"
          onClick={(event) => {
            if (event.target === event.currentTarget && deleteAction === "idle") {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                  <Trash2 className="size-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Xóa bài hát</h2>
                  <p className="mt-0.5 text-xs text-slate-500">&ldquo;{deleteTarget.title}&rdquo;</p>
                </div>
              </div>
              <button
                type="button"
                disabled={deleteAction !== "idle"}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                aria-label="Đóng"
                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3.5 p-5">
              {deleteTarget.pdfUrl ? (
                <>
                  <p className="text-xs leading-5 text-slate-600">
                    Bài hát này đang đính kèm một <strong>tệp tờ nhạc PDF</strong> lưu trên Bunny Storage. Bạn muốn xử lý tệp PDF như thế nào trước khi xóa?
                  </p>

                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={deleteAction !== "idle"}
                      onClick={() => void executeDelete(deleteTarget, true)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-3 text-left transition hover:border-violet-400 hover:bg-violet-50 disabled:opacity-60"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
                        {deleteAction === "downloading" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Download className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900">
                          {deleteAction === "downloading" ? "Đang tải PDF về máy..." : "Tải PDF về máy rồi mới xóa"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Lưu bản sao tờ nhạc PDF về máy trước, sau đó xóa bài hát và tệp trên server.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={deleteAction !== "idle"}
                      onClick={() => void executeDelete(deleteTarget, false)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3 text-left transition hover:border-rose-400 hover:bg-rose-50 disabled:opacity-60"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white">
                        {deleteAction === "deleting" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-rose-900">
                          {deleteAction === "deleting" ? "Đang xóa bài hát & PDF..." : "Xóa luôn bài hát và tệp PDF"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-rose-700/80">
                          Xóa vĩnh viễn bài hát khỏi thư viện và dọn luôn tệp PDF trên Bunny Storage.
                        </p>
                      </div>
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-xs leading-5 text-slate-600">
                  Bạn có chắc chắn muốn xóa vĩnh viễn bài hát <strong>{deleteTarget.title}</strong> khỏi thư viện không? Hành động này không thể hoàn tác.
                </p>
              )}

              {deleteError && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
              <button
                type="button"
                disabled={deleteAction !== "idle"}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Hủy
              </button>
              {!deleteTarget.pdfUrl && (
                <button
                  type="button"
                  disabled={deleteAction !== "idle"}
                  onClick={() => void executeDelete(deleteTarget, false)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-60"
                >
                  {deleteAction === "deleting" ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  {deleteAction === "deleting" ? "Đang xóa..." : "Xóa bài hát"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
