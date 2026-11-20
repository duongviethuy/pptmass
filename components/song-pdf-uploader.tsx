"use client";

import { AlertCircle, CheckCircle2, ExternalLink, FileText, Loader2, RotateCcw, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";

import { cn } from "@/lib/utils";

export function formatPdfBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const raw = pathname.split("/").pop() ?? "to-nhac.pdf";
    return decodeURIComponent(raw);
  } catch {
    return "to-nhac.pdf";
  }
}

/**
 * Khung chọn tệp PDF cục bộ (chỉ giữ trên trình duyệt, CHƯA tải lên Bunny Storage
 * cho tới khi người dùng bấm "Lưu bài hát" / "Lưu thay đổi" — tránh 100% tệp rác).
 * Ở chế độ chỉnh sửa, hiển thị thêm tệp PDF hiện đang lưu trên Bunny và cho phép đổi/gỡ.
 */
export function SongPdfUploader({
  value,
  existingPdfUrl,
  removeExistingPdf = false,
  saveActionLabel = "Lưu bài hát",
  disabled = false,
  statusMessage,
  error,
  onChange,
  onToggleRemoveExisting,
  onError,
}: {
  value: File | null;
  existingPdfUrl?: string | null;
  removeExistingPdf?: boolean;
  saveActionLabel?: string;
  disabled?: boolean;
  statusMessage?: string | null;
  error?: string | null;
  onChange: (file: File | null) => void;
  onToggleRemoveExisting?: (remove: boolean) => void;
  onError: (message: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const localPreviewUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  function handleSelectFile(file: File) {
    if (disabled) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pdf") && file.type !== "application/pdf") {
      onError("Vui lòng chọn đúng tệp PDF tờ nhạc (.pdf).");
      return;
    }
    if (file.size === 0) {
      onError("Tệp PDF rỗng, không có dữ liệu.");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      onError("Tệp PDF vượt quá dung lượng tải lên tối đa (30MB).");
      return;
    }

    onError(null);
    onToggleRemoveExisting?.(false);
    onChange(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) handleSelectFile(file);
  }

  const showingExisting = Boolean(existingPdfUrl && !removeExistingPdf && !value);
  const showingRemovedBanner = Boolean(existingPdfUrl && removeExistingPdf && !value);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-bold text-slate-700">
          Tờ nhạc PDF{" "}
          <span className="font-normal text-slate-400">
            (tùy chọn · lưu lên Bunny khi bấm {saveActionLabel})
          </span>
        </span>
        <span className="text-[11px] text-slate-400">Tự kiểm tra &amp; nén ≤ 200 KB/trang (300 PPI)</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleSelectFile(file);
        }}
        className="hidden"
      />

      {value ? (
        <div className="mt-2.5 rounded-2xl border border-violet-200 bg-violet-50/40 p-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              {statusMessage ? <Loader2 className="size-5 animate-spin" /> : <FileText className="size-5" />}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-slate-900">{value.name}</p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                {statusMessage ? (
                  <span className="font-semibold text-violet-700">{statusMessage}</span>
                ) : (
                  <>
                    Dung lượng gốc: <strong>{formatPdfBytes(value.size)}</strong> ·{" "}
                    {existingPdfUrl
                      ? `Tệp mới sẽ thay thế và tự xóa tệp cũ trên Bunny khi bấm «${saveActionLabel}»`
                      : `Chờ nén & lưu khi bấm «${saveActionLabel}»`}
                  </>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {localPreviewUrl && (
                <a
                  href={localPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-violet-700 transition hover:bg-violet-50"
                >
                  <ExternalLink className="size-3" /> Xem thử
                </a>
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-700 disabled:opacity-50"
              >
                <Upload className="size-3" /> Đổi
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onError(null);
                  onChange(null);
                }}
                aria-label="Hủy tệp PDF mới chọn"
                title={existingPdfUrl ? "Hủy tệp mới (giữ lại tệp cũ)" : "Gỡ tệp PDF"}
                className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white p-1.5 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : showingExisting && existingPdfUrl ? (
        <div className="mt-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <FileText className="size-5" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
                <p className="truncate text-xs font-bold text-slate-900">{getFileNameFromUrl(existingPdfUrl)}</p>
              </div>
              <p className="mt-0.5 text-[11px] text-emerald-800">
                Tờ nhạc PDF hiện tại · Đang lưu trên Bunny CDN
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <a
                href={existingPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-50"
              >
                <ExternalLink className="size-3" /> Xem PDF
              </a>
              <button
                type="button"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-700 disabled:opacity-50"
              >
                <Upload className="size-3" /> Đổi tệp
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onError(null);
                  onToggleRemoveExisting?.(true);
                }}
                aria-label="Xóa tệp PDF hiện tại"
                title="Xóa tệp PDF hiện tại"
                className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white p-1.5 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2.5 space-y-2">
          {showingRemovedBanner && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              <span>
                Tệp PDF cũ sẽ bị <strong>xóa khỏi Bunny Storage</strong> khi bạn bấm &ldquo;{saveActionLabel}&rdquo;.
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onToggleRemoveExisting?.(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 font-bold text-amber-800 hover:bg-amber-100"
              >
                <RotateCcw className="size-3" /> Giữ lại tệp cũ
              </button>
            </div>
          )}

          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (!disabled) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !disabled && inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer items-center gap-3.5 rounded-2xl border-2 border-dashed px-4 py-4 transition",
              isDragging
                ? "border-violet-500 bg-violet-50/70"
                : "border-slate-200 bg-slate-50/60 hover:border-violet-300 hover:bg-violet-50/30",
              disabled && "cursor-not-allowed opacity-70",
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <Upload className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800">Bấm chọn hoặc kéo thả tệp PDF tờ nhạc vào đây</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Hỗ trợ PDF tối đa 30 trang (≤ 30MB). Tệp chỉ được nén và gửi lên Bunny Storage khi bạn bấm &ldquo;{saveActionLabel}&rdquo;.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-2 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
