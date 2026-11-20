"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock,
  FolderOpen,
  Layers,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Presentation,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { deleteMassSlide } from "@/app/editor/actions";
import type { SavedSlideSummary, SlideAspectRatio } from "@/lib/pptmass-types";
import { cn } from "@/lib/utils";

export type SavedSlideWithLabels = SavedSlideSummary & {
  createdAtLabel: string;
  updatedAtLabel: string;
};

type SortMode = "updated" | "title" | "date";
type RatioFilter = "all" | SlideAspectRatio;

function formatShortDateVi(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export default function SlideManager({
  initialSlides,
  isLoggedIn,
  tableMissing,
}: {
  initialSlides: SavedSlideWithLabels[];
  isLoggedIn: boolean;
  tableMissing: boolean;
}) {
  const [slides, setSlides] = useState<SavedSlideWithLabels[]>(initialSlides);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortMode>("updated");
  const [ratioFilter, setRatioFilter] = useState<RatioFilter>("all");

  const [deleteTarget, setDeleteTarget] = useState<SavedSlideWithLabels | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const filteredSlides = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi-VN");
    const matched = slides.filter((slide) => {
      if (ratioFilter !== "all" && slide.aspectRatio !== ratioFilter) return false;
      if (!keyword) return true;
      const haystack = [slide.title, slide.celebrationDate, formatShortDateVi(slide.celebrationDate)]
        .join(" ")
        .toLocaleLowerCase("vi-VN");
      return haystack.includes(keyword);
    });

    return [...matched].sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title, "vi-VN", { sensitivity: "base" });
      }
      if (sortBy === "date") {
        const da = a.celebrationDate || "";
        const db = b.celebrationDate || "";
        if (da !== db) return db.localeCompare(da);
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [slides, query, ratioFilter, sortBy]);

  async function confirmDelete(slide: SavedSlideWithLabels) {
    if (isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const result = await deleteMassSlide(slide.id);
      if (result.status === "deleted") {
        setSlides((prev) => prev.filter((item) => item.id !== slide.id));
        setDeleteTarget(null);
        setNotice(
          result.cleanedImagesCount > 0
            ? `Đã xóa bài trình chiếu "${slide.title}" và dọn sạch ${result.cleanedImagesCount} hình ảnh trên Bunny Storage.`
            : `Đã xóa bài trình chiếu "${slide.title}" và dọn thư mục ảnh trên Bunny Storage.`,
        );
      } else if (result.status === "error" || result.status === "table_missing") {
        setDeleteError(result.message);
      }
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-7 lg:px-8 lg:py-9">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-violet-700"
          >
            <ArrowLeft className="size-3.5" /> Quay lại trang chủ
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <FolderOpen className="size-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản lý Slide Thánh lễ</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
              <Lock className="size-3" /> Riêng tư cá nhân
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Lưu trữ và quản lý các bài trình chiếu theo tên Thánh lễ. Khi xóa, toàn bộ hình ảnh đính kèm trên Bunny Storage cũng sẽ được xóa sạch.
          </p>
        </div>

        <Link
          href="/editor"
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-violet-200 transition hover:bg-violet-700"
        >
          <Plus className="size-4" /> Soạn Thánh lễ mới
        </Link>
      </div>

      {notice && (
        <div
          role="status"
          className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900"
        >
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
              <p className="text-sm font-bold text-amber-900">Bảng `public.slides` chưa được tạo trên Supabase</p>
              <p className="mt-1 text-amber-800">
                Hãy mở Supabase Dashboard → SQL Editor và chạy mục 6 trong file `supabase/schema.sql` để kích hoạt quản lý slide.
              </p>
            </div>
          </div>
        </div>
      )}

      {!isLoggedIn ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-violet-50 text-violet-600">
            <Lock className="size-6" />
          </span>
          <p className="mt-4 text-base font-bold text-slate-800">Vui lòng đăng nhập để xem các slide của bạn</p>
          <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
            Mỗi bài trình chiếu được lưu riêng tư theo tài khoản của bạn trên Supabase và hình ảnh trên Bunny Storage.
          </p>
          <Link
            href="/auth/login"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700"
          >
            Đăng nhập ngay
          </Link>
        </div>
      ) : (
        <>
          {/* Thanh tìm kiếm, sắp xếp theo tên Thánh lễ / ngày / mới cập nhật & lọc tỉ lệ */}
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute top-2.5 left-3.5 size-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo tên Thánh lễ hoặc ngày..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pr-3.5 pl-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-3 focus:ring-violet-100"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                role="tablist"
                aria-label="Sắp xếp danh sách slide"
                className="inline-flex flex-wrap items-center gap-1 rounded-full border border-slate-200/80 bg-slate-100/80 p-1"
              >
                {(
                  [
                    { id: "updated", label: "Mới cập nhật" },
                    { id: "title", label: "Tên Thánh lễ (A–Z)" },
                    { id: "date", label: "Ngày cử hành" },
                  ] as const
                ).map((tab) => {
                  const active = sortBy === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSortBy(tab.id)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold transition",
                        active ? "bg-white text-violet-700 shadow-xs" : "text-slate-600 hover:text-slate-900",
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-100/80 p-1">
                {(["all", "16:9", "4:3"] as const).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => setRatioFilter(ratio)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold transition",
                      ratioFilter === ratio ? "bg-white text-violet-700 shadow-xs" : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {ratio === "all" ? "Tất cả" : ratio}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredSlides.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Presentation className="size-6" />
              </span>
              <p className="mt-4 text-base font-bold text-slate-800">
                {slides.length === 0 ? "Chưa có slide Thánh lễ nào được lưu" : "Không tìm thấy bài trình chiếu phù hợp"}
              </p>
              <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">
                {slides.length === 0
                  ? "Hãy bấm \"Soạn Thánh lễ mới\", thiết kế slide rồi nhấn \"Lưu slide\" để quản lý tại đây."
                  : "Hãy thử đổi từ khóa tên Thánh lễ hoặc bỏ bộ lọc tỉ lệ màn hình."}
              </p>
              <Link
                href="/editor"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700"
              >
                <Plus className="size-4" /> Soạn Thánh lễ mới
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSlides.map((slide) => (
                <article
                  key={slide.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs transition hover:border-violet-300 hover:shadow-md"
                >
                  <Link
                    href={`/editor?id=${encodeURIComponent(slide.id)}`}
                    className="relative block aspect-video w-full overflow-hidden border-b border-slate-100 bg-slate-100"
                  >
                    {slide.coverImageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={slide.coverImageUrl}
                        alt={slide.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,#f5f3ff,#eef2ff_55%,#f8fafc)] text-violet-400">
                        <Presentation className="size-9" />
                        <span className="text-[11px] font-semibold text-violet-500/80">Chưa có ảnh bìa</span>
                      </div>
                    )}

                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="rounded-full bg-slate-900/75 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                        {slide.aspectRatio}
                      </span>
                      <span className="rounded-full bg-violet-600/90 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                        {slide.slideCount} slide
                      </span>
                    </div>
                  </Link>

                  <div className="flex flex-1 flex-col p-4">
                    <Link
                      href={`/editor?id=${encodeURIComponent(slide.id)}`}
                      className="line-clamp-2 text-base font-bold text-slate-900 transition hover:text-violet-700"
                      title={slide.title}
                    >
                      {slide.title}
                    </Link>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {slide.celebrationDate && (
                        <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                          <CalendarDays className="size-3.5 text-violet-500" />
                          {formatShortDateVi(slide.celebrationDate)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Layers className="size-3.5 text-slate-400" />
                        {slide.sectionCount} phần
                      </span>
                    </div>

                    <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Clock className="size-3" /> Sửa cuối: {slide.updatedAtLabel}
                    </p>

                    <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                      <Link
                        href={`/editor?id=${encodeURIComponent(slide.id)}`}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-600 hover:text-white"
                      >
                        <Pencil className="size-3.5" /> Mở chỉnh sửa
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(slide);
                        }}
                        title="Xóa bài trình chiếu và toàn bộ hình ảnh trên Bunny Storage"
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
                      >
                        <Trash2 className="size-3.5" /> Xóa
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal xác nhận xóa slide + bắt buộc xóa sạch hình ảnh trên Bunny Storage */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận xóa slide Thánh lễ"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isDeleting) {
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
                  <h2 className="text-sm font-bold text-slate-900">Xóa slide Thánh lễ</h2>
                  <p className="mt-0.5 text-xs text-slate-500">&ldquo;{deleteTarget.title}&rdquo;</p>
                </div>
              </div>
              <button
                type="button"
                disabled={isDeleting}
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

            <div className="space-y-4 p-5">
              <p className="text-xs leading-5 text-slate-600">
                Thao tác này sẽ xóa vĩnh viễn bài trình chiếu <strong>{deleteTarget.title}</strong> khỏi Supabase{" "}
                <strong>và xóa sạch toàn bộ hình ảnh đính kèm</strong> (thư mục{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">mass-images/.../{deleteTarget.id}</code>) trên Bunny Storage. Không thể hoàn tác.
              </p>

              {deleteError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteError(null);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => void confirmDelete(deleteTarget)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-rose-700 disabled:opacity-60"
                >
                  {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  {isDeleting ? "Đang xóa slide & ảnh Bunny..." : "Xóa vĩnh viễn"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
