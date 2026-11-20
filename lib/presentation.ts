import type {
  CustomSlideTheme,
  Mass,
  MassThemeId,
  SectionKind,
  SlideAspectRatio,
  Song,
} from "@/lib/pptmass-types";
import { DEFAULT_CUSTOM_THEME, buildSectionSlides, type SlidePreviewItem } from "@/lib/slide-utils";

export type PresentationStartFrom = "current" | "beginning";
export type PresentationDisplayMode = "fullscreen" | "presenter";

export type PresentationSlide = {
  globalIndex: number;
  id: string;
  sectionId: string;
  sectionTitle: string;
  sectionKind: SectionKind;
  slideIndexInSection: number;
  sectionSlideCount: number;
  themeId: MassThemeId;
  customTheme?: CustomSlideTheme;
  preview: SlidePreviewItem;
};

export type PresentationSectionSummary = {
  sectionId: string;
  title: string;
  kind: SectionKind;
  startIndex: number;
  slideCount: number;
};

export type PresentationDeck = {
  title: string;
  celebrationDate: string;
  aspectRatio: SlideAspectRatio;
  slides: PresentationSlide[];
  sections: PresentationSectionSummary[];
};

export type PresentationMessage =
  | { type: "AUDIENCE_READY"; sessionId: string }
  | {
      type: "SYNC_DECK";
      sessionId: string;
      deck: PresentationDeck;
      currentIndex: number;
    }
  | {
      type: "SET_STATE";
      sessionId: string;
      currentIndex: number;
    }
  | { type: "REQUEST_NAV"; sessionId: string; delta: number }
  | { type: "REQUEST_GOTO"; sessionId: string; index: number }
  | { type: "AUDIENCE_CLOSED"; sessionId: string }
  | { type: "END_SESSION"; sessionId: string };

export function getPresentationChannelName(sessionId: string): string {
  return `pptmass-present-${sessionId}`;
}

/**
 * Biên dịch toàn bộ các section của bài Thánh lễ thành một bộ slide hoàn chỉnh, phẳng,
 * tự chứa đủ giao diện/màu sắc/font chữ/ảnh nền để trình chiếu tức thì không cần tính lại.
 */
export function buildPresentationDeck(mass: Mass, songLookup: Map<string, Song>): PresentationDeck {
  const slides: PresentationSlide[] = [];
  const sections: PresentationSectionSummary[] = [];

  for (const section of mass.sections) {
    const linkedSong = section.kind === "song" ? songLookup.get(section.songId) : undefined;
    const previews = buildSectionSlides(section, linkedSong, mass.aspectRatio);
    const startIndex = slides.length;

    // Section Hình ảnh luôn độc lập trên nền trắng trung tính (không bị ảnh hưởng bởi theme chữ)
    const effectiveThemeId: MassThemeId =
      section.kind === "image" ? "pure-white" : (section.themeId ?? mass.themeId);
    const effectiveCustomTheme: CustomSlideTheme | undefined =
      effectiveThemeId === "custom"
        ? section.kind === "image"
          ? DEFAULT_CUSTOM_THEME
          : { ...(section.customTheme ?? mass.customTheme ?? DEFAULT_CUSTOM_THEME) }
        : undefined;

    previews.forEach((preview, slideIndexInSection) => {
      slides.push({
        globalIndex: slides.length,
        id: `${section.id}::${preview.id || slideIndexInSection}`,
        sectionId: section.id,
        sectionTitle: section.title || "Chưa đặt tiêu đề",
        sectionKind: section.kind,
        slideIndexInSection,
        sectionSlideCount: previews.length,
        themeId: effectiveThemeId,
        customTheme: effectiveCustomTheme,
        preview,
      });
    });

    if (previews.length > 0) {
      sections.push({
        sectionId: section.id,
        title: section.title || "Chưa đặt tiêu đề",
        kind: section.kind,
        startIndex,
        slideCount: previews.length,
      });
    }
  }

  return {
    title: mass.title.trim() || "Trình chiếu Thánh lễ",
    celebrationDate: mass.celebrationDate ?? "",
    aspectRatio: mass.aspectRatio,
    slides,
    sections,
  };
}

/** Tìm vị trí slide toàn cục (0-based) tương ứng với section và trang đang chọn trong trình soạn thảo. */
export function findGlobalSlideIndex(
  deck: PresentationDeck,
  sectionId: string | undefined,
  slideIndexInSection = 0,
): number {
  if (deck.slides.length === 0) return 0;
  if (!sectionId) return 0;

  const summary = deck.sections.find((item) => item.sectionId === sectionId);
  if (!summary || summary.slideCount === 0) return 0;

  const clampedInSection = Math.min(Math.max(0, slideIndexInSection), summary.slideCount - 1);
  return Math.min(summary.startIndex + clampedInSection, deck.slides.length - 1);
}
