"use client";

import { AlertTriangle, CalendarDays, FolderOpen, Loader2, Plus, Presentation, Trash2, X } from "lucide-react";

import type { SavedSlideSummary } from "@/lib/pptmass-types";
import { cn } from "@/lib/utils";

function formatShortDateVi(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function MySlidesModal({
  slides,
  currentSlideId,
  deletingSlideId,
  tableMissing,
  isLoggedIn,
  onOpenSlide,
  onCreateNew,
  onDeleteSlide,
  onClose,
}: {
  slides: SavedSlideSummary[];
  currentSlideId: string | null;
  deletingSlideId: string | null;
  tableMissing?: boolean;
  isLoggedIn: boolean;
  onOpenSlide: (slideId: string) => void;
  onCreateNew: () => void;
  onDeleteSlide: (slide: SavedSlideSummary) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Slide đã lưu của bạn"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <FolderOpen className="size-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Slide đã lưu của bạn ({slides.length})</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Mở lại bài trình chiếu để chỉnh sửa tiếp, hoặc tạo bài mới hoàn toàn.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCreateNew}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-violet-700"
            >
              <Plus className="size-3.5" /> Tạo slide mới
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-5">
          {tableMissing && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-bold text-amber-900">Bảng `public.slides` chưa được tạo trên Supabase</p>
                <p className="mt-0.5 text-amber-800">
                  Hãy chạy mục 6 trong file `supabase/schema.sql` trong Supabase SQL Editor để kích hoạt lưu & mở slide.
                </p>
              </div>
            </div>
          )}

          {!isLoggedIn ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
              <Presentation className="size-8 text-slate-400" />
              <p className="mt-3 text-sm font-bold text-slate-700">Vui lòng đăng nhập để lưu & quản lý slide</p>
              <p className="mt-1 text-xs text-slate-500">
                Các bài trình chiếu của bạn được bảo mật riêng tư theo tài khoản trên Supabase và Bunny Storage.
              </p>
            </div>
          ) : slides.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
              <Presentation className="size-8 text-slate-400" />
              <p className="mt-3 text-sm font-bold text-slate-700">Bạn chưa lưu bài trình chiếu nào</p>
              <p className="mt-1 text-xs text-slate-500">
                Sau khi soạn xong, bấm nút &ldquo;Lưu slide&rdquo; trên thanh công cụ để lưu lên hệ thống.
              </p>
            </div>
          ) : (
            slides.map((slide) => {
              const isCurrent = slide.id === currentSlideId;
              const isDeleting = deletingSlideId === slide.id;
              return (
                <div
                  key={slide.id}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3 transition",
                    isCurrent
                      ? "border-violet-400 bg-violet-50/60"
                      : "border-slate-200 bg-white hover:border-violet-200 hover:bg-slate-50/50",
                  )}
                >
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => onOpenSlide(slide.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-60"
                  >
                    <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      {slide.coverImageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={slide.coverImageUrl} alt={slide.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-50 to-slate-100 text-violet-400">
                          <Presentation className="size-5" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-bold text-slate-900">{slide.title}</p>
                        {isCurrent && (
                          <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            Đang mở
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        {slide.celebrationDate && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3" /> {formatShortDateVi(slide.celebrationDate)}
                          </span>
                        )}
                        <span>
                          {slide.sectionCount} phần · {slide.slideCount} slide · {slide.aspectRatio}
                        </span>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => onDeleteSlide(slide)}
                    title="Xóa bài trình chiếu và ảnh đính kèm trên Bunny"
                    className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
