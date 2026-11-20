"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  GripVertical,
  Image as ImageIcon,
  Music2,
  Plus,
  Sparkles,
  Trash2,
  Type,
  X,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { readEditableBodyState, setEditableCaret, syncEditableBodyDom } from "@/components/editor/editable-dom";
import { SlideScaledFrame, SortableSlideThumbnail } from "@/components/editor/slide-canvas";
import { SlideInspectorPanel } from "@/components/editor/slide-inspector-panel";
import { registerPendingImageFile, validateLocalImageFile } from "@/lib/pending-images";
import type {
  CustomSlideTheme,
  EditableSlideItem,
  MassSection,
  MassThemeId,
  SlideAspectRatio,
  SlideBackgroundImage,
  SlideFontFamily,
  SlideTextAlign,
  Song,
} from "@/lib/pptmass-types";
import {
  DEFAULT_CUSTOM_THEME,
  MAX_SLIDE_FONT_PT,
  MAX_TITLE_FONT_PT,
  MIN_SLIDE_FONT_PT,
  MIN_TITLE_FONT_PT,
  SLIDE_DPI,
  buildRepeatChorusOrder,
  buildSectionSlides,
  clampLineSpacingPt,
  clampSlideFontPt,
  clampTitleFontPt,
  createEditableSlidesFromSongOrder,
  createEditableSlidesFromSongPart,
  getEffectiveEditableSlides,
  getSlideDimensions,
  getSlideFontOption,
  getSlideLayoutBoxes,
  getSlideTypography,
  getTitleTypography,
  normalizeHexColor,
  reflowEditableSlides,
  reorderEditableSlideCluster,
  resolveSlideTheme,
  resolveSlideVisibility,
  type SlideEditOperation,
} from "@/lib/slide-utils";
import { cn } from "@/lib/utils";

export type SectionStudioEditorProps = {
  section: MassSection;
  aspectRatio: SlideAspectRatio;
  themeId: MassThemeId;
  customTheme?: CustomSlideTheme;
  songs?: Song[];
  onChange: (nextSection: MassSection) => void;
  onAspectRatioChange?: (ratio: SlideAspectRatio) => void;
  onThemeIdChange?: (themeId: MassThemeId) => void;
  /** Áp dụng giao diện slide (themeId + customTheme + ảnh nền nếu có) cho toàn bộ bài trình chiếu (trừ các section Hình ảnh). */
  onApplyThemeToAllSections?: (
    nextThemeId: MassThemeId,
    nextCustomTheme?: CustomSlideTheme,
    nextBgImage?: SlideBackgroundImage,
  ) => void;
  /** Áp dụng toàn bộ cài đặt định dạng (phông, cỡ chữ, giãn dòng, căn lề, màu sắc, giao diện, ảnh nền) cho tất cả slide (trừ section Hình ảnh). */
  onApplyStyleToAllSlides?: (
    sourceSection: Exclude<MassSection, { kind: "image" }>,
    activeBgImage?: SlideBackgroundImage,
  ) => void;
  readOnly?: boolean;
  /** Tiêu đề hiển thị phía trên viewport chính (tuỳ chọn, dùng cho trang /editor). */
  headerSlot?: ReactNode;
  /** Trình cài đặt ảnh tuỳ chỉnh ở cột phải cho section Hình ảnh (VD: áp dụng cho tất cả Ảnh bìa lễ). */
  imageInspectorSlot?: ReactNode;
  /** Chế độ tích hợp trực tiếp làm 2 cột [Giữa | Phải] của trang /editor. */
  workspaceMode?: boolean;
  /** Báo ngược chỉ số slide (0-based) đang hiển thị trong section để hỗ trợ "Bắt đầu trình chiếu từ slide hiện tại". */
  onActiveSlideIndexChange?: (slideIndex: number) => void;
};

/**
 * Trình chỉnh sửa Section trực tiếp phong cách PowerPoint/Canva (1:1 với bản xuất .pptx):
 * - Cột chính (giữa): 1 slide lớn WYSIWYG + dải hình thu nhỏ kéo thả phía dưới (nút < > hiện đại).
 * - Cột phải (Inspector): giao cho `SlideInspectorPanel` (giao diện & ảnh nền, định dạng chữ hợp nhất, đồng bộ).
 * - Chảy chữ 2 chiều (bidirectional reflow) + giữ nguyên căn đều justify & tiền tố câu hát bất biến.
 */
export default function SectionStudioEditor({
  section,
  aspectRatio,
  themeId,
  customTheme,
  songs = [],
  onChange,
  onAspectRatioChange,
  onThemeIdChange,
  onApplyThemeToAllSections,
  onApplyStyleToAllSlides,
  readOnly = false,
  headerSlot,
  imageInspectorSlot,
  workspaceMode = false,
  onActiveSlideIndexChange,
}: SectionStudioEditorProps) {
  const thumbTrackRef = useRef<HTMLDivElement>(null);
  const thumbCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const bodyMirrorRef = useRef<HTMLDivElement>(null);
  const bodyEditableRef = useRef<HTMLDivElement>(null);
  const headingInputRef = useRef<HTMLInputElement>(null);
  const subheadingInputRef = useRef<HTMLInputElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const pendingCursorRef = useRef<{ slideIdx: number; offset: number } | null>(null);
  const isComposingRef = useRef(false);

  const dims = getSlideDimensions(aspectRatio);
  const [draggingSlideId, setDraggingSlideId] = useState<string | null>(null);
  const [draggingClusterIds, setDraggingClusterIds] = useState<string[]>([]);
  const [slideSelection, setSlideSelection] = useState<{
    sectionId: string;
    ids: string[];
    anchorId: string | null;
  }>({ sectionId: section.id, ids: [], anchorId: null });
  const [activeTarget, setActiveTarget] = useState<"title" | "body">("body");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingSubheading, setIsEditingSubheading] = useState(false);
  const [isEditingBody, setIsEditingBody] = useState(false);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [cursorSyncTick, setCursorSyncTick] = useState(0);
  const [themeFeedback, setThemeFeedback] = useState<string | null>(null);
  const [allSettingsFeedback, setAllSettingsFeedback] = useState<string | null>(null);
  const [showBgUploader, setShowBgUploader] = useState(false);
  const [isBodyOverflowing, setIsBodyOverflowing] = useState(false);
  const [canScrollThumbLeft, setCanScrollThumbLeft] = useState(false);
  const [canScrollThumbRight, setCanScrollThumbRight] = useState(false);

  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const thumbSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Section Hình ảnh hoàn toàn độc lập, luôn dùng nền trắng trung tính và không bị ảnh hưởng bởi Giao diện slide
  const effectiveThemeId: MassThemeId = section.kind === "image" ? "pure-white" : (section.themeId ?? themeId);
  const effectiveCustomTheme: CustomSlideTheme =
    section.kind === "image" ? DEFAULT_CUSTOM_THEME : (section.customTheme ?? customTheme ?? DEFAULT_CUSTOM_THEME);
  const resolvedTheme = resolveSlideTheme(effectiveThemeId, effectiveCustomTheme);
  const linkedSong = useMemo(
    () => (section.kind === "song" ? songs.find((item) => item.id === section.songId) : undefined),
    [section, songs],
  );

  // Danh sách slide đã luôn được reflow 2 chiều để không tràn viewport
  const editableSlides = useMemo(() => {
    if (section.kind === "image") return [];
    const base = getEffectiveEditableSlides(section, linkedSong, aspectRatio);
    return reflowEditableSlides(
      base,
      section,
      aspectRatio,
      undefined,
      activeSlideIdx,
      isEditingBody ? activeSlideIdx : undefined,
    ).slides;
  }, [section, linkedSong, aspectRatio, activeSlideIdx, isEditingBody]);

  const previewSlides = useMemo(
    () => buildSectionSlides(section, linkedSong, aspectRatio),
    [section, linkedSong, aspectRatio],
  );

  const safeSlideIdx =
    section.kind === "image" ? 0 : Math.min(activeSlideIdx, Math.max(0, editableSlides.length - 1));
  const activeEditableSlide: EditableSlideItem | undefined = editableSlides[safeSlideIdx];
  const currentPreviewSlide = previewSlides[safeSlideIdx];

  const selectedOrderedIds = useMemo(() => {
    if (section.kind === "image" || editableSlides.length === 0) return [];
    if (slideSelection.sectionId === section.id && slideSelection.ids.length > 0) {
      const pickedSet = new Set(slideSelection.ids);
      const validOrdered = editableSlides.filter((s) => pickedSet.has(s.id)).map((s) => s.id);
      if (validOrdered.length > 0) return validOrdered;
    }
    return activeEditableSlide ? [activeEditableSlide.id] : [];
  }, [section.kind, section.id, editableSlides, slideSelection, activeEditableSlide]);

  const selectedIdSet = useMemo(() => new Set(selectedOrderedIds), [selectedOrderedIds]);
  const hasMultiSelection = selectedOrderedIds.length > 1;
  const draggingClusterSet = useMemo(() => new Set(draggingClusterIds), [draggingClusterIds]);
  const selectionAnchorIdx = useMemo(() => {
    if (slideSelection.sectionId === section.id && slideSelection.anchorId) {
      const found = editableSlides.findIndex((s) => s.id === slideSelection.anchorId);
      if (found >= 0) return found;
    }
    return safeSlideIdx;
  }, [slideSelection, section.id, editableSlides, safeSlideIdx]);

  useEffect(() => {
    if (!hasMultiSelection) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        const activeId = activeEditableSlide?.id ?? null;
        setSlideSelection({ sectionId: section.id, ids: activeId ? [activeId] : [], anchorId: activeId });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasMultiSelection, activeEditableSlide?.id, section.id]);

  useEffect(() => {
    onActiveSlideIndexChange?.(safeSlideIdx);
  }, [safeSlideIdx, onActiveSlideIndexChange]);

  const titleFont: SlideFontFamily =
    section.kind === "text"
      ? (section.titleFontFamily ?? section.style.titleFontFamily ?? "Arial")
      : section.kind !== "image"
        ? (section.style.titleFontFamily ?? "Arial")
        : "Arial";
  const bodyFont: SlideFontFamily = section.kind !== "image" ? (section.style.fontFamily ?? "Arial") : "Arial";

  const { showHeading: showHeadingOnActiveSlide, showBody: showBodyOnActiveSlide } =
    section.kind === "image" || !activeEditableSlide
      ? { showHeading: false, showBody: false }
      : resolveSlideVisibility(section, activeEditableSlide, safeSlideIdx);

  // Slide tiêu đề riêng (chỉ hiện tiêu đề, ẩn nội dung) có cỡ chữ mặc định là 70pt
  const isActiveSlideTitleOnly = showHeadingOnActiveSlide && !showBodyOnActiveSlide;
  const rawCustomTitlePt =
    section.kind === "text"
      ? (section.titleFontSizePt ?? section.style.titleFontSizePt)
      : section.kind !== "image"
        ? section.style.titleFontSizePt
        : undefined;
  const rawCustomTitleLinePt =
    section.kind === "text"
      ? (section.titleLineSpacingPt ?? section.style.titleLineSpacingPt)
      : section.kind !== "image"
        ? section.style.titleLineSpacingPt
        : undefined;

  const titleTypo =
    isActiveSlideTitleOnly && rawCustomTitlePt === undefined
      ? getTitleTypography("xlarge", 70, rawCustomTitleLinePt)
      : section.kind === "text"
        ? getTitleTypography(section.titleFontSize ?? "large", rawCustomTitlePt, rawCustomTitleLinePt)
        : section.kind !== "image"
          ? getTitleTypography("large", rawCustomTitlePt, rawCustomTitleLinePt)
          : getTitleTypography("large");

  const bodyTypo =
    section.kind !== "image"
      ? getSlideTypography(section.style.fontSize, section.style.fontSizePt, section.style.lineSpacingPt)
      : getSlideTypography("xlarge");

  const titleAlign: SlideTextAlign =
    section.kind === "text"
      ? (section.titleAlign ?? section.style.titleAlign ?? "center")
      : section.kind !== "image"
        ? (section.style.titleAlign ?? "center")
        : "center";
  const bodyAlign: SlideTextAlign = section.kind !== "image" ? (section.style.textAlign ?? "justify") : "justify";

  const titleColor =
    section.kind === "text"
      ? (section.titleColor ?? section.style.titleColor)
      : section.kind !== "image"
        ? section.style.titleColor
        : undefined;
  const bodyColor =
    section.kind === "text"
      ? (section.contentColor ?? section.style.contentColor)
      : section.kind !== "image"
        ? section.style.contentColor
        : undefined;

  const boxes = getSlideLayoutBoxes(
    aspectRatio,
    section.kind === "image" ? true : showHeadingOnActiveSlide,
    section.kind === "image" ? false : showBodyOnActiveSlide,
  );
  const bodyBoxHeightPx = (boxes.bodyBox?.h ?? 5.4) * SLIDE_DPI;

  const activeBgImage = activeEditableSlide?.backgroundImage;
  const showPartPrefix = section.kind === "song";
  const activeHeadingValue = activeEditableSlide?.heading ?? section.title;
  const activeSubheadingValue = activeEditableSlide?.subheading ?? "";
  const showSubheadingOnActiveSlide = Boolean(
    showHeadingOnActiveSlide && !showBodyOnActiveSlide && activeEditableSlide?.showSubheading,
  );
  const subheadingPt = Math.max(20, Math.round(titleTypo.fontSizePt * 0.65));
  const subheadingLinePt = Math.max(24, Math.round(subheadingPt * 1.2));
  const activeBodyValue = activeEditableSlide?.body ?? "";
  const activeBodyPrefix = showPartPrefix ? activeEditableSlide?.bodyPrefix : undefined;

  // Đo tràn khung thực tế trên slide hiện tại (dự phòng khi font/glyph cực lớn vượt khung)
  useEffect(() => {
    const mirror = bodyMirrorRef.current;
    if (!mirror || !showBodyOnActiveSlide) {
      setIsBodyOverflowing(false);
      return;
    }

    const checkOverflow = () => {
      setIsBodyOverflowing(mirror.scrollHeight > bodyBoxHeightPx + 6);
    };

    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(mirror);
    return () => observer.disconnect();
  }, [
    showBodyOnActiveSlide,
    bodyBoxHeightPx,
    activeEditableSlide?.body,
    activeBodyPrefix,
    bodyTypo.fontSizePt,
    bodyTypo.lineSpacingPt,
    bodyFont,
    bodyAlign,
    aspectRatio,
  ]);

  const effectiveTarget: "title" | "body" =
    activeTarget === "title" && showHeadingOnActiveSlide ? "title" : showBodyOnActiveSlide ? "body" : "title";

  const ribbonFont = effectiveTarget === "title" ? titleFont : bodyFont;
  const ribbonPt = effectiveTarget === "title" ? titleTypo.fontSizePt : bodyTypo.fontSizePt;
  const ribbonMinPt = effectiveTarget === "title" ? MIN_TITLE_FONT_PT : MIN_SLIDE_FONT_PT;
  const ribbonMaxPt = effectiveTarget === "title" ? MAX_TITLE_FONT_PT : MAX_SLIDE_FONT_PT;
  const ribbonLinePt = effectiveTarget === "title" ? titleTypo.lineSpacingPt : bodyTypo.lineSpacingPt;
  const ribbonMinLinePt = Math.max(16, Math.round(ribbonPt * 0.85));
  const ribbonMaxLinePt = Math.round(ribbonPt * 2.5);
  const ribbonAlign = effectiveTarget === "title" ? titleAlign : bodyAlign;
  const ribbonColor = effectiveTarget === "title" ? titleColor : bodyColor;
  const ribbonDefaultHex = effectiveTarget === "title" ? "#dc2626" : "#0f172a";
  const pickerColor = normalizeHexColor(ribbonColor ?? ribbonDefaultHex, ribbonDefaultHex);

  // Đồng bộ DOM của khung contentEditable (giữ 100% căn đều justify + tiền tố ĐK:/1./2. bất biến) và phục hồi con trỏ
  useLayoutEffect(() => {
    if (readOnly || section.kind === "image" || !showBodyOnActiveSlide) return;
    const el = bodyEditableRef.current;
    if (!el || isComposingRef.current) return;

    const prefixClassName = cn("select-none", !titleColor && resolvedTheme.titleClass);
    const didRebuild = syncEditableBodyDom(el, activeBodyValue, activeBodyPrefix, prefixClassName, titleColor);

    const pending = pendingCursorRef.current;
    if (pending && pending.slideIdx === safeSlideIdx) {
      pendingCursorRef.current = null;
      if (document.activeElement !== el) {
        el.focus();
      }
      setEditableCaret(el, pending.offset);
    } else if (didRebuild && document.activeElement === el) {
      setEditableCaret(el, activeBodyValue.length);
    }
  }, [
    readOnly,
    section.kind,
    showBodyOnActiveSlide,
    safeSlideIdx,
    activeBodyValue,
    activeBodyPrefix,
    titleColor,
    resolvedTheme.titleClass,
    editableSlides.length,
    cursorSyncTick,
  ]);

  // Theo dõi khả năng trượt trái/phải của dải hình thu nhỏ
  useEffect(() => {
    const track = thumbTrackRef.current;
    if (!track || section.kind === "image") return;

    const syncScrollState = () => {
      setCanScrollThumbLeft(track.scrollLeft > 4);
      setCanScrollThumbRight(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
    };

    syncScrollState();
    track.addEventListener("scroll", syncScrollState, { passive: true });
    const observer = new ResizeObserver(syncScrollState);
    observer.observe(track);
    return () => {
      track.removeEventListener("scroll", syncScrollState);
      observer.disconnect();
    };
  }, [section.kind, editableSlides.length, aspectRatio]);

  // Tự động trượt dải hình thu nhỏ đưa thumbnail đang chọn vào khung nhìn
  useEffect(() => {
    if (section.kind === "image" || draggingSlideId) return;
    const track = thumbTrackRef.current;
    const activeId = activeEditableSlide?.id;
    const card = activeId ? thumbCardRefs.current.get(activeId) : undefined;
    if (!track || !card) return;

    const cardLeft = card.offsetLeft;
    const cardRight = cardLeft + card.offsetWidth;
    if (cardLeft < track.scrollLeft) {
      track.scrollTo({ left: Math.max(0, cardLeft - 8), behavior: "smooth" });
    } else if (cardRight > track.scrollLeft + track.clientWidth) {
      track.scrollTo({ left: cardRight - track.clientWidth + 8, behavior: "smooth" });
    }
  }, [section.kind, activeEditableSlide?.id, editableSlides.length, draggingSlideId]);

  function scrollThumbTrack(direction: -1 | 1) {
    const track = thumbTrackRef.current;
    if (!track) return;
    const step = Math.max(240, Math.round(track.clientWidth * 0.72));
    track.scrollBy({ left: direction * step, behavior: "smooth" });
  }

  function registerThumbEl(id: string, el: HTMLDivElement | null) {
    if (el) {
      thumbCardRefs.current.set(id, el);
    } else {
      thumbCardRefs.current.delete(id);
    }
  }

  function selectSlide(idx: number, focusBody = false) {
    if (editableSlides.length === 0) {
      setActiveSlideIdx(0);
      setSlideSelection({ sectionId: section.id, ids: [], anchorId: null });
      setIsEditingBody(false);
      return;
    }
    const clamped = Math.min(Math.max(0, idx), editableSlides.length - 1);
    setActiveSlideIdx(clamped);
    const targetSlide = editableSlides[clamped];
    if (targetSlide) {
      setSlideSelection({ sectionId: section.id, ids: [targetSlide.id], anchorId: targetSlide.id });
    }
    if (targetSlide?.showBody === false) {
      setActiveTarget("title");
      setIsEditingBody(false);
      return;
    }
    if (focusBody && !readOnly) {
      const targetBody = targetSlide?.body ?? "";
      pendingCursorRef.current = { slideIdx: clamped, offset: targetBody.length };
      setCursorSyncTick((tick) => tick + 1);
      setActiveTarget("body");
      setIsEditingBody(true);
    } else {
      setActiveTarget("body");
      setIsEditingBody(false);
    }
  }

  function handleThumbnailClick(idx: number, event: MouseEvent<HTMLDivElement>) {
    const clicked = editableSlides[idx];
    if (!clicked) return;

    // Giữ Shift + bấm: chọn toàn bộ dải slide từ điểm neo đến slide vừa bấm
    if (event.shiftKey && !readOnly) {
      event.preventDefault();
      const start = Math.min(selectionAnchorIdx, idx);
      const end = Math.max(selectionAnchorIdx, idx);
      const rangeIds = editableSlides.slice(start, end + 1).map((s) => s.id);
      const anchorId = editableSlides[selectionAnchorIdx]?.id ?? clicked.id;
      setSlideSelection({ sectionId: section.id, ids: rangeIds, anchorId });
      setActiveSlideIdx(idx);
      setIsEditingBody(false);
      return;
    }

    // Giữ Ctrl/Cmd + bấm: thêm hoặc bỏ chọn từng slide riêng lẻ
    if ((event.ctrlKey || event.metaKey) && !readOnly) {
      event.preventDefault();
      const nextSet = new Set(selectedIdSet);
      let nextActiveIdx = idx;
      if (nextSet.has(clicked.id)) {
        if (nextSet.size > 1) {
          nextSet.delete(clicked.id);
          const remainingFirstIdx = editableSlides.findIndex((s) => nextSet.has(s.id));
          nextActiveIdx = remainingFirstIdx >= 0 ? remainingFirstIdx : 0;
        }
      } else {
        nextSet.add(clicked.id);
      }
      const nextOrdered = editableSlides.filter((s) => nextSet.has(s.id)).map((s) => s.id);
      const nextAnchorId = editableSlides[nextActiveIdx]?.id ?? nextOrdered[0] ?? null;
      setSlideSelection({ sectionId: section.id, ids: nextOrdered, anchorId: nextAnchorId });
      setActiveSlideIdx(nextActiveIdx);
      setIsEditingBody(false);
      return;
    }

    selectSlide(idx, true);
  }

  function clearMultiSelection() {
    const activeId = activeEditableSlide?.id ?? null;
    setSlideSelection({ sectionId: section.id, ids: activeId ? [activeId] : [], anchorId: activeId });
  }

  function commitSlides(nextSlides: EditableSlideItem[], extraPatch?: Partial<MassSection>) {
    if (readOnly || section.kind === "image") return;
    const candidateSection =
      section.kind === "text"
        ? {
            ...section,
            ...(extraPatch as Partial<Extract<MassSection, { kind: "text" }>>),
            slides: nextSlides,
            content: nextSlides[0]?.body ?? section.content,
          }
        : section.kind === "prayer"
          ? {
              ...section,
              ...(extraPatch as Partial<Extract<MassSection, { kind: "prayer" }>>),
              slides: nextSlides,
            }
          : {
              ...section,
              ...(extraPatch as Partial<Extract<MassSection, { kind: "song" }>>),
              slides: nextSlides,
            };

    const { slides: reflowedSlides, targetSlideIndex, didMerge } = reflowEditableSlides(
      nextSlides,
      candidateSection,
      aspectRatio,
      undefined,
      safeSlideIdx,
    );
    if (didMerge) {
      setActiveSlideIdx(targetSlideIndex);
    }

    if (candidateSection.kind === "text") {
      onChange({ ...candidateSection, slides: reflowedSlides, content: reflowedSlides[0]?.body ?? candidateSection.content });
      return;
    }
    onChange({ ...candidateSection, slides: reflowedSlides });
  }

  function updateActiveSlide(patch: Partial<EditableSlideItem>) {
    if (readOnly || section.kind === "image" || editableSlides.length === 0) return;
    const nextSlides = editableSlides.map((item, idx) => (idx === safeSlideIdx ? { ...item, ...patch } : item));
    commitSlides(nextSlides);
  }

  function runBodyEditOp(op: SlideEditOperation) {
    if (readOnly || section.kind === "image" || editableSlides.length === 0) return;
    const result = reflowEditableSlides(editableSlides, section, aspectRatio, op);

    if (section.kind === "text") {
      onChange({ ...section, slides: result.slides, content: result.slides[0]?.body ?? section.content });
    } else {
      onChange({ ...section, slides: result.slides });
    }

    if (result.targetCursorOffset !== null) {
      pendingCursorRef.current = { slideIdx: result.targetSlideIndex, offset: result.targetCursorOffset };
      setCursorSyncTick((tick) => tick + 1);
    }
    if (result.targetSlideIndex !== safeSlideIdx) {
      setActiveSlideIdx(result.targetSlideIndex);
    }
    setIsEditingBody(true);
  }

  function handleEditableBodyInput() {
    if (isComposingRef.current) return;
    const el = bodyEditableRef.current;
    if (!el) return;
    const { text, start } = readEditableBodyState(el);
    runBodyEditOp({
      kind: "replaceBody",
      slideIndex: safeSlideIdx,
      nextBody: text,
      cursorOffset: start,
    });
  }

  function handleEditableBodyPaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const el = bodyEditableRef.current;
    if (!el) return;
    const pasted = event.clipboardData.getData("text/plain").replace(/\r\n/g, "\n");
    const { text, start, end } = readEditableBodyState(el);
    const nextBody = text.slice(0, start) + pasted + text.slice(end);
    runBodyEditOp({
      kind: "replaceBody",
      slideIndex: safeSlideIdx,
      nextBody,
      cursorOffset: start + pasted.length,
    });
  }

  function handleEditableBodyMouseUp() {
    const el = bodyEditableRef.current;
    if (!el || !activeBodyPrefix) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const prefixEl = el.querySelector('[data-slide-prefix="true"]');
    if (
      prefixEl &&
      (prefixEl.contains(range.startContainer) || (range.startContainer === el && range.startOffset === 0))
    ) {
      setEditableCaret(el, 0);
    }
  }

  function handleEditableBodyKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing || isComposingRef.current) return;
    if (event.key === "Escape") {
      event.currentTarget.blur();
      setIsEditingBody(false);
      return;
    }

    const el = event.currentTarget;
    const { text, start, end } = readEditableBodyState(el);
    const hasSelection = start !== end;

    if (event.key === "Enter") {
      event.preventDefault();
      const nextBody = text.slice(0, start) + "\n" + text.slice(end);
      runBodyEditOp({
        kind: "replaceBody",
        slideIndex: safeSlideIdx,
        nextBody,
        cursorOffset: start + 1,
      });
      return;
    }

    if (hasSelection) return;

    if (event.key === "Delete" && start === text.length && safeSlideIdx < editableSlides.length - 1) {
      event.preventDefault();
      runBodyEditOp({ kind: "forwardDeleteAtEnd", slideIndex: safeSlideIdx });
      return;
    }

    if (event.key === "Backspace" && start === 0) {
      event.preventDefault();
      if (safeSlideIdx > 0 && !activeBodyPrefix) {
        runBodyEditOp({ kind: "backspaceAtStart", slideIndex: safeSlideIdx });
      }
      return;
    }

    if (event.key === "ArrowRight" && start === text.length && safeSlideIdx < editableSlides.length - 1) {
      event.preventDefault();
      pendingCursorRef.current = { slideIdx: safeSlideIdx + 1, offset: 0 };
      setCursorSyncTick((tick) => tick + 1);
      setActiveSlideIdx(safeSlideIdx + 1);
      setIsEditingBody(true);
      return;
    }

    if (event.key === "ArrowLeft" && start === 0) {
      event.preventDefault();
      if (safeSlideIdx > 0) {
        const prevLen = editableSlides[safeSlideIdx - 1]?.body.length ?? 0;
        pendingCursorRef.current = { slideIdx: safeSlideIdx - 1, offset: prevLen };
        setCursorSyncTick((tick) => tick + 1);
        setActiveSlideIdx(safeSlideIdx - 1);
        setIsEditingBody(true);
      }
    }
  }

  function commitStyleChange(nextSection: Exclude<MassSection, { kind: "image" }>) {
    const { slides: reflowedSlides, targetSlideIndex } = reflowEditableSlides(
      editableSlides,
      nextSection,
      aspectRatio,
      undefined,
      safeSlideIdx,
    );
    setActiveSlideIdx(targetSlideIndex);

    if (nextSection.kind === "text") {
      onChange({ ...nextSection, slides: reflowedSlides, content: reflowedSlides[0]?.body ?? nextSection.content });
      return;
    }
    onChange({ ...nextSection, slides: reflowedSlides });
  }

  function updateRibbonFont(nextFont: SlideFontFamily) {
    if (readOnly || section.kind === "image") return;
    if (effectiveTarget === "title") {
      if (section.kind === "text") {
        onChange({ ...section, titleFontFamily: nextFont, style: { ...section.style, titleFontFamily: nextFont } });
      } else {
        onChange({ ...section, style: { ...section.style, titleFontFamily: nextFont } });
      }
      return;
    }
    commitStyleChange({ ...section, style: { ...section.style, fontFamily: nextFont } });
  }

  function updateRibbonPt(nextPt: number) {
    if (readOnly || section.kind === "image") return;
    if (effectiveTarget === "title") {
      const clamped = clampTitleFontPt(nextPt);
      const scaledLine =
        typeof rawCustomTitleLinePt === "number"
          ? clampLineSpacingPt(Math.round(clamped * (titleTypo.lineSpacingPt / titleTypo.fontSizePt)), clamped)
          : undefined;
      if (section.kind === "text") {
        onChange({
          ...section,
          titleFontSizePt: clamped,
          titleLineSpacingPt: scaledLine,
          style: { ...section.style, titleFontSizePt: clamped, titleLineSpacingPt: scaledLine },
        });
      } else {
        onChange({
          ...section,
          style: { ...section.style, titleFontSizePt: clamped, titleLineSpacingPt: scaledLine },
        });
      }
      return;
    }
    const clamped = clampSlideFontPt(nextPt);
    const scaledLine =
      typeof section.style.lineSpacingPt === "number"
        ? clampLineSpacingPt(Math.round(clamped * (bodyTypo.lineSpacingPt / bodyTypo.fontSizePt)), clamped)
        : undefined;
    commitStyleChange({ ...section, style: { ...section.style, fontSizePt: clamped, lineSpacingPt: scaledLine } });
  }

  function updateRibbonLinePt(nextLinePt: number) {
    if (readOnly || section.kind === "image") return;
    const clamped = clampLineSpacingPt(nextLinePt, ribbonPt);
    if (effectiveTarget === "title") {
      if (section.kind === "text") {
        onChange({
          ...section,
          titleLineSpacingPt: clamped,
          style: { ...section.style, titleLineSpacingPt: clamped },
        });
      } else {
        onChange({ ...section, style: { ...section.style, titleLineSpacingPt: clamped } });
      }
      return;
    }
    commitStyleChange({ ...section, style: { ...section.style, lineSpacingPt: clamped } });
  }

  function selectSectionTheme(nextThemeId: MassThemeId) {
    if (readOnly || section.kind === "image") return;
    setThemeFeedback(null);
    setAllSettingsFeedback(null);
    if (onThemeIdChange && !workspaceMode && !onApplyThemeToAllSections) {
      onThemeIdChange(nextThemeId);
    }
    onChange({
      ...section,
      themeId: nextThemeId,
      customTheme: nextThemeId === "custom" ? { ...effectiveCustomTheme } : undefined,
    });
  }

  function updateSectionCustomTheme(patch: Partial<CustomSlideTheme>) {
    if (readOnly || section.kind === "image") return;
    setThemeFeedback(null);
    setAllSettingsFeedback(null);
    onChange({
      ...section,
      themeId: "custom",
      customTheme: { ...effectiveCustomTheme, ...patch },
    });
  }

  function handleApplyThemeToCurrentSection() {
    if (readOnly || section.kind === "image") return;
    const targetBg = activeBgImage ? { ...activeBgImage } : undefined;
    const syncedSlides = editableSlides.map((s) => ({
      ...s,
      backgroundImage: targetBg ? { ...targetBg } : undefined,
    }));
    onChange({
      ...section,
      themeId: effectiveThemeId,
      customTheme: effectiveThemeId === "custom" ? { ...effectiveCustomTheme } : undefined,
      slides: syncedSlides,
    });
    setThemeFeedback(
      targetBg
        ? `Đã áp dụng giao diện & ảnh nền (${targetBg.opacity}%) cho cả ${syncedSlides.length} slide trong section này.`
        : `Đã áp dụng giao diện cho cả ${syncedSlides.length} slide trong section này.`,
    );
  }

  function handleApplyThemeToAll() {
    if (readOnly || section.kind === "image") return;
    const targetBg = activeBgImage ? { ...activeBgImage } : undefined;
    const syncedSlides = editableSlides.map((s) => ({
      ...s,
      backgroundImage: targetBg ? { ...targetBg } : undefined,
    }));
    onChange({
      ...section,
      themeId: effectiveThemeId,
      customTheme: effectiveThemeId === "custom" ? { ...effectiveCustomTheme } : undefined,
      slides: syncedSlides,
    });
    if (onApplyThemeToAllSections) {
      onApplyThemeToAllSections(
        effectiveThemeId,
        effectiveThemeId === "custom" ? { ...effectiveCustomTheme } : undefined,
        targetBg,
      );
      setThemeFeedback("Đã áp dụng giao diện & ảnh nền cho toàn bộ bài trình chiếu.");
    }
  }

  function handleApplyAllSettingsToAllSlides() {
    if (readOnly || section.kind === "image") return;
    const targetBg = activeBgImage ? { ...activeBgImage } : undefined;
    const syncedSlides = editableSlides.map((s) => ({
      ...s,
      backgroundImage: targetBg ? { ...targetBg } : undefined,
    }));
    const updatedSection: Exclude<MassSection, { kind: "image" }> = {
      ...section,
      themeId: effectiveThemeId,
      customTheme: effectiveThemeId === "custom" ? { ...effectiveCustomTheme } : undefined,
      slides: syncedSlides,
    };
    onChange(updatedSection);
    if (onApplyStyleToAllSlides) {
      onApplyStyleToAllSlides(updatedSection, targetBg);
      setAllSettingsFeedback("Đã áp dụng toàn bộ cài đặt định dạng cho tất cả slide trong bài trình chiếu!");
    } else {
      setAllSettingsFeedback(`Đã đồng bộ cài đặt cho tất cả ${syncedSlides.length} slide trong section!`);
    }
  }

  function updateRibbonAlign(nextAlign: SlideTextAlign) {
    if (readOnly || section.kind === "image") return;
    if (effectiveTarget === "title") {
      if (section.kind === "text") {
        onChange({ ...section, titleAlign: nextAlign, style: { ...section.style, titleAlign: nextAlign } });
      } else {
        onChange({ ...section, style: { ...section.style, titleAlign: nextAlign } });
      }
      return;
    }
    onChange({ ...section, style: { ...section.style, textAlign: nextAlign } });
  }

  function updateRibbonColor(nextColor: string | undefined) {
    if (readOnly || section.kind === "image") return;
    if (effectiveTarget === "title") {
      if (section.kind === "text") {
        onChange({ ...section, titleColor: nextColor, style: { ...section.style, titleColor: nextColor } });
      } else {
        onChange({ ...section, style: { ...section.style, titleColor: nextColor } });
      }
      return;
    }
    if (section.kind === "text") {
      onChange({ ...section, contentColor: nextColor, style: { ...section.style, contentColor: nextColor } });
    } else {
      onChange({ ...section, style: { ...section.style, contentColor: nextColor } });
    }
  }

  // Nhận diện chế độ Tiêu đề hiện tại của section:
  // 1) `hasDedicatedTitleSlide`: Slide 1 là slide tiêu đề riêng (chỉ có tiêu đề, ẩn nội dung), các slide sau ẩn tiêu đề.
  // 2) `hasFirstSlideInlineTitle`: Slide 1 hiện cả tiêu đề lẫn nội dung, các slide sau ẩn tiêu đề.
  const firstSlideVis =
    section.kind !== "image" && editableSlides.length >= 1
      ? resolveSlideVisibility(section, editableSlides[0], 0)
      : { showHeading: false, showBody: false };
  const hasDedicatedTitleSlide = firstSlideVis.showHeading && !firstSlideVis.showBody;
  const hasFirstSlideInlineTitle = firstSlideVis.showHeading && firstSlideVis.showBody;

  function toggleDedicatedTitleSlide() {
    if (readOnly || section.kind === "image") return;

    if (hasDedicatedTitleSlide) {
      const remaining =
        editableSlides.length > 1
          ? editableSlides.slice(1).map((s) => ({ ...s, showHeading: false, showBody: true }))
          : [{ ...editableSlides[0], showHeading: false, showBody: true }];
      commitSlides(remaining, {
        ...(section.kind === "text" ? { showTitle: false } : {}),
        style: { ...section.style, showTitleOnEverySlide: false },
      } as Partial<MassSection>);
      setActiveSlideIdx(0);
      setActiveTarget("body");
      return;
    }

    const titleSlide: EditableSlideItem = {
      id: `title-${crypto.randomUUID().slice(0, 8)}`,
      heading: section.title,
      showHeading: true,
      body: "",
      showBody: false,
      backgroundImage: activeBgImage
        ? { ...activeBgImage }
        : editableSlides[0]?.backgroundImage
          ? { ...editableSlides[0].backgroundImage }
          : undefined,
      flowWithPrev: false,
    };
    const bodySlides = editableSlides.map((s) => ({
      ...s,
      showHeading: false,
      showBody: true,
    }));
    commitSlides([titleSlide, ...bodySlides], {
      ...(section.kind === "text" ? { showTitle: true } : {}),
      style: { ...section.style, showTitleOnEverySlide: false },
    } as Partial<MassSection>);
    setActiveSlideIdx(0);
    setActiveTarget("title");
    setIsEditingBody(false);
  }

  function toggleFirstSlideInlineTitle() {
    if (readOnly || section.kind === "image" || editableSlides.length === 0) return;

    if (hasFirstSlideInlineTitle) {
      const nextSlides = editableSlides.map((s) => ({ ...s, showHeading: false, showBody: true }));
      commitSlides(nextSlides, {
        ...(section.kind === "text" ? { showTitle: false } : {}),
        style: { ...section.style, showTitleOnEverySlide: false },
      } as Partial<MassSection>);
      setActiveTarget("body");
      return;
    }

    const baseBodySlides =
      hasDedicatedTitleSlide && editableSlides.length > 1 ? editableSlides.slice(1) : editableSlides;
    const nextSlides = baseBodySlides.map((s, idx) => ({
      ...s,
      showHeading: idx === 0,
      showBody: true,
    }));
    commitSlides(nextSlides, {
      ...(section.kind === "text" ? { showTitle: true } : {}),
      style: { ...section.style, showTitleOnEverySlide: false },
    } as Partial<MassSection>);
    setActiveSlideIdx(0);
  }

  function stageLocalImage(file: File): string | null {
    const validationError = validateLocalImageFile(file);
    if (validationError) {
      setUploadError(validationError);
      return null;
    }
    setUploadError(null);
    return registerPendingImageFile(file);
  }

  function handleMainImageUpload(file: File) {
    if (readOnly || section.kind !== "image") return;
    const blobUrl = stageLocalImage(file);
    if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    if (blobUrl) onChange({ ...section, imageUrl: blobUrl });
  }

  function handleBgImageUpload(file: File) {
    if (readOnly || section.kind === "image") return;
    const blobUrl = stageLocalImage(file);
    if (bgFileInputRef.current) bgFileInputRef.current.value = "";
    if (!blobUrl) return;

    const nextBg: SlideBackgroundImage = {
      url: blobUrl,
      opacity: activeBgImage?.opacity ?? 25,
      fit: activeBgImage?.fit ?? "cover",
    };
    setThemeFeedback(null);
    setAllSettingsFeedback(null);
    setShowBgUploader(true);
    updateActiveSlide({ backgroundImage: nextBg });
  }

  function updateActiveBg(patch: Partial<SlideBackgroundImage>) {
    if (readOnly || section.kind === "image" || !activeBgImage) return;
    setThemeFeedback(null);
    setAllSettingsFeedback(null);
    updateActiveSlide({ backgroundImage: { ...activeBgImage, ...patch } });
  }

  function handleImageDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingImage(false);
    if (readOnly || section.kind !== "image") return;
    const file = event.dataTransfer.files?.[0];
    if (file) handleMainImageUpload(file);
  }

  function handleThumbDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id);
    setDraggingSlideId(activeId);
    setIsEditingBody(false);

    if (selectedIdSet.has(activeId) && selectedOrderedIds.length > 1) {
      setDraggingClusterIds(selectedOrderedIds);
    } else {
      setDraggingClusterIds([activeId]);
      setSlideSelection({ sectionId: section.id, ids: [activeId], anchorId: activeId });
    }
  }

  function handleThumbDragEnd(event: DragEndEvent) {
    const movedClusterIds = draggingClusterIds;
    setDraggingSlideId(null);
    setDraggingClusterIds([]);
    if (readOnly || section.kind === "image") return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const clusterSet = new Set(movedClusterIds.length > 0 ? movedClusterIds : [activeId]);
    const reordered = reorderEditableSlideCluster(editableSlides, clusterSet, activeId, overId);
    if (reordered === editableSlides) return;

    if (section.kind === "text") {
      onChange({ ...section, slides: reordered, content: reordered[0]?.body ?? section.content });
    } else {
      onChange({ ...section, slides: reordered });
    }

    const nextActiveIdx = reordered.findIndex((item) => item.id === activeId);
    setActiveSlideIdx(nextActiveIdx >= 0 ? nextActiveIdx : 0);
    if (clusterSet.size > 1) {
      const nextOrderedIds = reordered.filter((item) => clusterSet.has(item.id)).map((item) => item.id);
      setSlideSelection({ sectionId: section.id, ids: nextOrderedIds, anchorId: activeId });
    } else {
      setSlideSelection({ sectionId: section.id, ids: [activeId], anchorId: activeId });
    }
  }

  function addBlankSlideAfterCurrent() {
    if (readOnly || section.kind === "image") return;
    const isEmpty = editableSlides.length === 0;
    const newSlide: EditableSlideItem = {
      id: `slide-${crypto.randomUUID()}`,
      showHeading: isEmpty ? true : section.style.showTitleOnEverySlide,
      body: "",
      showBody: true,
      backgroundImage: activeBgImage ? { ...activeBgImage } : undefined,
      flowWithPrev: false,
    };
    const nextIdx = isEmpty ? 0 : safeSlideIdx + 1;
    const nextSlides = [...editableSlides];
    nextSlides.splice(nextIdx, 0, newSlide);
    commitSlides(nextSlides);
    setSlideSelection({ sectionId: section.id, ids: [newSlide.id], anchorId: newSlide.id });
    pendingCursorRef.current = { slideIdx: nextIdx, offset: 0 };
    setCursorSyncTick((tick) => tick + 1);
    setActiveSlideIdx(nextIdx);
    setIsEditingBody(true);
    setActiveTarget("body");
  }

  function duplicateSlideAt(targetIdx: number) {
    if (readOnly || section.kind === "image") return;
    const source = editableSlides[targetIdx];
    if (!source) return;
    const cloned: EditableSlideItem = {
      ...source,
      id: `slide-${crypto.randomUUID()}`,
      backgroundImage: source.backgroundImage ? { ...source.backgroundImage } : undefined,
      flowWithPrev: false,
      joinSeparator: undefined,
    };
    const nextSlides = [...editableSlides];
    nextSlides.splice(targetIdx + 1, 0, cloned);
    commitSlides(nextSlides);
    setSlideSelection({ sectionId: section.id, ids: [cloned.id], anchorId: cloned.id });
    setActiveSlideIdx(targetIdx + 1);
  }

  function duplicateSelectedSlides() {
    if (readOnly || section.kind === "image" || selectedOrderedIds.length === 0) return;
    let lastSelectedIdx = -1;
    const clones: EditableSlideItem[] = [];
    editableSlides.forEach((slide, idx) => {
      if (!selectedIdSet.has(slide.id)) return;
      lastSelectedIdx = idx;
      clones.push({
        ...slide,
        id: `slide-${crypto.randomUUID()}`,
        backgroundImage: slide.backgroundImage ? { ...slide.backgroundImage } : undefined,
        flowWithPrev: false,
        joinSeparator: undefined,
      });
    });
    if (clones.length === 0 || lastSelectedIdx < 0) return;
    const insertIdx = lastSelectedIdx + 1;
    const nextSlides = [...editableSlides];
    nextSlides.splice(insertIdx, 0, ...clones);
    commitSlides(nextSlides);
    const clonedIds = clones.map((s) => s.id);
    setSlideSelection({ sectionId: section.id, ids: clonedIds, anchorId: clonedIds[0] ?? null });
    setActiveSlideIdx(insertIdx);
    setIsEditingBody(false);
  }

  function removeSlideAt(targetIdx: number) {
    const minSlides = section.kind === "song" ? 0 : 1;
    if (readOnly || section.kind === "image" || editableSlides.length <= minSlides) return;
    const nextSlides = editableSlides.filter((_, idx) => idx !== targetIdx);
    commitSlides(nextSlides);
    const nextActiveIdx =
      nextSlides.length === 0
        ? 0
        : safeSlideIdx > targetIdx
          ? safeSlideIdx - 1
          : Math.min(safeSlideIdx, nextSlides.length - 1);
    const nextActiveId = nextSlides[nextActiveIdx]?.id ?? null;
    setActiveSlideIdx(nextActiveIdx);
    setSlideSelection({ sectionId: section.id, ids: nextActiveId ? [nextActiveId] : [], anchorId: nextActiveId });
    setIsEditingBody(false);
  }

  function removeSelectedSlides() {
    if (readOnly || section.kind === "image" || selectedOrderedIds.length === 0) return;
    const minSlides = section.kind === "song" ? 0 : 1;
    const remaining = editableSlides.filter((s) => !selectedIdSet.has(s.id));
    if (remaining.length < minSlides) return;

    const firstDeletedIdx = editableSlides.findIndex((s) => selectedIdSet.has(s.id));
    commitSlides(remaining);
    const nextActiveIdx =
      remaining.length === 0 ? 0 : Math.min(Math.max(0, firstDeletedIdx), remaining.length - 1);
    const nextActiveId = remaining[nextActiveIdx]?.id ?? null;
    setActiveSlideIdx(nextActiveIdx);
    setSlideSelection({ sectionId: section.id, ids: nextActiveId ? [nextActiveId] : [], anchorId: nextActiveId });
    setIsEditingBody(false);
  }

  function appendSongPartSlides(partId: string) {
    if (readOnly || section.kind !== "song" || !linkedSong) return;
    const part = linkedSong.parts.find((item) => item.id === partId);
    if (!part) return;
    // Khi section bài hát đang rỗng -> tự động bật Tiêu đề ở slide đầu tiên vừa tạo
    const showHeadingOnFirst = editableSlides.length === 0 ? true : Boolean(section.style.showTitleOnEverySlide);
    const addedSlides = createEditableSlidesFromSongPart(
      linkedSong,
      part,
      section.style,
      aspectRatio,
      `song-${crypto.randomUUID().slice(0, 8)}`,
      showHeadingOnFirst,
    );
    const syncedSlides = activeBgImage
      ? addedSlides.map((s) => ({ ...s, backgroundImage: { ...activeBgImage } }))
      : addedSlides;
    const insertStartIdx = editableSlides.length;
    commitSlides([...editableSlides, ...syncedSlides]);
    const firstAddedId = syncedSlides[0]?.id ?? null;
    setSlideSelection({ sectionId: section.id, ids: firstAddedId ? [firstAddedId] : [], anchorId: firstAddedId });
    setActiveSlideIdx(insertStartIdx);
    setIsEditingBody(false);
  }

  function applyRepeatChorusSlides() {
    if (readOnly || section.kind !== "song" || !linkedSong) return;
    const repeatedOrder = buildRepeatChorusOrder(linkedSong.parts);
    const firstSlideHasHeading =
      editableSlides.length === 0 ? true : hasDedicatedTitleSlide ? false : hasFirstSlideInlineTitle;
    const generatedSlides = createEditableSlidesFromSongOrder(
      linkedSong,
      repeatedOrder,
      section.style,
      aspectRatio,
      `song-${crypto.randomUUID().slice(0, 8)}`,
      firstSlideHasHeading,
    );
    const syncedGenerated = activeBgImage
      ? generatedSlides.map((s) => ({ ...s, backgroundImage: { ...activeBgImage } }))
      : generatedSlides;
    const nextSlides = hasDedicatedTitleSlide ? [editableSlides[0], ...syncedGenerated] : syncedGenerated;
    commitSlides(nextSlides, { partOrder: repeatedOrder });
    const firstId = nextSlides[0]?.id ?? null;
    setSlideSelection({ sectionId: section.id, ids: firstId ? [firstId] : [], anchorId: firstId });
    setActiveSlideIdx(0);
    setIsEditingBody(false);
  }

  function renderStaticSlideContent(slideItem: EditableSlideItem, idx: number) {
    if (section.kind === "image") return null;
    const { showHeading, showBody } = resolveSlideVisibility(section, slideItem, idx);
    const slideBoxes = getSlideLayoutBoxes(aspectRatio, showHeading, showBody);
    const headingText = (slideItem.heading ?? section.title).trim();
    const subheadingText =
      showHeading && !showBody && slideItem.showSubheading ? (slideItem.subheading ?? "").trim() : "";
    const bodyText = slideItem.body ?? "";
    const prefixText = showPartPrefix ? slideItem.bodyPrefix : undefined;
    const isTitleOnly = showHeading && !showBody;
    const staticTitleTypo =
      isTitleOnly && rawCustomTitlePt === undefined
        ? getTitleTypography("xlarge", 70, rawCustomTitleLinePt)
        : titleTypo;
    const staticSubheadingPt = Math.max(20, Math.round(staticTitleTypo.fontSizePt * 0.65));
    const staticSubheadingLinePt = Math.max(24, Math.round(staticSubheadingPt * 1.2));

    return (
      <>
        {showHeading && slideBoxes.headingBox && (
          <div
            style={{
              left: slideBoxes.headingBox.x * SLIDE_DPI,
              top: slideBoxes.headingBox.y * SLIDE_DPI,
              width: slideBoxes.headingBox.w * SLIDE_DPI,
              height: slideBoxes.headingBox.h * SLIDE_DPI,
            }}
            className="absolute flex flex-col items-center justify-center gap-3"
          >
            <p
              className={cn(
                "w-full font-bold uppercase",
                !titleColor && resolvedTheme.titleClass,
                !headingText && "opacity-35",
              )}
              style={{
                fontFamily: getSlideFontOption(titleFont).cssFont,
                fontSize: `${staticTitleTypo.fontSizePt}pt`,
                lineHeight: `${staticTitleTypo.lineSpacingPt}pt`,
                textAlign: titleAlign,
                ...(titleColor ? { color: titleColor } : {}),
              }}
            >
              {headingText || "TIÊU ĐỀ..."}
            </p>
            {subheadingText && (
              <p
                className={cn("w-full font-bold", !bodyColor && resolvedTheme.bodyClass)}
                style={{
                  fontFamily: getSlideFontOption(titleFont).cssFont,
                  fontSize: `${staticSubheadingPt}pt`,
                  lineHeight: `${staticSubheadingLinePt}pt`,
                  textAlign: titleAlign,
                  ...(bodyColor ? { color: bodyColor } : {}),
                }}
              >
                {subheadingText}
              </p>
            )}
          </div>
        )}

        {showBody && slideBoxes.bodyBox && (
          <div
            style={{
              left: slideBoxes.bodyBox.x * SLIDE_DPI,
              top: slideBoxes.bodyBox.y * SLIDE_DPI,
              width: slideBoxes.bodyBox.w * SLIDE_DPI,
              height: slideBoxes.bodyBox.h * SLIDE_DPI,
            }}
            className="absolute flex items-center justify-center overflow-hidden"
          >
            {bodyText.trim() || prefixText ? (
              <p
                className={cn(
                  "w-full break-words whitespace-pre-wrap font-bold",
                  !bodyColor && resolvedTheme.bodyClass,
                )}
                style={{
                  fontFamily: getSlideFontOption(bodyFont).cssFont,
                  fontSize: `${bodyTypo.fontSizePt}pt`,
                  lineHeight: `${bodyTypo.lineSpacingPt}pt`,
                  textAlign: bodyAlign,
                  ...(bodyColor ? { color: bodyColor } : {}),
                }}
              >
                {prefixText && (
                  <span
                    className={cn(!titleColor && resolvedTheme.titleClass)}
                    style={titleColor ? { color: titleColor } : undefined}
                  >
                    {prefixText}{" "}
                  </span>
                )}
                {bodyText}
              </p>
            ) : (
              <p className={cn("opacity-45", resolvedTheme.mutedClass)} style={{ fontSize: "28pt", lineHeight: "36pt" }}>
                Slide trống
              </p>
            )}
          </div>
        )}
      </>
    );
  }

  const draggingSlideIdx = draggingSlideId ? editableSlides.findIndex((s) => s.id === draggingSlideId) : -1;
  const draggingSlide = draggingSlideIdx >= 0 ? editableSlides[draggingSlideIdx] : undefined;

  return (
    <div
      className={cn(
        "grid grid-cols-1",
        workspaceMode
          ? "min-h-full lg:grid-cols-[minmax(0,1fr)_295px] xl:grid-cols-[minmax(0,1fr)_330px]"
          : "gap-4 lg:grid-cols-[minmax(0,1fr)_305px]",
      )}
    >
      {/* Cột chính (Giữa): 1 Slide duy nhất WYSIWYG + Dải hình thu nhỏ kéo thả */}
      <div
        className={cn(
          "flex min-w-0 flex-col",
          workspaceMode ? "border-b border-slate-200 p-3 sm:p-4 lg:border-b-0" : "space-y-2.5",
        )}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-2.5">
          {/* Thanh trên cùng: Tiêu đề section + 2 chế độ Tiêu đề */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {headerSlot ? <div className="min-w-0 flex-1">{headerSlot}</div> : <div />}

            {section.kind !== "image" && !readOnly && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleDedicatedTitleSlide}
                  title="Tạo 1 slide tiêu đề riêng ở đầu section; các slide tiếp theo sẽ không hiển thị tiêu đề nữa"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-bold transition",
                    hasDedicatedTitleSlide
                      ? "border-violet-600 bg-violet-600 text-white shadow-2xs"
                      : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700",
                  )}
                >
                  <Plus className="size-3" /> Thêm slide tiêu đề
                </button>

                <button
                  type="button"
                  disabled={editableSlides.length === 0}
                  onClick={toggleFirstSlideInlineTitle}
                  title="Hiển thị tiêu đề ở ngay trên đầu slide đầu tiên; các slide tiếp theo không hiển thị tiêu đề"
                  className={cn(
                    "inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40",
                    hasFirstSlideInlineTitle
                      ? "border-violet-600 bg-violet-600 text-white shadow-2xs"
                      : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700",
                  )}
                >
                  <Type className="size-3" /> Tiêu đề ở slide đầu
                </button>
              </div>
            )}
          </div>

          {/* Viewport chính: luôn hiển thị DUY NHẤT 1 slide lớn sắc nét */}
          <div className="relative rounded-2xl border border-slate-200/80 bg-slate-100/90 p-2.5 sm:p-3.5">
            {section.kind === "image" ? (
              <div className={cn("mx-auto w-full", aspectRatio === "4:3" ? "max-w-[440px]" : "max-w-[580px]")}>
                <SlideScaledFrame
                  aspectRatio={aspectRatio}
                  dims={dims}
                  resolvedTheme={resolvedTheme}
                  initialWidthPx={aspectRatio === "4:3" ? 440 : 580}
                  className="rounded-[14px] border border-slate-200/80 shadow-xl shadow-slate-300/60"
                >
                  {section.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={section.imageUrl}
                      alt={section.title || "Ảnh Thánh lễ"}
                      className={cn(
                        "absolute inset-0 h-full w-full",
                        (section.imageFit ?? "cover") === "contain" ? "object-contain" : "object-cover",
                      )}
                    />
                  ) : (
                    <div
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (!readOnly) setIsDraggingImage(true);
                      }}
                      onDragLeave={() => setIsDraggingImage(false)}
                      onDrop={handleImageDrop}
                      onClick={() => !readOnly && imageFileInputRef.current?.click()}
                      className={cn(
                        "absolute inset-12 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-4 border-dashed text-center transition",
                        isDraggingImage
                          ? "border-violet-500 bg-violet-50/80"
                          : "border-slate-300/80 bg-white/60 hover:border-violet-400",
                      )}
                    >
                      <ImageIcon className={cn("mb-5 size-24", resolvedTheme.titleClass)} />
                      <p className="font-bold" style={{ fontSize: "40pt", lineHeight: "50pt" }}>
                        Bấm hoặc kéo thả ảnh vào slide
                      </p>
                      <p className={cn("mt-3", resolvedTheme.mutedClass)} style={{ fontSize: "24pt", lineHeight: "32pt" }}>
                        Hỗ trợ JPG, PNG, WebP, GIF (≤ 10MB) · Chỉ tải lên Bunny khi bấm Lưu slide
                      </p>
                    </div>
                  )}
                </SlideScaledFrame>
              </div>
            ) : (
              <div className="relative flex items-center justify-center gap-2 sm:gap-3">
                {editableSlides.length > 1 && (
                  <button
                    type="button"
                    disabled={safeSlideIdx <= 0}
                    onClick={() => selectSlide(safeSlideIdx - 1)}
                    aria-label="Slide trước"
                    title="Slide trước"
                    className="hidden size-9 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 disabled:pointer-events-none disabled:opacity-30 sm:flex"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                )}

                <div className={cn("w-full min-w-0", aspectRatio === "4:3" ? "max-w-[440px]" : "max-w-[580px]")}>
                  <SlideScaledFrame
                    aspectRatio={aspectRatio}
                    dims={dims}
                    resolvedTheme={resolvedTheme}
                    backgroundImage={activeBgImage}
                    initialWidthPx={aspectRatio === "4:3" ? 440 : 580}
                    className="rounded-[14px] border border-slate-200/80 shadow-xl shadow-slate-300/60"
                  >
                    {editableSlides.length === 0 ? (
                      <div className="absolute inset-10 flex flex-col items-center justify-center rounded-3xl border-4 border-dashed border-slate-300/80 bg-white/70 px-12 text-center">
                        <Music2 className={cn("mb-5 size-24 opacity-80", resolvedTheme.titleClass)} />
                        <p className="font-bold text-slate-800" style={{ fontSize: "38pt", lineHeight: "48pt" }}>
                          Section bài hát đang trống
                        </p>
                        <p className="mt-3 max-w-[900px] text-slate-500" style={{ fontSize: "24pt", lineHeight: "34pt" }}>
                          Chọn các phần lời bên dưới (Phiên khúc, Điệp khúc, Rải ĐK xen kẽ) hoặc bấm &ldquo;+ Thêm slide&rdquo; để bắt đầu tạo slide.
                        </p>
                      </div>
                    ) : !readOnly ? (
                      <>
                        {showHeadingOnActiveSlide && boxes.headingBox && (
                          <div
                            onClick={(event) => {
                              setActiveTarget("title");
                              setIsEditingBody(false);
                              if (event.target === event.currentTarget) {
                                headingInputRef.current?.focus();
                              }
                            }}
                            style={{
                              left: boxes.headingBox.x * SLIDE_DPI,
                              top: boxes.headingBox.y * SLIDE_DPI,
                              width: boxes.headingBox.w * SLIDE_DPI,
                              height: boxes.headingBox.h * SLIDE_DPI,
                            }}
                            className={cn(
                              "absolute flex cursor-text flex-col items-center justify-center gap-4 rounded-xl transition-shadow",
                              isEditingTitle && "ring-2 ring-violet-500/80 ring-dashed",
                            )}
                          >
                            <div className="relative w-full px-2">
                              <input
                                ref={headingInputRef}
                                value={activeHeadingValue}
                                onFocus={() => {
                                  setActiveTarget("title");
                                  setIsEditingTitle(true);
                                  setIsEditingBody(false);
                                }}
                                onBlur={() => setIsEditingTitle(false)}
                                onChange={(event) => {
                                  const val = event.target.value;
                                  if (safeSlideIdx === 0 && activeEditableSlide?.heading === undefined) {
                                    onChange({ ...section, title: val });
                                  } else {
                                    updateActiveSlide({ heading: val });
                                  }
                                }}
                                placeholder="BẤM ĐỂ NHẬP TIÊU ĐỀ..."
                                className={cn(
                                  "w-full bg-transparent font-bold uppercase outline-none placeholder:opacity-35",
                                  !titleColor && resolvedTheme.titleClass,
                                )}
                                style={{
                                  fontFamily: getSlideFontOption(titleFont).cssFont,
                                  fontSize: `${titleTypo.fontSizePt}pt`,
                                  lineHeight: `${titleTypo.lineSpacingPt}pt`,
                                  textAlign: titleAlign,
                                  ...(titleColor ? { color: titleColor } : {}),
                                }}
                              />

                              {!showBodyOnActiveSlide &&
                                !showSubheadingOnActiveSlide &&
                                (isEditingTitle || isEditingSubheading) && (
                                  <button
                                    type="button"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      updateActiveSlide({ showSubheading: true });
                                      setTimeout(() => subheadingInputRef.current?.focus(), 0);
                                    }}
                                    title="Thêm tiêu đề phụ ở dưới tiêu đề chính"
                                    aria-label="Thêm tiêu đề phụ"
                                    className="absolute right-4 -bottom-11 z-10 inline-flex items-center gap-1.5 rounded-full border border-violet-300 bg-white/95 px-3.5 py-1 text-[18px] font-bold text-violet-700 shadow-md transition hover:scale-105 hover:border-violet-500 hover:bg-violet-50"
                                  >
                                    <Plus className="size-5 stroke-[2.5]" />
                                    <span>Tiêu đề phụ</span>
                                  </button>
                                )}
                            </div>

                            {!showBodyOnActiveSlide && showSubheadingOnActiveSlide && (
                              <div
                                onClick={(event) => {
                                  event.stopPropagation();
                                  subheadingInputRef.current?.focus();
                                }}
                                className={cn(
                                  "relative mt-2 w-[88%] rounded-2xl px-6 py-3 transition",
                                  isEditingSubheading || isEditingTitle
                                    ? "border-2 border-dashed border-violet-400/75 bg-black/5"
                                    : "border-2 border-transparent",
                                )}
                              >
                                {(isEditingSubheading || isEditingTitle) && (
                                  <button
                                    type="button"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setIsEditingSubheading(false);
                                      updateActiveSlide({ showSubheading: false, subheading: "" });
                                    }}
                                    title="Tắt tiêu đề phụ"
                                    aria-label="Tắt tiêu đề phụ"
                                    className="absolute -top-4 -right-4 z-10 flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:scale-110 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                                  >
                                    <X className="size-4 stroke-[2.5]" />
                                  </button>
                                )}

                                <input
                                  ref={subheadingInputRef}
                                  value={activeSubheadingValue}
                                  onFocus={() => {
                                    setActiveTarget("title");
                                    setIsEditingSubheading(true);
                                    setIsEditingBody(false);
                                  }}
                                  onBlur={() => setIsEditingSubheading(false)}
                                  onChange={(event) => updateActiveSlide({ subheading: event.target.value })}
                                  placeholder="Nhập tiêu đề phụ..."
                                  className={cn(
                                    "w-full bg-transparent font-bold outline-none placeholder:opacity-40",
                                    !bodyColor && resolvedTheme.bodyClass,
                                  )}
                                  style={{
                                    fontFamily: getSlideFontOption(titleFont).cssFont,
                                    fontSize: `${subheadingPt}pt`,
                                    lineHeight: `${subheadingLinePt}pt`,
                                    textAlign: titleAlign,
                                    ...(bodyColor ? { color: bodyColor } : {}),
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {showBodyOnActiveSlide && boxes.bodyBox && (
                          <div
                            onClick={(event) => {
                              setActiveTarget("body");
                              if (event.target === event.currentTarget) {
                                const el = bodyEditableRef.current;
                                if (el) {
                                  el.focus();
                                  setEditableCaret(el, activeBodyValue.length);
                                }
                                setIsEditingBody(true);
                              }
                            }}
                            style={{
                              left: boxes.bodyBox.x * SLIDE_DPI,
                              top: boxes.bodyBox.y * SLIDE_DPI,
                              width: boxes.bodyBox.w * SLIDE_DPI,
                              height: boxes.bodyBox.h * SLIDE_DPI,
                            }}
                            className={cn(
                              "absolute flex cursor-text justify-center overflow-hidden rounded-xl transition-shadow",
                              isBodyOverflowing ? "items-start ring-4 ring-amber-500/90 ring-dashed" : "items-center",
                              !isBodyOverflowing && isEditingBody && "ring-2 ring-violet-500/80 ring-dashed",
                            )}
                          >
                            <div
                              ref={bodyMirrorRef}
                              aria-hidden
                              className="pointer-events-none invisible absolute inset-x-0 top-0 break-words whitespace-pre-wrap font-bold"
                              style={{
                                fontFamily: getSlideFontOption(bodyFont).cssFont,
                                fontSize: `${bodyTypo.fontSizePt}pt`,
                                lineHeight: `${bodyTypo.lineSpacingPt}pt`,
                                textAlign: bodyAlign,
                              }}
                            >
                              {activeBodyPrefix ? `${activeBodyPrefix} ` : ""}
                              {activeBodyValue || " "}
                            </div>

                            {!activeBodyValue && !activeBodyPrefix && (
                              <p
                                className={cn(
                                  "pointer-events-none absolute inset-x-0 text-center opacity-45",
                                  resolvedTheme.mutedClass,
                                )}
                                style={{ fontSize: "28pt", lineHeight: "36pt" }}
                              >
                                {currentPreviewSlide?.emptyHint ?? "Bấm vào đây để gõ nội dung slide..."}
                              </p>
                            )}
                            <div
                              ref={bodyEditableRef}
                              contentEditable
                              suppressContentEditableWarning
                              role="textbox"
                              aria-multiline="true"
                              aria-label="Nội dung slide"
                              spellCheck={false}
                              onFocus={() => {
                                setActiveTarget("body");
                                setIsEditingBody(true);
                              }}
                              onBlur={() => setIsEditingBody(false)}
                              onMouseUp={handleEditableBodyMouseUp}
                              onCompositionStart={() => {
                                isComposingRef.current = true;
                              }}
                              onCompositionEnd={() => {
                                isComposingRef.current = false;
                                handleEditableBodyInput();
                              }}
                              onKeyDown={handleEditableBodyKeyDown}
                              onPaste={handleEditableBodyPaste}
                              onInput={handleEditableBodyInput}
                              className={cn(
                                "w-full break-words whitespace-pre-wrap font-bold outline-none",
                                !bodyColor && resolvedTheme.bodyClass,
                              )}
                              style={{
                                fontFamily: getSlideFontOption(bodyFont).cssFont,
                                fontSize: `${bodyTypo.fontSizePt}pt`,
                                lineHeight: `${bodyTypo.lineSpacingPt}pt`,
                                textAlign: bodyAlign,
                                ...(bodyColor ? { color: bodyColor } : {}),
                              }}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      activeEditableSlide && renderStaticSlideContent(activeEditableSlide, safeSlideIdx)
                    )}
                  </SlideScaledFrame>
                </div>

                {editableSlides.length > 1 && (
                  <button
                    type="button"
                    disabled={safeSlideIdx >= editableSlides.length - 1}
                    onClick={() => selectSlide(safeSlideIdx + 1)}
                    aria-label="Slide kế tiếp"
                    title="Slide kế tiếp"
                    className="hidden size-9 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 disabled:pointer-events-none disabled:opacity-30 sm:flex"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                )}
              </div>
            )}

            {section.kind !== "image" && isBodyOverflowing && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                <span>Một từ quá dài vượt khung slide — hãy giảm nhẹ cỡ chữ (`pt`) để chữ nằm gọn trong khung chiếu.</span>
              </div>
            )}
          </div>

          {/* Dải hình thu nhỏ (Thumbnail Filmstrip) */}
          {section.kind !== "image" && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-2xs">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    {editableSlides.length === 0
                      ? "Chưa có slide nào"
                      : `Slide ${safeSlideIdx + 1} / ${editableSlides.length}`}
                  </span>
                  {!readOnly && hasMultiSelection ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                        Đang chọn {selectedOrderedIds.length} slide
                      </span>
                      <button
                        type="button"
                        onClick={duplicateSelectedSlides}
                        title="Nhân đôi cụm slide đang chọn"
                        className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2 py-0.5 text-[11px] font-bold text-violet-700 transition hover:bg-violet-50"
                      >
                        <Copy className="size-3" /> Nhân đôi
                      </button>
                      {(section.kind === "song" || selectedOrderedIds.length < editableSlides.length) && (
                        <button
                          type="button"
                          onClick={removeSelectedSlides}
                          title="Xóa các slide đang chọn"
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-0.5 text-[11px] font-bold text-rose-600 transition hover:bg-rose-50"
                        >
                          <Trash2 className="size-3" /> Xóa ({selectedOrderedIds.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={clearMultiSelection}
                        title="Bỏ chọn nhiều slide (Esc)"
                        className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
                      >
                        <X className="size-3" /> Bỏ chọn
                      </button>
                    </div>
                  ) : !readOnly && editableSlides.length > 1 ? (
                    <span className="hidden text-[11px] text-slate-400 sm:inline">
                      Giữ Shift + bấm để chọn nhiều slide · Kéo thả để đổi vị trí cả cụm
                    </span>
                  ) : null}
                </div>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={addBlankSlideAfterCurrent}
                    className="inline-flex items-center gap-1 rounded-lg border border-dashed border-violet-300 bg-violet-50/60 px-2.5 py-1 text-[11px] font-bold text-violet-700 transition hover:bg-violet-100/80"
                  >
                    <Plus className="size-3" /> Thêm slide
                  </button>
                )}
              </div>

              {editableSlides.length === 0 ? (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-4 text-center text-xs text-slate-400">
                  Chưa có slide nào — hãy chọn phần lời ở hàng bên dưới để bắt đầu thêm slide.
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!canScrollThumbLeft}
                    onClick={() => scrollThumbTrack(-1)}
                    aria-label="Trượt danh sách slide sang trái"
                    title="Trượt sang trái"
                    className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronLeft className="size-4" />
                  </button>

                  <div className="min-w-0 flex-1 overflow-hidden">
                    <DndContext
                      sensors={thumbSensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleThumbDragStart}
                      onDragEnd={handleThumbDragEnd}
                      onDragCancel={() => {
                        setDraggingSlideId(null);
                        setDraggingClusterIds([]);
                      }}
                    >
                      <SortableContext
                        items={editableSlides.map((s) => s.id)}
                        strategy={horizontalListSortingStrategy}
                      >
                        <div
                          ref={thumbTrackRef}
                          className="flex gap-2.5 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        >
                          {editableSlides.map((slideItem, idx) => (
                            <SortableSlideThumbnail
                              key={slideItem.id}
                              slideId={slideItem.id}
                              index={idx}
                              totalSlides={editableSlides.length}
                              aspectRatio={aspectRatio}
                              isActive={idx === safeSlideIdx}
                              isSelected={selectedIdSet.has(slideItem.id)}
                              isInDraggedCluster={Boolean(draggingSlideId && draggingClusterSet.has(slideItem.id))}
                              canRemove={section.kind === "song" || editableSlides.length > 1}
                              readOnly={readOnly}
                              onRegisterEl={registerThumbEl}
                              onSelect={(event) => handleThumbnailClick(idx, event)}
                              onDuplicate={() => duplicateSlideAt(idx)}
                              onRemove={() => removeSlideAt(idx)}
                            >
                              <SlideScaledFrame
                                aspectRatio={aspectRatio}
                                dims={dims}
                                resolvedTheme={resolvedTheme}
                                backgroundImage={slideItem.backgroundImage}
                                initialWidthPx={aspectRatio === "4:3" ? 80 : 102}
                                className="rounded-lg border border-slate-200/80"
                              >
                                {renderStaticSlideContent(slideItem, idx)}
                              </SlideScaledFrame>
                            </SortableSlideThumbnail>
                          ))}
                        </div>
                      </SortableContext>

                      <DragOverlay dropAnimation={null}>
                        {draggingSlide && draggingSlideIdx >= 0 ? (
                          <div className="relative">
                            {draggingClusterIds.length > 2 && (
                              <div
                                aria-hidden
                                className={cn(
                                  aspectRatio === "4:3" ? "w-[88px]" : "w-[112px]",
                                  "pointer-events-none absolute inset-0 translate-x-2 translate-y-2 rotate-2 rounded-xl border border-violet-300 bg-violet-50/90 shadow-md",
                                )}
                              />
                            )}
                            {draggingClusterIds.length > 1 && (
                              <div
                                aria-hidden
                                className={cn(
                                  aspectRatio === "4:3" ? "w-[88px]" : "w-[112px]",
                                  "pointer-events-none absolute inset-0 translate-x-1 translate-y-1 rotate-1 rounded-xl border border-violet-400 bg-white shadow-md",
                                )}
                              />
                            )}
                            <div
                              className={cn(
                                aspectRatio === "4:3" ? "w-[88px]" : "w-[112px]",
                                "relative rounded-xl border-2 border-violet-500 bg-white p-1 shadow-xl",
                              )}
                            >
                              <div className="mb-1 flex items-center justify-between gap-1 px-0.5">
                                <div className="inline-flex items-center gap-0.5">
                                  <GripVertical className="size-3 text-violet-500" />
                                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-violet-600 px-1 text-[10px] font-extrabold text-white">
                                    {draggingSlideIdx + 1}
                                  </span>
                                </div>
                                {draggingClusterIds.length > 1 && (
                                  <span className="inline-flex h-4 items-center rounded-full bg-violet-600 px-1.5 text-[9px] font-extrabold text-white shadow-xs">
                                    {draggingClusterIds.length} slide
                                  </span>
                                )}
                              </div>
                              <SlideScaledFrame
                                aspectRatio={aspectRatio}
                                dims={dims}
                                resolvedTheme={resolvedTheme}
                                backgroundImage={draggingSlide.backgroundImage}
                                initialWidthPx={aspectRatio === "4:3" ? 80 : 102}
                                className="rounded-lg border border-slate-200/80"
                              >
                                {renderStaticSlideContent(draggingSlide, draggingSlideIdx)}
                              </SlideScaledFrame>
                            </div>
                          </div>
                        ) : null}
                      </DragOverlay>
                    </DndContext>
                  </div>

                  <button
                    type="button"
                    disabled={!canScrollThumbRight}
                    onClick={() => scrollThumbTrack(1)}
                    aria-label="Trượt danh sách slide sang phải"
                    title="Trượt sang phải"
                    className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}

              {/* Chèn thêm lời từ bài hát & Rải ĐK xen kẽ */}
              {section.kind === "song" && linkedSong && !readOnly && (
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-0.5 text-[11px] font-bold text-slate-400">Chèn thêm lời:</span>
                    {linkedSong.parts.map((part) => (
                      <button
                        key={part.id}
                        type="button"
                        onClick={() => appendSongPartSlides(part.id)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition",
                          part.kind === "chorus"
                            ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700",
                        )}
                      >
                        <Plus className="size-3" /> {part.label}
                      </button>
                    ))}
                  </div>

                  {linkedSong.parts.length > 1 && (
                    <button
                      type="button"
                      onClick={applyRepeatChorusSlides}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-700 transition hover:bg-violet-100"
                      title="Đổ lại thứ tự hát Điệp khúc xen kẽ sau mỗi Phiên khúc"
                    >
                      <Sparkles className="size-3" /> Rải ĐK xen kẽ
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cột phải (Inspector) đã module hóa */}
      <SlideInspectorPanel
        section={section}
        aspectRatio={aspectRatio}
        readOnly={readOnly}
        workspaceMode={workspaceMode}
        effectiveTarget={effectiveTarget}
        effectiveThemeId={effectiveThemeId}
        effectiveCustomTheme={effectiveCustomTheme}
        activeBgImage={activeBgImage}
        showBgUploader={showBgUploader}
        onToggleBgUploader={() => setShowBgUploader((prev) => !prev)}
        ribbonFont={ribbonFont}
        ribbonPt={ribbonPt}
        ribbonMinPt={ribbonMinPt}
        ribbonMaxPt={ribbonMaxPt}
        ribbonLinePt={ribbonLinePt}
        ribbonMinLinePt={ribbonMinLinePt}
        ribbonMaxLinePt={ribbonMaxLinePt}
        ribbonAlign={ribbonAlign}
        ribbonColor={ribbonColor}
        pickerColor={pickerColor}
        themeFeedback={themeFeedback}
        allSettingsFeedback={allSettingsFeedback}
        isUploadingImage={false}
        uploadError={uploadError}
        hasApplyThemeToAll={Boolean(onApplyThemeToAllSections)}
        imageInspectorSlot={imageInspectorSlot}
        imageFileInputRef={imageFileInputRef}
        bgFileInputRef={bgFileInputRef}
        onChangeSection={onChange}
        onAspectRatioChange={onAspectRatioChange}
        onMainImageFile={handleMainImageUpload}
        onBgImageFile={handleBgImageUpload}
        onSelectTheme={selectSectionTheme}
        onUpdateCustomTheme={updateSectionCustomTheme}
        onUpdateActiveBg={updateActiveBg}
        onClearActiveBg={() => {
          setThemeFeedback(null);
          setAllSettingsFeedback(null);
          updateActiveSlide({ backgroundImage: undefined });
        }}
        onApplyThemeToCurrentSection={handleApplyThemeToCurrentSection}
        onApplyThemeToAll={handleApplyThemeToAll}
        onUpdateFont={updateRibbonFont}
        onUpdatePt={updateRibbonPt}
        onUpdateLinePt={updateRibbonLinePt}
        onUpdateAlign={updateRibbonAlign}
        onUpdateColor={updateRibbonColor}
        onApplyAllSettingsToAllSlides={handleApplyAllSettingsToAllSlides}
      />
    </div>
  );
}
