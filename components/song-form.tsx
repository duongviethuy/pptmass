"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe,
  Loader2,
  Lock,
  Music2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import { createSong, updateSong } from "@/app/songs/actions";
import { SongPdfUploader, formatPdfBytes } from "@/components/song-pdf-uploader";
import { normalizeSongLyrics, normalizeSongPayload } from "@/lib/payload-normalizer";
import type { Song, SongPart, SongPartKind } from "@/lib/pptmass-types";
import { cn, toTitleCaseVi } from "@/lib/utils";

type PdfCompressionSummary = {
  pageCount: number;
  originalBytes: number;
  compressedBytes: number;
  appliedPpi: number;
};

type SaveFeedback =
  | {
      status: "success";
      song: Song;
      createdAtLabel: string;
      updatedAtLabel: string;
      pdfSummary?: PdfCompressionSummary;
      oldPdfDeleted?: boolean;
    }
  | { status: "table_missing"; message: string }
  | { status: "error"; message: string };

const CATEGORY_OPTIONS = ["Nhập lễ", "Đáp ca", "Alleluia", "Dâng lễ", "Hiệp lễ", "Kết lễ", "Chầu Thánh Thể"];

const TOPIC_OPTIONS = [
  "Đức Mẹ",
  "Thánh Giuse",
  "Các Thánh",
  "Chúa Giêsu",
  "Lòng Chúa Thương Xót",
  "Mùa Vọng",
  "Mùa Giáng Sinh",
  "Mùa Chay",
  "Mùa Phục Sinh",
  "Thường Niên",
  "Cầu cho Tín hữu qua đời",
  "Khác",
];

const PART_KIND_OPTIONS: {
  value: SongPartKind;
  label: string;
  defaultLabel: string;
  dotClass: string;
  activeClass: string;
  badgeClass: string;
}[] = [
  {
    value: "verse",
    label: "Phiên khúc",
    defaultLabel: "Phiên khúc",
    dotClass: "bg-sky-500",
    activeClass: "border-sky-200/80 bg-sky-50 text-sky-800 shadow-xs",
    badgeClass: "bg-sky-100 text-sky-700",
  },
  {
    value: "chorus",
    label: "Điệp khúc",
    defaultLabel: "Điệp khúc",
    dotClass: "bg-rose-500",
    activeClass: "border-rose-200/80 bg-rose-50 text-rose-800 shadow-xs",
    badgeClass: "bg-rose-100 text-rose-700",
  },
  {
    value: "bridge",
    label: "Coda / Kết",
    defaultLabel: "Coda",
    dotClass: "bg-amber-500",
    activeClass: "border-amber-200/80 bg-amber-50 text-amber-800 shadow-xs",
    badgeClass: "bg-amber-100 text-amber-700",
  },
];

const PART_KIND_META = Object.fromEntries(PART_KIND_OPTIONS.map((item) => [item.value, item])) as Record<
  SongPartKind,
  (typeof PART_KIND_OPTIONS)[number]
>;

const INITIAL_PARTS: SongPart[] = [
  { id: "part-1", kind: "verse", label: "Phiên khúc 1", lyrics: "" },
  { id: "part-2", kind: "chorus", label: "Điệp khúc", lyrics: "" },
];

const DEFAULT_LABEL_PATTERN = /^(Phiên khúc|Điệp khúc|Coda(\s*\/\s*Kết)?|Đoạn chuyển)(\s+\d+)?$/i;

function suggestPartLabel(parts: SongPart[], kind: SongPartKind, excludeId?: string): string {
  const count = parts.filter((part) => part.kind === kind && part.id !== excludeId).length;
  if (kind === "verse") return `Phiên khúc ${count + 1}`;
  if (kind === "chorus") return count === 0 ? "Điệp khúc" : `Điệp khúc ${count + 1}`;
  return count === 0 ? "Coda" : `Coda ${count + 1}`;
}

export default function SongForm({
  currentUserName,
  initialSong,
}: {
  currentUserName?: string;
  initialSong?: Song;
}) {
  const isEditMode = Boolean(initialSong);

  const [title, setTitle] = useState(() => initialSong?.title ?? "");
  const [author, setAuthor] = useState(() => initialSong?.author ?? "");
  const [notes, setNotes] = useState(() => initialSong?.notes ?? "");
  const [existingPdfUrl, setExistingPdfUrl] = useState<string | null>(() => initialSong?.pdfUrl ?? null);
  const [removeExistingPdf, setRemoveExistingPdf] = useState(false);
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfUploadStatus, setPdfUploadStatus] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(() => (initialSong ? initialSong.isPublic !== false : true));
  const [categories, setCategories] = useState<string[]>(() =>
    initialSong ? (initialSong.categories ?? []) : ["Nhập lễ"],
  );
  const [topics, setTopics] = useState<string[]>(() => initialSong?.topics ?? []);

  const [parts, setParts] = useState<SongPart[]>(() =>
    initialSong && initialSong.parts.length > 0
      ? initialSong.parts.map((part) => ({ ...part }))
      : INITIAL_PARTS.map((part) => ({ ...part })),
  );
  const [activePartIndex, setActivePartIndex] = useState(0);

  const [errors, setErrors] = useState<{ title?: string; parts?: string }>({});
  const [feedback, setFeedback] = useState<SaveFeedback | null>(null);
  const [isPending, startTransition] = useTransition();

  const previewParts = useMemo(
    () =>
      parts
        .map((part) => ({
          ...part,
          displayLabel: part.label.replace(/\s+/g, " ").trim() || PART_KIND_META[part.kind].label,
          cleanLyrics: normalizeSongLyrics(part.lyrics),
        }))
        .filter((part) => part.cleanLyrics.length > 0),
    [parts],
  );

  const safePartIndex = previewParts.length === 0 ? 0 : Math.min(activePartIndex, previewParts.length - 1);
  const currentPreviewPart = previewParts[safePartIndex];

  function clearFormFields() {
    setTitle("");
    setAuthor("");
    setNotes("");
    setExistingPdfUrl(null);
    setRemoveExistingPdf(false);
    setSelectedPdfFile(null);
    setPdfError(null);
    setPdfUploadStatus(null);
    setIsPublic(true);
    setCategories(["Nhập lễ"]);
    setTopics([]);
    setParts(INITIAL_PARTS.map((part) => ({ ...part })));
    setErrors({});
    setActivePartIndex(0);
  }

  useEffect(() => {
    if (isEditMode) return;
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        clearFormFields();
        setFeedback(null);
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [isEditMode]);

  useEffect(() => {
    if (feedback?.status !== "success") return;
    const timer = window.setTimeout(() => setFeedback(null), 6000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  function toggleSelection(value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) {
    setFeedback(null);
    setter((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  function addPart(kind: SongPartKind) {
    setFeedback(null);
    setParts((current) => [...current, { id: `part-${crypto.randomUUID()}`, kind, label: suggestPartLabel(current, kind), lyrics: "" }]);
  }

  function updatePart(id: string, patch: Partial<SongPart>) {
    setFeedback(null);
    setErrors((current) => ({ ...current, parts: undefined }));
    setParts((current) => current.map((part) => (part.id === id ? { ...part, ...patch } : part)));
  }

  function changePartKind(part: SongPart, nextKind: SongPartKind) {
    if (part.kind === nextKind) return;
    const trimmedLabel = part.label.trim();
    const shouldUpdateLabel = trimmedLabel === "" || DEFAULT_LABEL_PATTERN.test(trimmedLabel);
    updatePart(part.id, {
      kind: nextKind,
      ...(shouldUpdateLabel ? { label: suggestPartLabel(parts, nextKind, part.id) } : {}),
    });
  }

  function removePart(id: string) {
    if (parts.length <= 1) return;
    setFeedback(null);
    setParts((current) => current.filter((part) => part.id !== id));
  }

  function fillSampleSong() {
    setTitle("Đi Về Nhà Chúa");
    setAuthor("Lm. Thái Nguyên");
    setNotes("Thường hát Phiên khúc 1, 2 và Điệp khúc");
    setIsPublic(true);
    setCategories(["Nhập lễ"]);
    setTopics(["Thường Niên"]);
    setParts([
      {
        id: "part-1",
        kind: "verse",
        label: "Phiên khúc 1",
        lyrics: "Đi về nhà Chúa bao năm cách xa nhan Ngài.\nĐi về nhà Chúa tâm tư sướng vui ngợp trời.\nĐi về nhà Chúa bao nhiêu mến thương đầy vơi.",
      },
      {
        id: "part-2",
        kind: "chorus",
        label: "Điệp khúc",
        lyrics: "Hân hoan, hân hoan vào thánh điện Ngài.\nDâng lên, dâng lên một bài ca mới.\nTôn vinh Thiên Chúa đất trời, tạo hóa muôn loài.",
      },
      {
        id: "part-3",
        kind: "verse",
        label: "Phiên khúc 2",
        lyrics: "Bao ngày trông ngóng hôm nay bước chân trở về.\nTrong tình yêu Chúa chan hòa suối nguồn bình an.",
      },
    ]);
    setErrors({});
    setFeedback(null);
    setActivePartIndex(0);
  }

  function handleSave() {
    const normalizedTitle = toTitleCaseVi(title);
    const normalizedAuthor = toTitleCaseVi(author);
    const normalizedNotes = normalizeSongLyrics(notes);

    const nextErrors: { title?: string; parts?: string } = {};
    if (!normalizedTitle) nextErrors.title = "Vui lòng nhập tên bài hát.";

    const nonEmptyParts = parts
      .map((part) => ({
        ...part,
        label: part.label.replace(/\s+/g, " ").trim() || PART_KIND_META[part.kind].label,
        lyrics: normalizeSongLyrics(part.lyrics),
      }))
      .filter((part) => part.lyrics.length > 0);

    if (nonEmptyParts.length === 0) {
      nextErrors.parts = "Vui lòng nhập lời cho ít nhất một phần của bài hát.";
    }

    if (nextErrors.title || nextErrors.parts) {
      setErrors(nextErrors);
      setFeedback(null);
      return;
    }

    setTitle(normalizedTitle);
    setAuthor(normalizedAuthor);
    setNotes(normalizedNotes);
    setParts(nonEmptyParts);
    setErrors({});
    setPdfError(null);
    setFeedback(null);

    startTransition(async () => {
      let finalPdfUrl: string | undefined = removeExistingPdf ? undefined : (existingPdfUrl ?? undefined);
      let uploadedObjectPath: string | undefined;
      let pdfSummary: PdfCompressionSummary | undefined;

      // Chỉ kiểm tra, nén và tải tệp PDF mới lên Bunny Storage khi người dùng bấm Lưu
      if (selectedPdfFile) {
        setPdfUploadStatus("Đang kiểm tra, nén PDF (300 PPI · ≤ 200KB/trang) và lưu lên Bunny...");
        try {
          const formData = new FormData();
          formData.append("file", selectedPdfFile);
          formData.append("songTitle", normalizedTitle);

          const uploadRes = await fetch("/api/upload-song-pdf", {
            method: "POST",
            body: formData,
          });
          const uploadJson = (await uploadRes.json().catch(() => null)) as
            | {
                url?: string;
                objectPath?: string;
                pageCount?: number;
                originalBytes?: number;
                compressedBytes?: number;
                appliedPpi?: number;
                error?: string;
              }
            | null;

          if (!uploadRes.ok || !uploadJson?.url || !uploadJson.objectPath) {
            const msg = uploadJson?.error ?? "Không thể kiểm tra, nén hoặc tải tệp PDF lên Bunny Storage.";
            setPdfError(msg);
            setPdfUploadStatus(null);
            setFeedback({ status: "error", message: msg });
            return;
          }

          finalPdfUrl = uploadJson.url;
          uploadedObjectPath = uploadJson.objectPath;
          pdfSummary = {
            pageCount: uploadJson.pageCount ?? 1,
            originalBytes: uploadJson.originalBytes ?? selectedPdfFile.size,
            compressedBytes: uploadJson.compressedBytes ?? selectedPdfFile.size,
            appliedPpi: uploadJson.appliedPpi ?? 300,
          };
        } catch {
          const msg = "Lỗi kết nối khi xử lý và tải tệp PDF lên Bunny Storage.";
          setPdfError(msg);
          setPdfUploadStatus(null);
          setFeedback({ status: "error", message: msg });
          return;
        }
      }

      setPdfUploadStatus(selectedPdfFile ? "Đang lưu thông tin bài hát..." : null);
      const payload = normalizeSongPayload({
        title: normalizedTitle,
        author: normalizedAuthor,
        notes: normalizedNotes,
        pdfUrl: finalPdfUrl,
        isPublic,
        categories,
        topics,
        parts: nonEmptyParts,
      });

      const result = initialSong
        ? await updateSong({ id: initialSong.id, ...payload })
        : await createSong(payload);
      setPdfUploadStatus(null);

      if (result.status === "success") {
        if (initialSong) {
          setTitle(result.song.title);
          setAuthor(result.song.author ?? "");
          setNotes(result.song.notes ?? "");
          setParts(result.song.parts.map((p) => ({ ...p })));
          setExistingPdfUrl(result.song.pdfUrl ?? null);
          setRemoveExistingPdf(false);
          setSelectedPdfFile(null);
        } else {
          clearFormFields();
        }
        setFeedback({ ...result, pdfSummary });
        return;
      }

      // Rollback tự động: nếu lưu lên Supabase thất bại -> xóa ngay tệp PDF mới vừa đẩy lên Bunny để tránh rác!
      if (uploadedObjectPath) {
        void fetch("/api/upload-song-pdf", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objectPath: uploadedObjectPath }),
        }).catch(() => undefined);
      }

      if (result.status === "table_missing") {
        setFeedback(result);
        return;
      }

      if (result.fieldErrors) {
        setErrors(result.fieldErrors);
      }
      setFeedback({ status: "error", message: result.message });
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-7 lg:px-8 lg:py-9">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href={isEditMode ? "/songs" : "/"}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-violet-700"
          >
            <ArrowLeft className="size-3.5" /> {isEditMode ? "Quay lại Thư viện bài hát" : "Quay lại trang chủ"}
          </Link>
          <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900">
            <span className="flex size-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
              <Music2 className="size-5" />
            </span>
            {isEditMode ? "Chỉnh sửa bài hát" : "Tạo bài hát mới"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Lời bài hát khi lưu sẽ tự động chuẩn hóa thành 1 dòng xuyên suốt (xóa khoảng trắng đầu cuối, space dư và ngắt dòng) để căn đều slide chuẩn đẹp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isEditMode && (
            <button
              type="button"
              onClick={fillSampleSong}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-60"
            >
              <Sparkles className="size-3.5 text-violet-600" /> Điền bài mẫu
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isPending ? "Đang lưu..." : isEditMode ? "Lưu thay đổi" : "Lưu bài hát"}
          </button>
        </div>
      </div>

      {feedback?.status === "success" && (
        <div role="status" className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">
                {isEditMode
                  ? `Đã cập nhật bài hát "${feedback.song.title}" thành công!`
                  : `Đã lưu bài hát "${feedback.song.title}" thành công!`}
                {feedback.oldPdfDeleted ? " (Đã tự động xóa tệp PDF cũ trên Bunny Storage)" : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-emerald-800">
                <span>
                  Người tạo: <strong className="font-semibold">{feedback.song.createdByName}</strong>
                </span>
                <span>
                  Số lời: <strong className="font-semibold">{feedback.song.parts.length} phần</strong>
                </span>
                <span>
                  Cập nhật lúc: <strong className="font-semibold">{feedback.updatedAtLabel}</strong>
                </span>
                {feedback.song.pdfUrl && (
                  <span className="inline-flex items-center gap-2">
                    {feedback.pdfSummary && (
                      <span>
                        PDF ({feedback.pdfSummary.pageCount} trang · {formatPdfBytes(feedback.pdfSummary.originalBytes)} →{" "}
                        <strong>{formatPdfBytes(feedback.pdfSummary.compressedBytes)}</strong> · {feedback.pdfSummary.appliedPpi} PPI)
                      </span>
                    )}
                    <a
                      href={feedback.song.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
                    >
                      Mở tờ nhạc PDF ↗
                    </a>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {feedback?.status === "table_missing" && (
        <div role="alert" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1 text-xs leading-5">
              <p className="text-sm font-bold text-amber-900">Chưa có bảng `songs` trên Supabase</p>
              <p className="mt-1 text-amber-800">{feedback.message}</p>
            </div>
          </div>
        </div>
      )}

      {feedback?.status === "error" && (
        <div role="alert" className="mb-6 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{feedback.message}</p>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-6">
          {/* Khối 1: Thông tin bài hát */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <h2 className="text-base font-bold text-slate-900">1. Thông tin bài hát</h2>
            <p className="mt-0.5 text-xs text-slate-500">Tên bài hát, tác giả, ghi chú, phân loại và chủ đề (có thể chọn nhiều mục).</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Tên bài hát <span className="text-rose-500">*</span>
                <input
                  value={title}
                  autoComplete="off"
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setErrors((current) => ({ ...current, title: undefined }));
                    setFeedback(null);
                  }}
                  placeholder="Ví dụ: Đi Về Nhà Chúa"
                  aria-invalid={Boolean(errors.title)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-100 aria-invalid:border-rose-400 aria-invalid:focus:ring-rose-100"
                />
                {errors.title && <span className="mt-1.5 block text-xs font-medium text-rose-600">{errors.title}</span>}
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Tác giả / Nhạc sĩ <span className="text-xs font-normal text-slate-400">(tùy chọn)</span>
                <input
                  value={author}
                  autoComplete="off"
                  onChange={(event) => {
                    setAuthor(event.target.value);
                    setFeedback(null);
                  }}
                  placeholder="Ví dụ: Lm. Thái Nguyên"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-100"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
                Ghi chú <span className="text-xs font-normal text-slate-400">(tùy chọn)</span>
                <input
                  value={notes}
                  autoComplete="off"
                  onChange={(event) => {
                    setNotes(event.target.value);
                    setFeedback(null);
                  }}
                  placeholder="Ví dụ: Bản Ca đoàn Giới trẻ, thường hát PK 1 & 2..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-100"
                />
              </label>
            </div>

            <div className="mt-5 space-y-5 border-t border-slate-100 pt-5">
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700">Chế độ hiển thị</span>
                  <span className="text-[11px] text-slate-400">Ai có thể nhìn thấy bài hát này trong thư viện?</span>
                </div>
                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPublic(true);
                      setFeedback(null);
                    }}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl border p-3.5 text-left transition",
                      isPublic
                        ? "border-violet-300 bg-violet-50/70 shadow-2xs"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl",
                        isPublic ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500",
                      )}
                    >
                      <Globe className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-900">Công khai</span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                        Mọi người dùng đăng nhập đều có thể xem và dùng bài hát này.
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPublic(false);
                      setFeedback(null);
                    }}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl border p-3.5 text-left transition",
                      !isPublic
                        ? "border-violet-300 bg-violet-50/70 shadow-2xs"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl",
                        !isPublic ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500",
                      )}
                    >
                      <Lock className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-slate-900">Riêng tư</span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                        Chỉ tài khoản của bạn mới nhìn thấy và sử dụng bài hát này.
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              <SongPdfUploader
                value={selectedPdfFile}
                existingPdfUrl={existingPdfUrl}
                removeExistingPdf={removeExistingPdf}
                saveActionLabel={isEditMode ? "Lưu thay đổi" : "Lưu bài hát"}
                disabled={isPending}
                statusMessage={pdfUploadStatus}
                error={pdfError}
                onChange={(nextFile) => {
                  setSelectedPdfFile(nextFile);
                  setFeedback(null);
                }}
                onToggleRemoveExisting={(remove) => {
                  setRemoveExistingPdf(remove);
                  setFeedback(null);
                }}
                onError={setPdfError}
              />

              <ChipGroup
                label="Phân loại"
                hint="Chọn một hoặc nhiều phần lễ phù hợp"
                options={CATEGORY_OPTIONS}
                selected={categories}
                onToggle={(value) => toggleSelection(value, setCategories)}
              />
              <ChipGroup
                label="Chủ đề"
                hint="Chọn một hoặc nhiều chủ đề của bài hát"
                options={TOPIC_OPTIONS}
                selected={topics}
                onToggle={(value) => toggleSelection(value, setTopics)}
              />
            </div>
          </section>

          {/* Khối 2: Nội dung lời bài hát */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">2. Nội dung lời bài hát</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Nhập riêng từng phần (Phiên khúc, Điệp khúc, Coda / Kết). Thứ tự hát và lặp Điệp khúc sẽ chọn ở Editor.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{parts.length} phần</span>
            </div>

            {errors.parts && (
              <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700">
                <AlertCircle className="size-4 shrink-0" />
                {errors.parts}
              </div>
            )}

            <div className="mt-5 space-y-4">
              {parts.map((part) => (
                <div
                  key={part.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition focus-within:border-violet-300 focus-within:ring-3 focus-within:ring-violet-50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div
                      role="radiogroup"
                      aria-label="Chọn loại phần bài hát"
                      className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1 sm:rounded-full"
                    >
                      {PART_KIND_OPTIONS.map((option) => {
                        const active = part.kind === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => changePartKind(part, option.value)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200",
                              active
                                ? option.activeClass
                                : "border-transparent text-slate-500 hover:bg-white/60 hover:text-slate-800",
                            )}
                          >
                            <span
                              className={cn(
                                "size-1.5 rounded-full transition-opacity",
                                option.dotClass,
                                active ? "opacity-100" : "opacity-45",
                              )}
                            />
                            {option.label}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => removePart(part.id)}
                      disabled={parts.length <= 1}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                      aria-label="Xóa phần này"
                      title="Xóa phần này"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="mt-3">
                    <input
                      value={part.label}
                      autoComplete="off"
                      onChange={(event) => updatePart(part.id, { label: event.target.value })}
                      placeholder={`Tên phần (VD: ${PART_KIND_META[part.kind].defaultLabel})`}
                      aria-label="Tên hiển thị của phần"
                      className="w-full rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-1.5 text-sm font-semibold text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100 sm:max-w-xs"
                    />
                  </div>

                  <textarea
                    rows={4}
                    value={part.lyrics}
                    autoComplete="off"
                    onChange={(event) => updatePart(part.id, { lyrics: event.target.value })}
                    placeholder={
                      part.kind === "chorus"
                        ? "Nhập lời điệp khúc...\nHân hoan, hân hoan vào thánh điện Ngài."
                        : part.kind === "bridge"
                          ? "Nhập lời đoạn Coda / Kết bài..."
                          : "Nhập lời phiên khúc..."
                    }
                    className="mt-3 w-full resize-y rounded-xl border border-slate-200/90 bg-slate-50/40 px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-3 focus:ring-violet-100"
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {PART_KIND_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => addPart(option.value)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                >
                  <Plus className="size-4" /> Thêm {option.label}
                </button>
              ))}
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {isPending ? "Đang lưu..." : isEditMode ? "Lưu thay đổi" : "Lưu bài hát"}
            </button>
          </div>
        </div>

        {/* Cột phải: Xem trước nội dung bài hát */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Eye className="size-4 text-violet-600" /> Xem trước nội dung
              </h2>
              <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                {previewParts.length} phần có lời
              </span>
            </div>

            <div className="overflow-hidden rounded-[18px] bg-[#263454] shadow-xl shadow-slate-300/70">
              <div className="relative aspect-video overflow-hidden px-[10%] py-[8%] text-center text-white">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_0%,rgba(203,186,151,.45),transparent_35%),linear-gradient(125deg,#172441,#334f77_55%,#182440)]" />
                <div className="relative flex h-full flex-col items-center justify-center">
                  {currentPreviewPart ? (
                    <>
                      <p className="mb-2 text-[11px] font-bold tracking-[0.16em] text-amber-200 uppercase">
                        {title.trim() || "TÊN BÀI HÁT"}
                      </p>
                      <p className="line-clamp-5 whitespace-pre-line text-sm leading-relaxed font-medium text-white sm:text-base">
                        {currentPreviewPart.cleanLyrics}
                      </p>
                    </>
                  ) : (
                    <>
                      <Music2 className="mb-2 size-8 text-amber-200/80" />
                      <p className="text-sm font-semibold text-amber-100">{title.trim() || "Xem trước bài hát"}</p>
                      <p className="mt-1 text-xs text-white/60">Nhập lời bài hát hoặc bấm &ldquo;Điền bài mẫu&rdquo; để soát lại nội dung.</p>
                    </>
                  )}
                </div>
                {currentPreviewPart && (
                  <span className="absolute bottom-3 left-4 text-[10px] font-medium text-white/55">
                    {currentPreviewPart.displayLabel}
                  </span>
                )}
                <span className="absolute bottom-3 right-4 text-[10px] tracking-wider text-white/45">PPTMASS</span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setActivePartIndex(Math.max(0, safePartIndex - 1))}
                disabled={previewParts.length === 0 || safePartIndex === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="size-3.5" /> Trước
              </button>
              <span className="text-xs font-semibold text-slate-500">
                {previewParts.length === 0 ? "Phần 0 / 0" : `Phần ${safePartIndex + 1} / ${previewParts.length}`}
              </span>
              <button
                type="button"
                onClick={() => setActivePartIndex(Math.min(previewParts.length - 1, safePartIndex + 1))}
                disabled={previewParts.length === 0 || safePartIndex >= previewParts.length - 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Tiếp <ChevronRight className="size-3.5" />
              </button>
            </div>

            {previewParts.length > 0 && (
              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto border-t border-slate-100 pt-4 pr-1">
                {previewParts.map((part, idx) => (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => setActivePartIndex(idx)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left transition",
                      idx === safePartIndex
                        ? "border-violet-300 bg-violet-50/80"
                        : "border-slate-100 bg-slate-50/70 hover:border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold",
                          PART_KIND_META[part.kind].badgeClass,
                        )}
                      >
                        {part.displayLabel}
                      </span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-line text-xs leading-5 text-slate-600">{part.cleanLyrics}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {feedback?.status === "success" && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <h3 className="text-xs font-bold text-emerald-800">Trạng thái đã lưu</h3>
              <dl className="mt-3 space-y-2 text-xs">
                <SummaryRow label="Người tạo" value={feedback.song.createdByName || currentUserName || "Bạn"} />
                <SummaryRow label="Số lời" value={`${feedback.song.parts.length} phần`} />
                <SummaryRow label="Cập nhật lúc" value={feedback.updatedAtLabel} />
              </dl>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ChipGroup({
  label,
  hint,
  options,
  selected,
  onToggle,
}: {
  label: string;
  hint: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-bold text-slate-700">{label}</span>
        <span className="text-[11px] text-slate-400">{hint}</span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                active
                  ? "border-violet-500 bg-violet-600 text-white shadow-xs"
                  : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
      <dt className="shrink-0 text-slate-400">{label}</dt>
      <dd className="text-right font-semibold text-slate-700">{value}</dd>
    </div>
  );
}
