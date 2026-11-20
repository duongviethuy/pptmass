"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  BookHeart,
  CalendarDays,
  CheckCircle2,
  Church,
  Download,
  FolderOpen,
  Layers,
  LayoutList,
  Loader2,
  Music2,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { deleteMassSlide, saveMassSlide } from "@/app/editor/actions";
import { deleteSavedSection, saveNewSection, updateSavedSection } from "@/app/sections/actions";
import { ImageSectionUploader } from "@/components/editor/image-section-uploader";
import { MySlidesModal } from "@/components/editor/my-slides-modal";
import { PrayerLibraryModal } from "@/components/editor/prayer-library-modal";
import { DEFAULT_IMAGE_TITLES, IMAGE_CATEGORY_LABELS, SECTION_META } from "@/components/editor/section-meta";
import { SongLibraryModal } from "@/components/editor/song-library-modal";
import { SectionRowOverlay, SortableSectionRow } from "@/components/editor/sortable-section-row";
import { FullscreenPlayer } from "@/components/presentation/fullscreen-player";
import { PresentationLaunchModal } from "@/components/presentation/presentation-launch-modal";
import { PresenterConsole } from "@/components/presentation/presenter-console";
import SectionStudioEditor from "@/components/section-studio-editor";
import type { CurrentUser } from "@/lib/auth";
import { demoPrayers, songLibrary as demoSongs } from "@/lib/demo-data";
import { buildExportPptxPayload, normalizeSectionForStorage } from "@/lib/payload-normalizer";
import {
  countPendingImagesInSections,
  inlinePendingImagesForExport,
  revokePendingImageUrl,
  rollbackUploadedImages,
  uploadPendingImagesForSections,
} from "@/lib/pending-images";
import {
  buildPresentationDeck,
  findGlobalSlideIndex,
  type PresentationDeck,
  type PresentationDisplayMode,
  type PresentationStartFrom,
} from "@/lib/presentation";
import type {
  CustomSlideTheme,
  Mass,
  MassSection,
  MassThemeId,
  Prayer,
  SavedSection,
  SavedSlideSummary,
  SectionKind,
  SlideAspectRatio,
  SlideBackgroundImage,
  Song,
} from "@/lib/pptmass-types";
import {
  DEFAULT_CUSTOM_THEME,
  buildSectionSlides,
  cloneSectionWithNewId,
  createEditableSlidesFromPrayer,
  getEffectiveEditableSlides,
  reflowEditableSlides,
  type SlidePreviewItem,
} from "@/lib/slide-utils";
import { cn } from "@/lib/utils";

function createInitialMass(currentUser?: CurrentUser | null, defaultDate = ""): Mass {
  return {
    id: "draft-mass-1",
    title: "Thánh Lễ Chúa Nhật",
    celebrationDate: defaultDate,
    aspectRatio: "16:9",
    themeId: "pure-white",
    customTheme: DEFAULT_CUSTOM_THEME,
    isPublic: false,
    createdBy: currentUser?.id,
    createdByName: currentUser?.name ?? "Bạn",
    sections: [
      { id: "sec-image-1", kind: "image", title: "Ảnh bìa lễ", imageCategory: "cover", imageFit: "cover" },
    ],
  };
}

export default function MassEditor({
  userMenu,
  initialMass = null,
  initialSavedSlides = [],
  slidesTableMissing = false,
  initialSongs = [],
  initialPrayers = [],
  initialSavedSections = [],
  currentUser,
  defaultDate = "",
}: {
  userMenu?: ReactNode;
  initialMass?: Mass | null;
  initialSavedSlides?: SavedSlideSummary[];
  slidesTableMissing?: boolean;
  initialSongs?: Song[];
  initialPrayers?: Prayer[];
  initialSavedSections?: SavedSection[];
  currentUser?: CurrentUser | null;
  defaultDate?: string;
}) {
  const router = useRouter();
  const usingDemoSongs = initialSongs.length === 0;
  const availableSongs = useMemo(() => (initialSongs.length > 0 ? initialSongs : demoSongs), [initialSongs]);
  const availablePrayers = useMemo(() => (initialPrayers.length > 0 ? initialPrayers : demoPrayers), [initialPrayers]);

  const [mass, setMass] = useState<Mass>(() => initialMass ?? createInitialMass(currentUser, defaultDate));
  const [persistedSlideId, setPersistedSlideId] = useState<string | null>(() => initialMass?.id ?? null);
  const [savedSlides, setSavedSlides] = useState<SavedSlideSummary[]>(initialSavedSlides);
  const [isSavingSlide, setIsSavingSlide] = useState(false);
  const [savingSlideStage, setSavingSlideStage] = useState<"uploading" | "saving" | null>(null);
  const [showMySlidesModal, setShowMySlidesModal] = useState(false);
  const [deletingSlideId, setDeletingSlideId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(() => (initialMass ?? mass).sections[0]?.id ?? "");
  const [activeSlideIdxInSection, setActiveSlideIdxInSection] = useState(0);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [savedSections, setSavedSections] = useState<SavedSection[]>(initialSavedSections);
  const [savingSectionId, setSavingSectionId] = useState<string | null>(null);
  const [studioModal, setStudioModal] = useState<{ savedId: string; draft: MassSection } | null>(null);
  const [isModalSaving, setIsModalSaving] = useState(false);

  const [showSongLibraryModal, setShowSongLibraryModal] = useState(false);
  const [showPrayerLibraryModal, setShowPrayerLibraryModal] = useState(false);

  // Chế độ trình chiếu (Modal chọn tùy chọn -> Toàn màn hình hoặc 2 màn hình kiểu MS PowerPoint)
  const [launchDeck, setLaunchDeck] = useState<PresentationDeck | null>(null);
  const [activePresentation, setActivePresentation] = useState<
    | { mode: "fullscreen"; deck: PresentationDeck; initialIndex: number }
    | {
        mode: "presenter";
        sessionId: string;
        deck: PresentationDeck;
        initialIndex: number;
        audienceWindow: Window | null;
      }
    | null
  >(null);

  const [notice, setNotice] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const readOnly = false;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const songLookup = useMemo(() => {
    const map = new Map<string, Song>();
    for (const item of demoSongs) map.set(item.id, item);
    for (const item of availableSongs) map.set(item.id, item);
    return map;
  }, [availableSongs]);

  const selectedSection = useMemo(
    () => mass.sections.find((section) => section.id === selectedId) ?? mass.sections[0],
    [mass.sections, selectedId],
  );

  const sectionSlidesMap = useMemo(() => {
    const map = new Map<string, SlidePreviewItem[]>();
    for (const section of mass.sections) {
      const linkedSong = section.kind === "song" ? songLookup.get(section.songId) : undefined;
      map.set(section.id, buildSectionSlides(section, linkedSong, mass.aspectRatio));
    }
    return map;
  }, [mass.sections, mass.aspectRatio, songLookup]);

  const totalSlides = useMemo(
    () => mass.sections.reduce((sum, section) => sum + (sectionSlidesMap.get(section.id)?.length ?? 0), 0),
    [mass.sections, sectionSlidesMap],
  );

  const activeSlides = selectedSection ? (sectionSlidesMap.get(selectedSection.id) ?? []) : [];
  const customTheme = mass.customTheme ?? DEFAULT_CUSTOM_THEME;
  const pendingImageCount = useMemo(() => countPendingImagesInSections(mass.sections), [mass.sections]);

  function updateMassField<K extends keyof Mass>(key: K, value: Mass[K]) {
    if (readOnly) return;
    setNotice(null);
    setMass((current) => {
      if (key === "aspectRatio") {
        const nextRatio = value as SlideAspectRatio;
        return {
          ...current,
          aspectRatio: nextRatio,
          sections: current.sections.map((sec) => {
            if (sec.kind === "image") return sec;
            const linked = sec.kind === "song" ? songLookup.get(sec.songId) : undefined;
            const baseSlides = getEffectiveEditableSlides(sec, linked, nextRatio);
            const { slides: reflowedSlides } = reflowEditableSlides(baseSlides, sec, nextRatio);
            if (sec.kind === "text") {
              return { ...sec, slides: reflowedSlides, content: reflowedSlides[0]?.body ?? sec.content };
            }
            return { ...sec, slides: reflowedSlides };
          }),
        };
      }
      return { ...current, [key]: value };
    });
  }

  function applyThemeToAllNonImageSections(
    nextThemeId: MassThemeId,
    nextCustomTheme?: CustomSlideTheme,
    nextBgImage?: SlideBackgroundImage,
  ) {
    if (readOnly) return;
    setNotice(null);
    setMass((current) => ({
      ...current,
      themeId: nextThemeId,
      customTheme: nextThemeId === "custom" && nextCustomTheme ? { ...nextCustomTheme } : current.customTheme,
      sections: current.sections.map((sec) => {
        if (sec.kind === "image") return sec;
        const linked = sec.kind === "song" ? songLookup.get(sec.songId) : undefined;
        const baseSlides = getEffectiveEditableSlides(sec, linked, current.aspectRatio);
        const syncedSlides = baseSlides.map((s) => ({
          ...s,
          backgroundImage: nextBgImage ? { ...nextBgImage } : undefined,
        }));
        return {
          ...sec,
          themeId: nextThemeId,
          customTheme: nextThemeId === "custom" && nextCustomTheme ? { ...nextCustomTheme } : undefined,
          slides: syncedSlides,
        };
      }),
    }));
  }

  function applyStyleToAllNonImageSections(
    sourceSection: Exclude<MassSection, { kind: "image" }>,
    activeBgImage?: SlideBackgroundImage,
  ) {
    if (readOnly) return;
    setNotice(null);
    const sharedThemeId = sourceSection.themeId ?? mass.themeId;
    const sharedCustomTheme =
      sharedThemeId === "custom"
        ? sourceSection.customTheme
          ? { ...sourceSection.customTheme }
          : mass.customTheme
            ? { ...mass.customTheme }
            : undefined
        : undefined;
    const sharedStyle = {
      ...sourceSection.style,
      ...(sourceSection.kind === "text"
        ? {
            titleFontFamily: sourceSection.style.titleFontFamily ?? sourceSection.titleFontFamily,
            titleFontSizePt: sourceSection.style.titleFontSizePt ?? sourceSection.titleFontSizePt,
            titleLineSpacingPt: sourceSection.style.titleLineSpacingPt ?? sourceSection.titleLineSpacingPt,
            titleAlign: sourceSection.style.titleAlign ?? sourceSection.titleAlign,
            titleColor: sourceSection.style.titleColor ?? sourceSection.titleColor,
            contentColor: sourceSection.style.contentColor ?? sourceSection.contentColor,
          }
        : {}),
    };

    setMass((current) => ({
      ...current,
      themeId: sharedThemeId,
      customTheme: sharedCustomTheme ?? current.customTheme,
      sections: current.sections.map((sec) => {
        if (sec.kind === "image") return sec;
        const linked = sec.kind === "song" ? songLookup.get(sec.songId) : undefined;
        const baseSlides = getEffectiveEditableSlides(sec, linked, current.aspectRatio).map((s) => ({
          ...s,
          backgroundImage: activeBgImage ? { ...activeBgImage } : undefined,
        }));
        const nextSec: Exclude<MassSection, { kind: "image" }> =
          sec.kind === "text"
            ? {
                ...sec,
                themeId: sharedThemeId,
                customTheme: sharedCustomTheme,
                style: { ...sec.style, ...sharedStyle },
                titleFontFamily: sharedStyle.titleFontFamily ?? sec.titleFontFamily,
                titleFontSizePt: sharedStyle.titleFontSizePt ?? sec.titleFontSizePt,
                titleLineSpacingPt: sharedStyle.titleLineSpacingPt ?? sec.titleLineSpacingPt,
                titleAlign: sharedStyle.titleAlign ?? sec.titleAlign,
                titleColor: sharedStyle.titleColor ?? sec.titleColor,
                contentColor: sharedStyle.contentColor ?? sec.contentColor,
              }
            : {
                ...sec,
                themeId: sharedThemeId,
                customTheme: sharedCustomTheme,
                style: { ...sec.style, ...sharedStyle },
              };
        const { slides: reflowedSlides } = reflowEditableSlides(baseSlides, nextSec, current.aspectRatio);
        if (nextSec.kind === "text") {
          return {
            ...nextSec,
            slides: reflowedSlides,
            content: reflowedSlides[0]?.body ?? nextSec.content,
          };
        }
        return {
          ...nextSec,
          slides: reflowedSlides,
        };
      }),
    }));
  }

  function updateSection(id: string, updater: (section: MassSection) => MassSection) {
    if (readOnly) return;
    setNotice(null);
    setMass((current) => ({
      ...current,
      sections: current.sections.map((section) => (section.id === id ? updater(section) : section)),
    }));
  }

  function addSong(song: Song) {
    if (readOnly) return;
    const id = `song-${crypto.randomUUID()}`;
    const defaultStyle = { fontSize: "xlarge" as const, showTitleOnEverySlide: false };
    // Section bài hát mới bắt đầu rỗng (0 slide); khi người dùng chèn lời mới bắt đầu xuất hiện slide
    const newSection: MassSection = {
      id,
      kind: "song",
      title: song.title,
      songId: song.id,
      partOrder: [],
      slides: [],
      style: defaultStyle,
    };
    setNotice(null);
    setMass((current) => ({ ...current, sections: [...current.sections, newSection] }));
    setSelectedId(id);
    setShowSongLibraryModal(false);
  }

  function addPrayer(prayer: Prayer) {
    if (readOnly) return;
    const id = `prayer-${crypto.randomUUID()}`;
    // Mặc định hiển thị tiêu đề ở slide đầu tiên, các slide sau ẩn tiêu đề
    const defaultPrayerStyle = { fontSize: "xlarge" as const, showTitleOnEverySlide: false };
    const newSection: MassSection = {
      id,
      kind: "prayer",
      title: prayer.title,
      prayerId: prayer.id,
      content: prayer.content,
      slides: createEditableSlidesFromPrayer(prayer.title, prayer.content, defaultPrayerStyle, mass.aspectRatio, id),
      style: defaultPrayerStyle,
    };
    setNotice(null);
    setMass((current) => ({ ...current, sections: [...current.sections, newSection] }));
    setSelectedId(id);
    setShowPrayerLibraryModal(false);
  }

  function addSection(kind: Exclude<SectionKind, "song" | "prayer">) {
    if (readOnly) return;
    const id = `${kind}-${crypto.randomUUID()}`;
    const section: MassSection =
      kind === "image"
        ? { id, kind, title: "Ảnh bìa lễ", imageCategory: "cover", imageFit: "cover" }
        : {
            id,
            kind: "text",
            title: "NỘI DUNG MỚI",
            content: "Nhập nội dung hiển thị trên slide.",
            slides: [
              {
                id: `${id}-s-1`,
                showHeading: true,
                body: "Nhập nội dung hiển thị trên slide.",
                showBody: true,
              },
            ],
            showTitle: true,
            showContent: true,
            titleFontFamily: "Arial",
            titleFontSize: "large",
            style: { fontSize: "xlarge", fontFamily: "Arial", showTitleOnEverySlide: false },
          };
    setNotice(null);
    setMass((current) => ({ ...current, sections: [...current.sections, section] }));
    setSelectedId(id);
  }

  function removeSection(id: string) {
    if (readOnly || mass.sections.length <= 1) return;
    setNotice(null);
    setMass((current) => {
      const nextSections = current.sections.filter((section) => section.id !== id);
      if (selectedId === id && nextSections[0]) {
        setSelectedId(nextSections[0].id);
      }
      return { ...current, sections: nextSections };
    });
  }

  function duplicateSection(id: string) {
    if (readOnly) return;
    const sourceIndex = mass.sections.findIndex((section) => section.id === id);
    if (sourceIndex === -1) return;
    const source = mass.sections[sourceIndex];
    const newId = `${source.kind}-${crypto.randomUUID()}`;
    const cloned = cloneSectionWithNewId(source, newId, { keepSavedSectionId: true });

    setMass((current) => {
      const nextSections = [...current.sections];
      nextSections.splice(sourceIndex + 1, 0, cloned);
      return { ...current, sections: nextSections };
    });
    setSelectedId(newId);
    setNotice(`Đã nhân đôi section "${source.title || "Chưa đặt tên"}".`);
  }

  async function handleSaveSectionRow(section: MassSection) {
    if (readOnly || savingSectionId) return;
    if (!currentUser) {
      setNotice("Vui lòng đăng nhập để lưu section vào thư viện cá nhân.");
      return;
    }

    setSavingSectionId(section.id);
    let uploadedObjectPaths: string[] = [];
    let replacedBlobUrls: string[] = [];
    try {
      const existingSaved = section.savedSectionId
        ? savedSections.find((item) => item.id === section.savedSectionId)
        : undefined;
      const targetSavedId = existingSaved?.id ?? crypto.randomUUID();

      const uploaded = await uploadPendingImagesForSections([section], {
        slideId: targetSavedId,
        scope: "section",
      });
      uploadedObjectPaths = uploaded.uploadedObjectPaths;
      replacedBlobUrls = uploaded.replacedBlobUrls;
      const sectionWithImages = uploaded.sections[0] ?? section;

      const cleanSection = normalizeSectionForStorage(sectionWithImages);

      const result = existingSaved
        ? await updateSavedSection({ id: existingSaved.id, title: cleanSection.title, section: cleanSection })
        : await saveNewSection({ id: targetSavedId, title: cleanSection.title, section: cleanSection });

      if (result.status === "success") {
        replacedBlobUrls.forEach((blobUrl) => revokePendingImageUrl(blobUrl));
        const saved = result.savedSection;
        setSavedSections((prev) => {
          const exists = prev.some((item) => item.id === saved.id);
          return exists ? prev.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev];
        });
        setMass((current) => ({
          ...current,
          sections: current.sections.map((item) =>
            item.id === section.id ? { ...sectionWithImages, savedSectionId: saved.id } : item,
          ),
        }));
        setNotice(
          existingSaved
            ? `Đã cập nhật section đã lưu "${saved.title}".`
            : `Đã lưu section "${saved.title}" vào thư viện cá nhân của bạn.`,
        );
      } else {
        await rollbackUploadedImages(uploadedObjectPaths);
        if (result.status === "table_missing" || result.status === "error") {
          setNotice(result.message);
        }
      }
    } catch (error) {
      await rollbackUploadedImages(uploadedObjectPaths);
      setNotice(error instanceof Error ? error.message : "Không thể lưu section. Vui lòng thử lại.");
    } finally {
      setSavingSectionId(null);
    }
  }

  function insertSavedSection(saved: SavedSection) {
    if (readOnly) return;
    const newId = `${saved.kind}-${crypto.randomUUID()}`;
    const cloned = cloneSectionWithNewId(saved.sectionData, newId, { overrideSavedSectionId: saved.id });
    setMass((current) => ({ ...current, sections: [...current.sections, cloned] }));
    setSelectedId(newId);
    setNotice(`Đã thêm section đã lưu "${saved.title}" vào Trình tự Thánh lễ.`);
  }

  async function handleDeleteSavedSection(saved: SavedSection) {
    const result = await deleteSavedSection(saved.id);
    if (result.status === "deleted") {
      setSavedSections((prev) => prev.filter((item) => item.id !== saved.id));
      setMass((current) => ({
        ...current,
        sections: current.sections.map((sec) =>
          sec.savedSectionId === saved.id ? { ...sec, savedSectionId: undefined } : sec,
        ),
      }));
      setNotice(`Đã xóa section đã lưu "${saved.title}".`);
    } else if (result.status === "error" || result.status === "table_missing") {
      setNotice(result.message);
    }
  }

  function openSavedSectionInModal(saved: SavedSection) {
    setStudioModal({
      savedId: saved.id,
      draft: cloneSectionWithNewId(saved.sectionData, saved.sectionData.id, { overrideSavedSectionId: saved.id }),
    });
  }

  async function handleSaveModalToLibrary() {
    if (!studioModal || isModalSaving) return;
    if (!currentUser) {
      setNotice("Vui lòng đăng nhập để lưu section cá nhân.");
      return;
    }

    setIsModalSaving(true);
    let uploadedObjectPaths: string[] = [];
    let replacedBlobUrls: string[] = [];
    try {
      const uploaded = await uploadPendingImagesForSections([studioModal.draft], {
        slideId: studioModal.savedId,
        scope: "section",
      });
      uploadedObjectPaths = uploaded.uploadedObjectPaths;
      replacedBlobUrls = uploaded.replacedBlobUrls;
      const draftWithImages = uploaded.sections[0] ?? studioModal.draft;

      const cleanSection = normalizeSectionForStorage(draftWithImages);
      const result = await updateSavedSection({
        id: studioModal.savedId,
        title: cleanSection.title,
        section: cleanSection,
      });

      if (result.status === "success") {
        replacedBlobUrls.forEach((blobUrl) => revokePendingImageUrl(blobUrl));
        const saved = result.savedSection;
        setSavedSections((prev) => {
          const exists = prev.some((item) => item.id === saved.id);
          return exists ? prev.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...prev];
        });

        setMass((current) => ({
          ...current,
          sections: current.sections.map((sec) =>
            sec.savedSectionId === saved.id
              ? cloneSectionWithNewId(saved.sectionData, sec.id, { overrideSavedSectionId: saved.id })
              : sec,
          ),
        }));

        setNotice(`Đã lưu thay đổi cho section "${saved.title}".`);
        setStudioModal(null);
      } else {
        await rollbackUploadedImages(uploadedObjectPaths);
        if (result.status === "table_missing" || result.status === "error") {
          setNotice(result.message);
        }
      }
    } catch (error) {
      await rollbackUploadedImages(uploadedObjectPaths);
      setNotice(error instanceof Error ? error.message : "Không thể cập nhật section.");
    } finally {
      setIsModalSaving(false);
    }
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveDragId(String(active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDragId(null);
    if (readOnly || !over || active.id === over.id) return;
    setNotice(null);
    setMass((current) => {
      const oldIndex = current.sections.findIndex((section) => section.id === active.id);
      const newIndex = current.sections.findIndex((section) => section.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return current;
      return { ...current, sections: arrayMove(current.sections, oldIndex, newIndex) };
    });
  }

  function openPresentationModal() {
    const compiledDeck = buildPresentationDeck(mass, songLookup);
    if (compiledDeck.slides.length === 0) {
      setNotice("Chưa có slide nào để trình chiếu.");
      return;
    }
    setNotice(null);
    setLaunchDeck(compiledDeck);
  }

  function handleStartPresentation(startFrom: PresentationStartFrom, displayMode: PresentationDisplayMode) {
    if (!launchDeck) return;
    const initialIndex =
      startFrom === "current"
        ? findGlobalSlideIndex(launchDeck, selectedSection?.id, activeSlideIdxInSection)
        : 0;
    const deckToPresent = launchDeck;
    setLaunchDeck(null);

    if (displayMode === "fullscreen") {
      // Gọi đồng bộ ngay trong sự kiện click để trình duyệt cấp quyền Fullscreen mượt mà
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
      setActivePresentation({
        mode: "fullscreen",
        deck: deckToPresent,
        initialIndex,
      });
      return;
    }

    // Chế độ Người trình bày (2 màn hình): mở đồng bộ cửa sổ trình chiếu mới ngay trong sự kiện click để không bị chặn popup
    const sessionId = crypto.randomUUID().slice(0, 12);
    const audienceWindow = window.open(
      `/present?session=${encodeURIComponent(sessionId)}`,
      "pptmass-audience-screen",
      "popup=yes,width=1280,height=720,menubar=no,toolbar=no,location=no,status=no",
    );
    setActivePresentation({
      mode: "presenter",
      sessionId,
      deck: deckToPresent,
      initialIndex,
      audienceWindow,
    });
  }

  async function handleSaveSlide() {
    if (isSavingSlide) return;
    if (!currentUser) {
      setNotice("Vui lòng đăng nhập để lưu bài trình chiếu và hình ảnh lên hệ thống.");
      return;
    }
    if (!mass.title.trim()) {
      setNotice("Vui lòng nhập tên bài trình chiếu trước khi lưu.");
      return;
    }

    setIsSavingSlide(true);
    setNotice(null);

    const targetSlideId = persistedSlideId ?? crypto.randomUUID();
    const isExisting = Boolean(persistedSlideId);
    let uploadedObjectPaths: string[] = [];
    let replacedBlobUrls: string[] = [];

    try {
      setSavingSlideStage("uploading");
      const uploaded = await uploadPendingImagesForSections(mass.sections, {
        slideId: targetSlideId,
        scope: "slide",
      });
      uploadedObjectPaths = uploaded.uploadedObjectPaths;
      replacedBlobUrls = uploaded.replacedBlobUrls;

      setSavingSlideStage("saving");
      const massToSave: Mass = {
        ...mass,
        id: targetSlideId,
        sections: uploaded.sections,
      };
      const result = await saveMassSlide({
        id: targetSlideId,
        isExisting,
        mass: massToSave,
      });

      if (result.status === "success") {
        replacedBlobUrls.forEach((blobUrl) => revokePendingImageUrl(blobUrl));
        setMass(result.slide);
        setPersistedSlideId(result.slide.id);
        setSavedSlides((prev) => {
          const filtered = prev.filter((item) => item.id !== result.summary.id);
          return [result.summary, ...filtered];
        });
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `/editor?id=${encodeURIComponent(result.slide.id)}`);
        }

        const extraDetails: string[] = [];
        if (uploaded.uploadedCount > 0) {
          extraDetails.push(`đã tải ${uploaded.uploadedCount} ảnh lên Bunny Storage`);
        }
        if (result.cleanedImagesCount > 0) {
          extraDetails.push(`dọn ${result.cleanedImagesCount} ảnh cũ không còn dùng`);
        }
        setNotice(
          `${isExisting ? "Đã lưu thay đổi" : "Đã lưu slide"} "${result.slide.title}"${extraDetails.length > 0 ? ` (${extraDetails.join(" · ")})` : ""}.`,
        );
      } else {
        await rollbackUploadedImages(uploadedObjectPaths);
        if (result.status === "table_missing" || result.status === "error") {
          setNotice(result.message);
        }
      }
    } catch (error) {
      await rollbackUploadedImages(uploadedObjectPaths);
      setNotice(error instanceof Error ? error.message : "Không thể lưu bài trình chiếu. Vui lòng thử lại.");
    } finally {
      setIsSavingSlide(false);
      setSavingSlideStage(null);
    }
  }

  async function handleDeleteSavedSlide(slide: SavedSlideSummary) {
    if (deletingSlideId) return;
    setDeletingSlideId(slide.id);
    try {
      const result = await deleteMassSlide(slide.id);
      if (result.status === "deleted") {
        setSavedSlides((prev) => prev.filter((item) => item.id !== slide.id));
        if (persistedSlideId === slide.id) {
          setPersistedSlideId(null);
          if (typeof window !== "undefined") {
            window.history.replaceState(null, "", "/editor");
          }
        }
        setNotice(
          result.cleanedImagesCount > 0
            ? `Đã xóa slide "${slide.title}" và dọn ${result.cleanedImagesCount} ảnh trên Bunny Storage.`
            : `Đã xóa slide "${slide.title}".`,
        );
      } else if (result.status === "error" || result.status === "table_missing") {
        setNotice(result.message);
      }
    } finally {
      setDeletingSlideId(null);
    }
  }

  function handleOpenSavedSlide(slideId: string) {
    setShowMySlidesModal(false);
    router.push(`/editor?id=${encodeURIComponent(slideId)}`);
  }

  function handleCreateNewSlide() {
    setShowMySlidesModal(false);
    const fresh = createInitialMass(currentUser, defaultDate);
    setMass(fresh);
    setPersistedSlideId(null);
    setSelectedId(fresh.sections[0]?.id ?? "");
    setActiveSlideIdxInSection(0);
    setNotice(null);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/editor");
    }
  }

  async function handleExportPptx() {
    if (isExporting) return;
    setIsExporting(true);
    setNotice(null);

    try {
      // Nếu còn ảnh cục bộ (chưa bấm Lưu slide), tự chuyển sang Data URL trong bộ nhớ để xuất .pptx ngay mà không đẩy rác lên Bunny
      const exportableMass = await inlinePendingImagesForExport(mass);
      const payload = buildExportPptxPayload(exportableMass, songLookup);
      const response = await fetch("/api/export-pptx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = (await response.json().catch(() => null)) as { error?: string } | null;
        setNotice(errData?.error ?? "Không thể xuất file PowerPoint. Vui lòng thử lại.");
        return;
      }

      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const fileName = match?.[1] ?? "thanh-le.pptx";

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setNotice(`Đã xuất thành công file PowerPoint "${fileName}" (${totalSlides} slide · tỉ lệ ${mass.aspectRatio})!`);
    } catch {
      setNotice("Đã có lỗi xảy ra khi tải file PowerPoint. Vui lòng thử lại.");
    } finally {
      setIsExporting(false);
    }
  }

  const meta = selectedSection ? SECTION_META[selectedSection.kind] : null;
  const SelectedIcon = meta?.icon;

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-slate-900">
      {/* Thanh Header */}
      <header className="sticky top-0 z-20 flex h-13 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5" title="Về trang chủ">
            <span className="flex size-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-200">
              <Church className="size-5" />
            </span>
            <span className="text-lg font-bold tracking-tight">pptmass</span>
          </Link>
          <span className="hidden rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 sm:inline">
            Soạn slide Thánh lễ
          </span>
          <Link href="/slides" className="hidden text-xs font-semibold text-slate-500 transition hover:text-violet-700 md:inline">
            Slide của tôi
          </Link>
          <Link href="/songs" className="hidden text-xs font-semibold text-slate-500 transition hover:text-violet-700 md:inline">
            Thư viện bài hát
          </Link>
          <Link href="/sections" className="hidden text-xs font-semibold text-slate-500 transition hover:text-violet-700 md:inline">
            Section đã lưu
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMySlidesModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50/50 hover:text-violet-700 sm:px-3"
            title="Mở danh sách các bài slide đã lưu hoặc tạo bài mới"
          >
            <FolderOpen className="size-4 text-violet-600" />
            <span className="hidden sm:inline">Slide đã lưu</span>
            {savedSlides.length > 0 && (
              <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-extrabold text-violet-700">
                {savedSlides.length}
              </span>
            )}
          </button>
          <button
            type="button"
            disabled={totalSlides === 0}
            onClick={openPresentationModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm shadow-violet-200 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            title="Biên dịch toàn bộ section và trình chiếu toàn màn hình hoặc chế độ 2 màn hình máy chiếu"
          >
            <Play className="size-4 fill-current" /> Trình chiếu
          </button>
          <button
            type="button"
            disabled={isSavingSlide}
            onClick={() => void handleSaveSlide()}
            title={
              pendingImageCount > 0
                ? `Lưu slide lên Supabase và tải ${pendingImageCount} ảnh mới lên Bunny Storage`
                : "Lưu bài trình chiếu lên Supabase"
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-violet-300 hover:bg-violet-50/40 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
          >
            {isSavingSlide ? (
              <Loader2 className="size-4 animate-spin text-violet-600" />
            ) : (
              <Save className="size-4 text-violet-600" />
            )}
            <span>
              {savingSlideStage === "uploading"
                ? "Đang tải ảnh..."
                : savingSlideStage === "saving"
                  ? "Đang lưu..."
                  : persistedSlideId
                    ? "Lưu thay đổi"
                    : "Lưu slide"}
            </span>
            {!isSavingSlide && pendingImageCount > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800">
                +{pendingImageCount} ảnh
              </span>
            )}
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportPptx}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
          >
            {isExporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {isExporting ? "Đang xuất..." : "Xuất PowerPoint"}
          </button>
          {userMenu}
        </div>
      </header>

      {notice && (
        <div className="border-b border-emerald-200 bg-emerald-50 px-5 py-2.5 lg:px-8">
          <div className="flex items-center justify-between gap-3 text-xs font-medium text-emerald-900">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              {notice}
            </span>
            <button type="button" onClick={() => setNotice(null)} className="font-bold text-emerald-700 hover:underline">
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Thanh thông tin bài trình chiếu */}
      <section className="border-b border-slate-200 bg-white px-4 py-2 lg:px-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex min-w-[200px] flex-1 items-center gap-2">
            <span className="hidden shrink-0 text-[11px] font-bold text-slate-400 sm:inline">Tên lễ:</span>
            <input
              value={mass.title}
              disabled={readOnly}
              onChange={(event) => updateMassField("title", event.target.value)}
              placeholder="Ví dụ: Chúa Nhật XIX Thường Niên - Năm A"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1 text-xs font-bold text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          <div className="relative w-36 shrink-0">
            <CalendarDays className="pointer-events-none absolute top-1.5 left-2.5 size-3.5 text-slate-400" />
            <input
              type="date"
              value={mass.celebrationDate}
              disabled={readOnly}
              onChange={(event) => updateMassField("celebrationDate", event.target.value)}
              aria-label="Ngày cử hành"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-1 pr-2 pl-7 text-[11px] font-semibold text-slate-800 outline-none transition focus:border-violet-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          <div className="inline-flex rounded-full border border-slate-200 bg-slate-100/80 p-0.5">
            {(["16:9", "4:3"] as SlideAspectRatio[]).map((ratio) => (
              <button
                key={ratio}
                type="button"
                disabled={readOnly}
                onClick={() => updateMassField("aspectRatio", ratio)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-bold transition",
                  mass.aspectRatio === ratio ? "bg-white text-violet-700 shadow-xs" : "text-slate-500 hover:text-slate-800",
                )}
              >
                {ratio}
              </button>
            ))}
          </div>

          <div className="ml-auto hidden items-center gap-2 text-[11px] text-slate-500 xl:flex">
            <span>
              <strong className="font-semibold text-slate-700">{mass.sections.length} phần</strong> ·{" "}
              <strong className="font-semibold text-slate-700">{totalSlides} slide</strong>
            </span>
          </div>
        </div>
      </section>

      {/* Bố cục 3 cột: Trái = Trình tự | Giữa = 1 Slide duy nhất + Hình thu nhỏ | Phải = Chỉnh sửa nội dung */}
      <div className="grid min-h-[calc(100vh-98px)] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-white p-4 lg:border-r lg:border-b-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <LayoutList className="size-4 text-violet-600" /> Trình tự Thánh lễ
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {readOnly ? "Chọn section để xem slide." : "Kéo thả để sắp xếp thứ tự."}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {totalSlides} slide
            </span>
          </div>

          <DndContext
            id="mass-sections-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveDragId(null)}
          >
            <SortableContext items={mass.sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {mass.sections.map((section) => {
                  const isSaved = Boolean(
                    section.savedSectionId && savedSections.some((item) => item.id === section.savedSectionId),
                  );
                  return (
                    <SortableSectionRow
                      key={section.id}
                      section={section}
                      slideCount={sectionSlidesMap.get(section.id)?.length ?? 0}
                      selected={section.id === selectedSection?.id}
                      readOnly={readOnly}
                      canDelete={!readOnly && mass.sections.length > 1}
                      isSaved={isSaved}
                      isSaving={savingSectionId === section.id}
                      onSelect={() => {
                        setSelectedId(section.id);
                        setActiveSlideIdxInSection(0);
                      }}
                      onDuplicate={() => duplicateSection(section.id)}
                      onSave={() => void handleSaveSectionRow(section)}
                      onDelete={() => removeSection(section.id)}
                    />
                  );
                })}
              </div>
            </SortableContext>

            <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
              {activeDragId
                ? (() => {
                    const dragged = mass.sections.find((sec) => sec.id === activeDragId);
                    if (!dragged) return null;
                    return (
                      <SectionRowOverlay
                        section={dragged}
                        slideCount={sectionSlidesMap.get(dragged.id)?.length ?? 0}
                      />
                    );
                  })()
                : null}
            </DragOverlay>
          </DndContext>

          {!readOnly && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <span className="mb-2 block text-[11px] font-bold text-slate-400">Thêm section vào trình tự</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowSongLibraryModal(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-rose-300 bg-rose-50/50 px-2 py-2.5 text-[11px] font-bold text-rose-700 transition hover:border-rose-400 hover:bg-rose-50"
                >
                  <Music2 className="size-3.5" /> Bài hát
                </button>
                {(["image", "text"] as const).map((kind) => {
                  const Icon = SECTION_META[kind].icon;
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => addSection(kind)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white px-2 py-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                    >
                      <Icon className="size-3.5 shrink-0" />
                      <span className="truncate">{kind === "text" ? "Tùy chỉnh" : SECTION_META[kind].label}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowPrayerLibraryModal(true)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-teal-300 bg-teal-50/50 px-2 py-2.5 text-[11px] font-bold text-teal-700 transition hover:border-teal-400 hover:bg-teal-50"
                >
                  <BookHeart className="size-3.5" /> Kinh
                </button>
              </div>
            </div>
          )}

          {/* Thư viện Section đã lưu cá nhân */}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Layers className="size-3.5 text-violet-600" /> Section đã lưu ({savedSections.length})
              </h3>
              <Link href="/sections" className="text-[11px] font-bold text-violet-700 hover:underline">
                Mở trang riêng →
              </Link>
            </div>

            {savedSections.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 text-[11px] leading-4 text-slate-400">
                Bấm nút <strong className="font-semibold text-slate-600">Lưu</strong> trên từng section để lưu riêng cho tài khoản của bạn.
              </p>
            ) : (
              <div className="max-h-60 space-y-1.5 overflow-y-auto pr-0.5">
                {savedSections.map((saved) => (
                  <div
                    key={saved.id}
                    className="group flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/60 px-2 py-1.5 transition-colors hover:border-violet-200 hover:bg-white"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                      <Layers className="size-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-bold text-slate-800">{saved.title}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => insertSavedSection(saved)}
                          title="Thêm vào Trình tự Thánh lễ"
                          aria-label={`Thêm ${saved.title} vào Thánh lễ`}
                          className="rounded-md p-1 text-violet-600 transition hover:bg-violet-50"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openSavedSectionInModal(saved)}
                        title="Chỉnh sửa trực tiếp qua Modal (kiểu PowerPoint)"
                        aria-label={`Sửa ${saved.title}`}
                        className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-violet-700"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteSavedSection(saved)}
                        title="Xóa khỏi Section đã lưu"
                        aria-label={`Xóa ${saved.title}`}
                        className="rounded-md p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {selectedSection && meta && SelectedIcon ? (
          <SectionStudioEditor
            key={selectedSection.id}
            workspaceMode
            section={selectedSection}
            aspectRatio={mass.aspectRatio}
            themeId={mass.themeId}
            customTheme={customTheme}
            songs={availableSongs}
            readOnly={readOnly}
            onChange={(nextSection) => updateSection(selectedSection.id, () => nextSection)}
            onActiveSlideIndexChange={setActiveSlideIdxInSection}
            onApplyThemeToAllSections={applyThemeToAllNonImageSections}
            onApplyStyleToAllSlides={applyStyleToAllNonImageSections}
            headerSlot={
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", meta.color)}>
                    <SelectedIcon className="size-3.5" /> {meta.label}
                  </span>
                  <h2 className="text-base font-bold text-slate-900">{selectedSection.title || "Chưa đặt tiêu đề"}</h2>
                </div>
                <span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-xs font-bold text-slate-600">
                  {activeSlides.length} slide
                </span>
              </div>
            }
            imageInspectorSlot={
              selectedSection.kind === "image"
                ? (() => {
                    const coverSections = mass.sections.filter(
                      (sec) => sec.kind === "image" && (sec.imageCategory ?? "cover") === "cover",
                    );
                    const otherCoverWithImage = coverSections.find(
                      (sec) => sec.kind === "image" && sec.id !== selectedSection.id && Boolean(sec.imageUrl),
                    );
                    const existingCoverImage =
                      otherCoverWithImage && otherCoverWithImage.kind === "image" && otherCoverWithImage.imageUrl
                        ? { imageUrl: otherCoverWithImage.imageUrl, imageFit: otherCoverWithImage.imageFit ?? "cover" }
                        : undefined;

                    return (
                      <ImageSectionUploader
                        key={selectedSection.id}
                        imageCategory={selectedSection.imageCategory ?? "cover"}
                        imageUrl={selectedSection.imageUrl}
                        imageFit={selectedSection.imageFit ?? "cover"}
                        coverSectionCount={coverSections.length}
                        existingCoverImage={existingCoverImage}
                        readOnly={readOnly}
                        onChangeCategory={(imageCategory) =>
                          updateSection(selectedSection.id, (sec) => {
                            if (sec.kind !== "image") return sec;
                            const shouldUpdateTitle = !sec.title.trim() || DEFAULT_IMAGE_TITLES.has(sec.title.trim());
                            return {
                              ...sec,
                              imageCategory,
                              title: shouldUpdateTitle ? IMAGE_CATEGORY_LABELS[imageCategory] : sec.title,
                            };
                          })
                        }
                        onChangeImage={(imageUrl) =>
                          updateSection(selectedSection.id, (sec) => (sec.kind === "image" ? { ...sec, imageUrl } : sec))
                        }
                        onChangeFit={(imageFit) =>
                          updateSection(selectedSection.id, (sec) => (sec.kind === "image" ? { ...sec, imageFit } : sec))
                        }
                        onApplyToAllCovers={() => {
                          if (readOnly || !selectedSection.imageUrl) return;
                          const targetUrl = selectedSection.imageUrl;
                          const targetFit = selectedSection.imageFit ?? "cover";
                          setMass((current) => ({
                            ...current,
                            sections: current.sections.map((sec) =>
                              sec.kind === "image" && (sec.imageCategory ?? "cover") === "cover"
                                ? { ...sec, imageUrl: targetUrl, imageFit: targetFit }
                                : sec,
                            ),
                          }));
                          setNotice(`Đã áp dụng ảnh bìa lễ cho toàn bộ ${coverSections.length} section Ảnh bìa lễ.`);
                        }}
                      />
                    );
                  })()
                : undefined
            }
          />
        ) : (
          <div className="flex items-center justify-center p-10 text-sm text-slate-400">
            Chọn hoặc thêm một section để bắt đầu chỉnh sửa slide.
          </div>
        )}
      </div>

      {/* Modal Thư viện bài hát */}
      {showSongLibraryModal && (
        <SongLibraryModal
          songs={availableSongs}
          usingDemoSongs={usingDemoSongs}
          currentUserId={currentUser?.id}
          readOnly={readOnly}
          onSelectSong={addSong}
          onClose={() => setShowSongLibraryModal(false)}
        />
      )}

      {/* Modal Thư viện kinh */}
      {showPrayerLibraryModal && (
        <PrayerLibraryModal
          prayers={availablePrayers}
          readOnly={readOnly}
          onSelectPrayer={addPrayer}
          onClose={() => setShowPrayerLibraryModal(false)}
        />
      )}

      {/* Modal chỉnh sửa Section đã lưu trực tiếp kiểu PowerPoint */}
      {studioModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-xs sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Trình chỉnh sửa section đã lưu"
        >
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-[#f7f8fc] shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", SECTION_META[studioModal.draft.kind].color)}>
                  {SECTION_META[studioModal.draft.kind].label}
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Chỉnh sửa Section đã lưu</h2>
                  <p className="text-[11px] text-slate-500">
                    Bấm thẳng vào Tiêu đề hoặc Nội dung trên slide để gõ, chỉnh font, cỡ chữ, màu sắc và căn lề.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStudioModal(null)}
                aria-label="Đóng cửa sổ chỉnh sửa"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <SectionStudioEditor
                key={studioModal.savedId}
                section={studioModal.draft}
                aspectRatio={mass.aspectRatio}
                themeId={mass.themeId}
                customTheme={customTheme}
                songs={availableSongs}
                onChange={(nextDraft) => setStudioModal((prev) => (prev ? { ...prev, draft: nextDraft } : null))}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-200 bg-white px-5 py-3">
              <button
                type="button"
                onClick={() => setStudioModal(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Hủy
              </button>

              <button
                type="button"
                disabled={isModalSaving}
                onClick={() => void handleSaveModalToLibrary()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-violet-200 transition hover:bg-violet-700 disabled:opacity-60"
              >
                {isModalSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Cập nhật Section đã lưu
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal danh sách bài slide đã lưu */}
      {showMySlidesModal && (
        <MySlidesModal
          slides={savedSlides}
          currentSlideId={persistedSlideId}
          deletingSlideId={deletingSlideId}
          tableMissing={slidesTableMissing}
          isLoggedIn={Boolean(currentUser)}
          onOpenSlide={handleOpenSavedSlide}
          onCreateNew={handleCreateNewSlide}
          onDeleteSlide={(slide) => void handleDeleteSavedSlide(slide)}
          onClose={() => setShowMySlidesModal(false)}
        />
      )}

      {/* Modal cài đặt trước khi trình chiếu (Điểm bắt đầu + Toàn màn hình / 2 màn hình) */}
      {launchDeck && (
        <PresentationLaunchModal
          deck={launchDeck}
          currentSlideIndex={findGlobalSlideIndex(launchDeck, selectedSection?.id, activeSlideIdxInSection)}
          onStart={handleStartPresentation}
          onClose={() => setLaunchDeck(null)}
        />
      )}

      {/* Chế độ trình chiếu Toàn màn hình hiện tại */}
      {activePresentation?.mode === "fullscreen" && (
        <FullscreenPlayer
          deck={activePresentation.deck}
          initialIndex={activePresentation.initialIndex}
          onExit={() => setActivePresentation(null)}
        />
      )}

      {/* Chế độ Người trình bày 2 màn hình (Bàn điều khiển + Cửa sổ trình chiếu riêng) */}
      {activePresentation?.mode === "presenter" && (
        <PresenterConsole
          sessionId={activePresentation.sessionId}
          deck={activePresentation.deck}
          initialIndex={activePresentation.initialIndex}
          initialAudienceWindow={activePresentation.audienceWindow}
          onExit={() => setActivePresentation(null)}
        />
      )}
    </main>
  );
}
