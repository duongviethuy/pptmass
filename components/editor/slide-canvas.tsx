"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

import type { SlideAspectRatio, SlideBackgroundImage } from "@/lib/pptmass-types";
import { SLIDE_FONT_FAMILY, type resolveSlideTheme } from "@/lib/slide-utils";
import { cn } from "@/lib/utils";

/** Khung canvas tự động scale đúng tỉ lệ 1:1 PowerPoint (1280×720 hoặc 960×720) theo bề rộng thực tế. */
export function SlideScaledFrame({
  aspectRatio,
  dims,
  resolvedTheme,
  backgroundImage,
  initialWidthPx = 640,
  className,
  children,
}: {
  aspectRatio: SlideAspectRatio;
  dims: { widthPx: number; heightPx: number };
  resolvedTheme: ReturnType<typeof resolveSlideTheme>;
  backgroundImage?: SlideBackgroundImage;
  initialWidthPx?: number;
  className?: string;
  children: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameScale, setFrameScale] = useState(() => initialWidthPx / dims.widthPx);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    const update = (width: number) => {
      if (width > 0) setFrameScale(width / dims.widthPx);
    };
    update(el.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth;
      update(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [dims.widthPx]);

  return (
    <div
      ref={frameRef}
      className={cn(
        "relative w-full overflow-hidden",
        aspectRatio === "4:3" ? "aspect-[4/3]" : "aspect-video",
        className,
      )}
    >
      <div
        style={{
          ...resolvedTheme.canvasStyle,
          width: dims.widthPx,
          height: dims.heightPx,
          transform: `scale(${frameScale})`,
          transformOrigin: "top left",
          fontFamily: SLIDE_FONT_FAMILY,
        }}
        className={cn("relative overflow-hidden", resolvedTheme.canvasClass, "border-0")}
      >
        {resolvedTheme.overlayClass && <div className={cn("absolute inset-0", resolvedTheme.overlayClass)} />}
        {backgroundImage?.url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={backgroundImage.url}
            alt=""
            style={{ opacity: Math.min(1, Math.max(0, backgroundImage.opacity / 100)) }}
            className={cn(
              "pointer-events-none absolute inset-0 h-full w-full",
              backgroundImage.fit === "contain" ? "object-contain" : "object-cover",
            )}
          />
        )}
        {children}
      </div>
    </div>
  );
}

/** Hình thu nhỏ từng slide trong dải filmstrip phía dưới viewport — hỗ trợ chọn nhiều bằng Shift/Ctrl và kéo thả theo cụm. */
export function SortableSlideThumbnail({
  slideId,
  index,
  totalSlides,
  aspectRatio,
  isActive,
  isSelected = false,
  isInDraggedCluster = false,
  canRemove,
  readOnly,
  onRegisterEl,
  onSelect,
  onDuplicate,
  onRemove,
  children,
}: {
  slideId: string;
  index: number;
  totalSlides: number;
  aspectRatio: SlideAspectRatio;
  isActive: boolean;
  isSelected?: boolean;
  isInDraggedCluster?: boolean;
  canRemove?: boolean;
  readOnly: boolean;
  onRegisterEl: (id: string, el: HTMLDivElement | null) => void;
  onSelect: (event: MouseEvent<HTMLDivElement>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const canDrag = !readOnly && totalSlides > 1;
  const allowDelete = canRemove ?? totalSlides > 1;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: slideId,
    disabled: !canDrag,
  });

  const dimmedByDrag = isDragging || isInDraggedCluster;

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        onRegisterEl(slideId, node);
      }}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: dimmedByDrag ? "none" : transition,
      }}
      className={cn(
        aspectRatio === "4:3" ? "w-[88px]" : "w-[112px]",
        "group/thumb shrink-0 rounded-xl border p-1 transition-colors select-none",
        dimmedByDrag
          ? "border-dashed border-violet-400 bg-violet-50/50 opacity-35"
          : isActive
            ? "border-violet-600 bg-violet-50/80 ring-2 ring-violet-500/35"
            : isSelected
              ? "border-violet-400 bg-violet-50/65 ring-2 ring-violet-400/25"
              : "border-slate-200/90 bg-white hover:border-violet-300",
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-1 px-0.5">
        <div
          {...(canDrag ? attributes : {})}
          {...(canDrag ? listeners : {})}
          onClick={onSelect}
          title={
            canDrag
              ? "Kéo sang trái/phải để đổi thứ tự · Giữ Shift + bấm để chọn nhiều slide"
              : `Slide ${index + 1}`
          }
          className={cn(
            "inline-flex items-center gap-0.5 rounded px-0.5",
            canDrag && "cursor-grab active:cursor-grabbing",
          )}
        >
          {canDrag && <GripVertical className="size-3 text-slate-400" />}
          <span
            className={cn(
              "inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-[10px] font-extrabold",
              isActive
                ? "bg-violet-600 text-white"
                : isSelected
                  ? "bg-violet-500 text-white"
                  : "bg-slate-100 text-slate-600",
            )}
          >
            {index + 1}
          </span>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/thumb:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDuplicate();
              }}
              title="Nhân đôi slide"
              className="flex size-4 items-center justify-center rounded text-slate-400 hover:bg-violet-100 hover:text-violet-700"
            >
              <Copy className="size-2.5" />
            </button>
            {allowDelete && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove();
                }}
                title="Xóa slide"
                className="flex size-4 items-center justify-center rounded text-slate-400 hover:bg-rose-100 hover:text-rose-600"
              >
                <Trash2 className="size-2.5" />
              </button>
            )}
          </div>
        )}
      </div>

      <div
        {...(canDrag ? attributes : {})}
        {...(canDrag ? listeners : {})}
        onClick={onSelect}
        className={cn("overflow-hidden rounded-lg", canDrag ? "cursor-pointer active:cursor-grabbing" : "cursor-pointer")}
      >
        {children}
      </div>
    </div>
  );
}
