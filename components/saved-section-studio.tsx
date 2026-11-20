"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  Loader2,
  Lock,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { deleteSavedSection, saveNewSection, updateSavedSection } from "@/app/sections/actions";
import SectionStudioEditor from "@/components/section-studio-editor";
import { songLibrary as demoSongs } from "@/lib/demo-data";
import { normalizeSectionForStorage } from "@/lib/payload-normalizer";
import {
  revokePendingImageUrl,
  rollbackUploadedImages,
  uploadPendingImagesForSections,
} from "@/lib/pending-images";
import type { MassSection, MassThemeId, SavedSection, SlideAspectRatio, Song } from "@/lib/pptmass-types";
import { cn } from "@/lib/utils";

export type SavedSectionWithLabel = SavedSection & {
  updatedAtLabel: string;
};

function createBlankSection(): MassSection {
  const id = `draft-section-${crypto.randomUUID()}`;
  return {
    id,
    kind: "text",
    title: "TIÊU ĐỀ SECTION",
    content: "Bấm trực tiếp vào đây để soạn nội dung slide như trên PowerPoint...",
    showTitle: true,
    showContent: true,
    titleFontFamily: "Arial",
    titleFontSize: "large",
    slides: [
      {
        id: `${id}-s-1`,
        showHeading: true,
        body: "Bấm trực tiếp vào đây để soạn nội dung slide như trên PowerPoint...",
        showBody: true,
      },
    ],
    style: { fontSize: "xlarge", fontFamily: "Arial", showTitleOnEverySlide: false },
  };
}

export default function SavedSectionStudio({
  initialSections,
  songs,
  isLoggedIn,
  tableMissing,
}: {
  initialSections: SavedSectionWithLabel[];
  songs: Song[];
  isLoggedIn: boolean;
  tableMissing: boolean;
}) {
  const availableSongs = songs.length > 0 ? songs : demoSongs;

  const [savedList, setSavedList] = useState<SavedSectionWithLabel[]>(initialSections);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(() => initialSections[0]?.id ?? null);
  const [draftSection, setDraftSection] = useState<MassSection>(() =>
    initialSections[0] ? initialSections[0].sectionData : createBlankSection(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [aspectRatio, setAspectRatio] = useState<SlideAspectRatio>("16:9");
  const [themeId, setThemeId] = useState<MassThemeId>("pure-white");

  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "warn"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return savedList;
    return savedList.filter((item) => item.title.toLowerCase().includes(q));
  }, [savedList, searchQuery]);

  function selectSaved(item: SavedSectionWithLabel) {
    setActiveSavedId(item.id);
    setDraftSection(item.sectionData);
    setFeedback(null);
  }

  function startNewSection() {
    setActiveSavedId(null);
    setDraftSection(createBlankSection());
    setFeedback(null);
  }

  function handleSave() {
    if (!isLoggedIn) {
      setFeedback({ type: "error", message: "Vui lòng đăng nhập để lưu section cá nhân." });
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const targetId = activeSavedId ?? crypto.randomUUID();
      let uploadedPaths: string[] = [];
      let replacedBlobs: string[] = [];
      let sectionWithUploadedImages = draftSection;

      try {
        const uploaded = await uploadPendingImagesForSections([draftSection], {
          slideId: targetId,
          scope: "section",
        });
        sectionWithUploadedImages = uploaded.sections[0] ?? draftSection;
        uploadedPaths = uploaded.uploadedObjectPaths;
        replacedBlobs = uploaded.replacedBlobUrls;
      } catch (err) {
        setFeedback({
          type: "error",
          message: err instanceof Error ? err.message : "Không thể tải ảnh lên Bunny Storage.",
        });
        return;
      }

      const normalizedSection = normalizeSectionForStorage(sectionWithUploadedImages);
      const result = activeSavedId
        ? await updateSavedSection({ id: activeSavedId, title: normalizedSection.title, section: normalizedSection })
        : await saveNewSection({ id: targetId, title: normalizedSection.title, section: normalizedSection });

      if (result.status === "success") {
        replacedBlobs.forEach((blobUrl) => revokePendingImageUrl(blobUrl));
        const mapped: SavedSectionWithLabel = {
          ...result.savedSection,
          updatedAtLabel: result.updatedAtLabel,
        };
        setSavedList((prev) => {
          const exists = prev.some((item) => item.id === mapped.id);
          return exists ? prev.map((item) => (item.id === mapped.id ? mapped : item)) : [mapped, ...prev];
        });
        setActiveSavedId(mapped.id);
        setDraftSection(mapped.sectionData);
        setFeedback({
          type: "success",
          message: activeSavedId ? "Đã lưu thay đổi cho section." : "Đã tạo và lưu section mới vào thư viện cá nhân.",
        });
      } else {
        await rollbackUploadedImages(uploadedPaths);
        if (result.status === "table_missing") {
          setFeedback({ type: "warn", message: result.message });
        } else if (result.status === "error") {
          setFeedback({ type: "error", message: result.message });
        }
      }
    });
  }

  function handleDelete(id: string) {
    setFeedback(null);
    startTransition(async () => {
      const result = await deleteSavedSection(id);
      if (result.status === "deleted") {
        const remaining = savedList.filter((item) => item.id !== id);
        setSavedList(remaining);
        if (activeSavedId === id) {
          if (remaining[0]) {
            setActiveSavedId(remaining[0].id);
            setDraftSection(remaining[0].sectionData);
          } else {
            setActiveSavedId(null);
            setDraftSection(createBlankSection());
          }
        }
        setFeedback({ type: "success", message: "Đã xóa section khỏi thư viện cá nhân." });
      } else if (result.status === "error" || result.status === "table_missing") {
        setFeedback({ type: "error", message: result.message });
      }
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
      {/* Header tiêu đề trang */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">
              <Lock className="size-3" /> Riêng tư cá nhân
            </span>
            <span className="text-xs text-slate-400">Chỉ mình bạn nhìn thấy và sử dụng các section này</span>
          </div>
          <h1 className="mt-1.5 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Layers className="size-6 text-violet-600" /> Section đã lưu
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Soạn và chỉnh trực tiếp trên slide như PowerPoint (kèm ảnh nền &amp; độ trong suốt), lưu lại để dùng nhanh trong mọi Thánh lễ.
          </p>
        </div>

        <Link
          href="/editor"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:border-violet-300 hover:text-violet-700"
        >
          Mở trình soạn Thánh lễ →
        </Link>
      </div>

      {tableMissing && (
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p>
            Bảng <code className="rounded bg-amber-100 px-1 py-0.5 font-mono font-bold">public.saved_sections</code> chưa
            được tạo trên Supabase. Hãy chạy mục <strong>5</strong> trong file{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">supabase/schema.sql</code> tại Supabase SQL Editor để
            lưu section lâu dài.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
        {/* Cột trái: Danh sách Section đã lưu cá nhân (gọn gàng, không phân loại) */}
        <aside className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Danh sách ({savedList.length})</h2>
          </div>

          <button
            type="button"
            onClick={startNewSection}
            className="mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-violet-300 bg-violet-50/50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-50"
          >
            <Plus className="size-4" /> Tạo section mới
          </button>

          <div className="relative mb-3">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Tìm section đã lưu..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs text-slate-800 outline-none focus:border-violet-400 focus:bg-white"
            />
          </div>

          <div className="max-h-[540px] flex-1 space-y-1.5 overflow-y-auto pr-0.5">
            {filteredSections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-6 text-center text-xs text-slate-400">
                {savedList.length === 0
                  ? "Chưa có section nào được lưu. Hãy soạn bên phải rồi bấm Lưu section."
                  : "Không tìm thấy section phù hợp."}
              </div>
            ) : (
              filteredSections.map((item) => {
                const selected = item.id === activeSavedId;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors",
                      selected
                        ? "border-violet-300 bg-violet-50 shadow-2xs"
                        : "border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <button type="button" onClick={() => selectSaved(item)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                        <Layers className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-slate-800">{item.title}</span>
                        <span className="block text-[10px] text-slate-400">{item.updatedAtLabel}</span>
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDelete(item.id)}
                      title="Xóa section đã lưu"
                      aria-label={`Xóa ${item.title}`}
                      className="rounded-lg p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Cột phải: Studio chỉnh sửa trực tiếp như PowerPoint */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
            <span className="text-xs font-semibold text-slate-600">
              {activeSavedId ? "Đang chỉnh sửa section đã lưu" : "Đang soạn section mới (chưa lưu)"}
            </span>

            <div className="flex items-center gap-2">
              {activeSavedId && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setActiveSavedId(null);
                    setFeedback(null);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Lưu thành bản mới
                </button>
              )}

              <button
                type="button"
                disabled={isPending}
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-violet-200 transition hover:bg-violet-700 disabled:opacity-60"
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                {activeSavedId ? "Lưu thay đổi" : "Lưu section"}
              </button>
            </div>
          </div>

          {feedback && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-xs font-semibold",
                feedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : feedback.type === "warn"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-rose-200 bg-rose-50 text-rose-700",
              )}
            >
              {feedback.type === "success" ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          <SectionStudioEditor
            key={activeSavedId ?? draftSection.id}
            section={draftSection}
            aspectRatio={aspectRatio}
            themeId={themeId}
            songs={availableSongs}
            onChange={setDraftSection}
            onAspectRatioChange={setAspectRatio}
            onThemeIdChange={setThemeId}
          />
        </section>
      </div>
    </div>
  );
}
