"use client";

import { Maximize2, MonitorPlay, Play, Presentation, SkipForward, Tv, X } from "lucide-react";
import { useState } from "react";

import type {
  PresentationDeck,
  PresentationDisplayMode,
  PresentationStartFrom,
} from "@/lib/presentation";
import { cn } from "@/lib/utils";

export function PresentationLaunchModal({
  deck,
  currentSlideIndex,
  onStart,
  onClose,
}: {
  deck: PresentationDeck;
  currentSlideIndex: number;
  onStart: (startFrom: PresentationStartFrom, displayMode: PresentationDisplayMode) => void;
  onClose: () => void;
}) {
  const [startFrom, setStartFrom] = useState<PresentationStartFrom>(
    currentSlideIndex > 0 ? "current" : "beginning",
  );
  const [displayMode, setDisplayMode] = useState<PresentationDisplayMode>("fullscreen");

  const firstSlide = deck.slides[0];
  const currentSlide = deck.slides[currentSlideIndex] ?? firstSlide;
  const totalSlides = deck.slides.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Cài đặt trình chiếu"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-200">
              <Presentation className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Trình chiếu Thánh lễ</h2>
              <p className="text-xs text-slate-500">
                {deck.sections.length} section · {totalSlides} slide · Tỉ lệ {deck.aspectRatio}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* 1. Điểm bắt đầu */}
          <div className="space-y-2.5">
            <span className="block text-xs font-bold tracking-wide text-slate-500 uppercase">
              1. Chọn điểm bắt đầu
            </span>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setStartFrom("beginning")}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-3.5 text-left transition",
                  startFrom === "beginning"
                    ? "border-violet-500 bg-violet-50/70 ring-2 ring-violet-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl",
                    startFrom === "beginning" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600",
                  )}
                >
                  <Play className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900">Bắt đầu từ đầu</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    Slide 1 / {totalSlides}
                    {firstSlide ? ` · ${firstSlide.sectionTitle}` : ""}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStartFrom("current")}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-3.5 text-left transition",
                  startFrom === "current"
                    ? "border-violet-500 bg-violet-50/70 ring-2 ring-violet-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl",
                    startFrom === "current" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600",
                  )}
                >
                  <SkipForward className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900">Từ slide hiện tại</p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    Slide {currentSlideIndex + 1} / {totalSlides}
                    {currentSlide ? ` · ${currentSlide.sectionTitle}` : ""}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Chế độ hiển thị */}
          <div className="space-y-2.5">
            <span className="block text-xs font-bold tracking-wide text-slate-500 uppercase">
              2. Chế độ hiển thị
            </span>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setDisplayMode("fullscreen")}
                className={cn(
                  "flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left transition",
                  displayMode === "fullscreen"
                    ? "border-violet-500 bg-violet-50/70 ring-2 ring-violet-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                    displayMode === "fullscreen" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600",
                  )}
                >
                  <Maximize2 className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900">Toàn màn hình hiện tại</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    Phóng toàn bộ slide lên toàn màn hình ngay tại đây. Phù hợp khi dùng 1 màn hình hoặc chế độ nhân bản (Duplicate) máy chiếu.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDisplayMode("presenter")}
                className={cn(
                  "flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left transition",
                  displayMode === "presenter"
                    ? "border-violet-500 bg-violet-50/70 ring-2 ring-violet-500/20"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                    displayMode === "presenter" ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600",
                  )}
                >
                  <MonitorPlay className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">Cửa sổ chiếu mới + Màn hình điều khiển</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      <Tv className="size-3" /> Chuẩn máy chiếu (2 màn hình)
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    Mở cửa sổ trình chiếu riêng để kéo sang máy chiếu/TV (bật Fullscreen), còn màn hình hiện tại làm{" "}
                    <strong className="font-semibold text-slate-700">Bàn điều khiển</strong> (giống Presenter View của MS PowerPoint): xem trước slide tiếp theo, bấm danh sách trang để chiếu tức thì.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Hủy
          </button>

          <button
            type="button"
            disabled={totalSlides === 0}
            onClick={() => onStart(startFrom, displayMode)}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-200 transition hover:bg-violet-700 disabled:opacity-50 sm:text-sm"
          >
            <Play className="size-4 fill-current" /> Bắt đầu trình chiếu
          </button>
        </div>
      </div>
    </div>
  );
}
