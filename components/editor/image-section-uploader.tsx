"use client";

import { CheckCircle2, Copy, Sparkles, Trash2, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { IMAGE_CATEGORY_LABELS, IMAGE_CATEGORY_OPTIONS } from "@/components/editor/section-meta";
import { isPendingImageUrl, registerPendingImageFile, validateLocalImageFile } from "@/lib/pending-images";
import type { ImageCategory, ImageFitMode } from "@/lib/pptmass-types";
import { cn } from "@/lib/utils";

export function ImageSectionUploader({
  imageCategory,
  imageUrl,
  imageFit,
  coverSectionCount,
  existingCoverImage,
  readOnly,
  onChangeCategory,
  onChangeImage,
  onChangeFit,
  onApplyToAllCovers,
}: {
  imageCategory: ImageCategory;
  imageUrl?: string;
  imageFit: ImageFitMode;
  coverSectionCount: number;
  existingCoverImage?: { imageUrl: string; imageFit: ImageFitMode };
  readOnly: boolean;
  onChangeCategory: (category: ImageCategory) => void;
  onChangeImage: (url: string | undefined) => void;
  onChangeFit: (fit: ImageFitMode) => void;
  onApplyToAllCovers: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedAllFeedback, setAppliedAllFeedback] = useState(false);

  const isLocalPending = isPendingImageUrl(imageUrl);

  function stageLocalFile(file: File) {
    if (readOnly) return;
    const validationError = validateLocalImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setAppliedAllFeedback(false);
    const blobUrl = registerPendingImageFile(file);
    onChangeImage(blobUrl);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (readOnly) return;
    const file = event.dataTransfer.files?.[0];
    if (file) {
      stageLocalFile(file);
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        disabled={readOnly}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) stageLocalFile(file);
        }}
        className="hidden"
      />

      <div>
        <span className="block text-xs font-semibold text-slate-600">Loại hình ảnh</span>
        <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {IMAGE_CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={readOnly}
              onClick={() => {
                setAppliedAllFeedback(false);
                onChangeCategory(opt.value);
              }}
              className={cn(
                "rounded-lg py-1.5 text-xs font-semibold transition",
                imageCategory === opt.value ? "bg-white text-violet-700 shadow-xs" : "text-slate-500 hover:text-slate-800",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {!imageUrl ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!readOnly) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-8 text-center transition",
            isDragging
              ? "border-violet-500 bg-violet-50/70"
              : "border-slate-200 bg-slate-50/60 hover:border-violet-300 hover:bg-violet-50/30",
          )}
        >
          <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
            <Upload className="size-5" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            Chọn {IMAGE_CATEGORY_LABELS[imageCategory].toLowerCase()}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Kéo thả ảnh hoặc chọn từ máy (JPG, PNG, WebP · ≤ 10MB). Ảnh sẽ tải lên Bunny khi bạn bấm Lưu slide.
          </p>

          {!readOnly && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-violet-700"
              >
                <Upload className="size-3.5" /> Chọn ảnh từ máy
              </button>

              {imageCategory === "cover" && existingCoverImage && (
                <button
                  type="button"
                  onClick={() => {
                    onChangeImage(existingCoverImage.imageUrl);
                    onChangeFit(existingCoverImage.imageFit);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100"
                >
                  <Copy className="size-3.5" /> Dùng ảnh bìa lễ hiện có
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={IMAGE_CATEGORY_LABELS[imageCategory]}
                className={cn("h-full w-full", imageFit === "contain" ? "object-contain" : "object-cover")}
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800">{IMAGE_CATEGORY_LABELS[imageCategory]} đã chọn</p>
              <p className={cn("mt-0.5 text-[11px]", isLocalPending ? "font-medium text-amber-700" : "text-emerald-700")}>
                {isLocalPending
                  ? "Ảnh tạm trên máy · sẽ tải lên Bunny khi bấm Lưu slide"
                  : "Đã lưu trên Bunny CDN · sẵn sàng trình chiếu & xuất PPTX"}
              </p>

              {!readOnly && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-700"
                  >
                    <Upload className="size-3" /> Đổi ảnh
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeImage(undefined);
                      setAppliedAllFeedback(false);
                      setError(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    <Trash2 className="size-3" /> Xóa ảnh
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200/70 pt-3">
            <span className="block text-xs font-semibold text-slate-600">Chế độ hiển thị trên slide</span>
            <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1">
              {(
                [
                  { value: "cover", label: "Phủ kín slide" },
                  { value: "contain", label: "Vừa khung (không cắt)" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    setAppliedAllFeedback(false);
                    onChangeFit(opt.value);
                  }}
                  className={cn(
                    "rounded-lg py-1.5 text-xs font-semibold transition",
                    imageFit === opt.value ? "bg-white text-violet-700 shadow-xs" : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {imageCategory === "cover" && !readOnly && (
            <div className="border-t border-slate-200/70 pt-3">
              <button
                type="button"
                disabled={coverSectionCount <= 1}
                onClick={() => {
                  onApplyToAllCovers();
                  setAppliedAllFeedback(true);
                }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <Sparkles className="size-3.5" />
                Áp dụng cho tất cả section Ảnh bìa lễ ({coverSectionCount})
              </button>
              {coverSectionCount <= 1 ? (
                <p className="mt-1.5 text-center text-[11px] text-slate-400">
                  Khi có từ 2 section Ảnh bìa lễ trở lên, bấm nút này để đồng bộ ảnh cho tất cả cùng lúc.
                </p>
              ) : appliedAllFeedback ? (
                <p className="mt-1.5 flex items-center justify-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="size-3.5" /> Đã đồng bộ ảnh bìa cho cả {coverSectionCount} section Ảnh bìa lễ.
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
