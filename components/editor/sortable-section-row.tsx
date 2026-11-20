"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BookmarkCheck, BookmarkPlus, Copy, GripVertical, Loader2, Trash2 } from "lucide-react";

import { IMAGE_CATEGORY_LABELS, SECTION_META } from "@/components/editor/section-meta";
import type { MassSection } from "@/lib/pptmass-types";
import { cn } from "@/lib/utils";

export function SortableSectionRow({
  section,
  slideCount,
  selected,
  readOnly,
  canDelete,
  isSaved,
  isSaving,
  onSelect,
  onDuplicate,
  onSave,
  onDelete,
}: {
  section: MassSection;
  slideCount: number;
  selected: boolean;
  readOnly: boolean;
  canDelete: boolean;
  isSaved: boolean;
  isSaving: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: readOnly,
  });
  const meta = SECTION_META[section.kind];
  const Icon = meta.icon;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? "none" : transition,
      }}
      className={cn(
        "group flex w-full items-center gap-1.5 rounded-xl border px-2 py-2 transition-colors will-change-transform",
        isDragging
          ? "border-dashed border-violet-300 bg-violet-50/40 opacity-35"
          : selected
            ? "border-violet-300 bg-violet-50 shadow-2xs"
            : "border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50/70",
      )}
    >
      {!readOnly && (
        <span
          className="cursor-grab touch-none rounded p-0.5 text-slate-300 transition-colors group-hover:text-slate-500 active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label="Kéo để thay đổi thứ tự"
        >
          <GripVertical className="size-4" />
        </span>
      )}

      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", meta.color)}>
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-slate-800">{section.title}</span>
          <span className="block text-[11px] text-slate-400">
            {section.kind === "image" ? IMAGE_CATEGORY_LABELS[section.imageCategory ?? "cover"] : meta.label} · {slideCount} slide
          </span>
        </span>
      </button>

      {!readOnly && (
        <div
          className={cn(
            "flex shrink-0 items-center gap-0.5 transition-opacity",
            selected || isSaving ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <button
            type="button"
            onClick={onDuplicate}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-violet-100/70 hover:text-violet-700"
            aria-label={`Nhân đôi ${section.title}`}
            title="Nhân đôi section"
          >
            <Copy className="size-3.5" />
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className={cn(
              "rounded-md p-1 transition-colors disabled:opacity-50",
              isSaved
                ? "text-emerald-600 hover:bg-emerald-50"
                : "text-slate-400 hover:bg-sky-50 hover:text-sky-700",
            )}
            aria-label={`Lưu section ${section.title}`}
            title={isSaved ? "Cập nhật section đã lưu" : "Lưu section cá nhân"}
          >
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : isSaved ? (
              <BookmarkCheck className="size-3.5" />
            ) : (
              <BookmarkPlus className="size-3.5" />
            )}
          </button>

          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
              aria-label={`Xóa ${section.title}`}
              title="Xóa section"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function SectionRowOverlay({ section, slideCount }: { section: MassSection; slideCount: number }) {
  const meta = SECTION_META[section.kind];
  const Icon = meta.icon;

  return (
    <div className="flex w-full scale-[1.02] cursor-grabbing items-center gap-2 rounded-xl border border-violet-400 bg-white px-2.5 py-2 shadow-xl shadow-violet-200/60 ring-2 ring-violet-400/40">
      <GripVertical className="size-4 text-violet-500" />
      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", meta.color)}>
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold text-slate-900">{section.title}</span>
        <span className="block text-[11px] text-slate-400">
          {section.kind === "image" ? IMAGE_CATEGORY_LABELS[section.imageCategory ?? "cover"] : meta.label} · {slideCount} slide
        </span>
      </span>
    </div>
  );
}
