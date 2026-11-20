import type {
  CustomSlideTheme,
  EditableSlideItem,
  ImageCategory,
  ImageFitMode,
  Mass,
  MassSection,
  MassThemeId,
  SlideAspectRatio,
  SlideBackgroundImage,
  SlideFontFamily,
  SlideTextAlign,
  Song,
  SongPart,
  TextStyle,
} from "@/lib/pptmass-types";
import {
  DEFAULT_CUSTOM_THEME,
  SLIDE_FONT_OPTIONS,
  clampLineSpacingPt,
  clampSlideFontPt,
  clampTitleFontPt,
  getSlideTypography,
  getTitleTypography,
  normalizeHexColor,
} from "@/lib/slide-utils";
import { toTitleCaseVi } from "@/lib/utils";

const VALID_ASPECT_RATIOS = new Set<SlideAspectRatio>(["16:9", "4:3"]);
const VALID_THEME_IDS = new Set<MassThemeId>(["pure-white", "warm-light", "lenten-violet", "feast-red", "custom"]);
const VALID_FONT_SIZES = new Set<TextStyle["fontSize"]>(["medium", "large", "xlarge"]);
const VALID_ALIGNS = new Set<SlideTextAlign>(["justify", "center", "left"]);
const VALID_FONTS = new Set<SlideFontFamily>(SLIDE_FONT_OPTIONS.map((opt) => opt.value));
const VALID_IMAGE_CATEGORIES = new Set<ImageCategory>(["cover", "reading", "other"]);
const VALID_IMAGE_FITS = new Set<ImageFitMode>(["cover", "contain"]);
const ASSET_REF_PREFIX = "@asset:";

export type NormalizedSongPayload = {
  title: string;
  author?: string;
  notes?: string;
  pdfUrl?: string;
  isPublic: boolean;
  categories: string[];
  topics: string[];
  parts: SongPart[];
};

export type NormalizedPrayerPayload = {
  title: string;
  content: string;
};

export type ExportPptxRequestPayload = {
  mass: Mass;
  songs?: Song[];
  /** Kho tài nguyên ảnh nội tuyến đã khử trùng lặp (tránh gửi lặp cùng 1 chuỗi base64 qua nhiều slide). */
  assets?: Record<string, string>;
};

/** Chuẩn hóa văn bản nhiều dòng: thống nhất \n, xóa khoảng trắng thừa cuối dòng và gộp dòng trống dư. */
export function normalizeMultilineText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSlideBody(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/[ \t]+$/, "");
}

function deduplicateStrings(items: string[] | undefined): string[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of items) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

export function normalizeCustomTheme(theme?: CustomSlideTheme): CustomSlideTheme {
  const src = theme ?? DEFAULT_CUSTOM_THEME;
  const angle = typeof src.angle === "number" && Number.isFinite(src.angle) ? Math.min(360, Math.max(0, Math.round(src.angle))) : 135;
  return {
    mode: src.mode === "solid" ? "solid" : "gradient",
    colorFrom: normalizeHexColor(src.colorFrom ?? "", DEFAULT_CUSTOM_THEME.colorFrom),
    colorTo: normalizeHexColor(src.colorTo ?? "", DEFAULT_CUSTOM_THEME.colorTo),
    angle,
    textColor: src.textColor === "light" ? "light" : "dark",
  };
}

function normalizeBackgroundImage(
  bg: SlideBackgroundImage | undefined,
  transformUrl?: (url: string) => string,
): SlideBackgroundImage | undefined {
  const rawUrl = typeof bg?.url === "string" ? bg.url.trim() : "";
  if (!rawUrl) return undefined;
  const opacity =
    typeof bg?.opacity === "number" && Number.isFinite(bg.opacity)
      ? Math.min(100, Math.max(0, Math.round(bg.opacity)))
      : 25;
  const url = transformUrl ? transformUrl(rawUrl) : rawUrl;
  return {
    url,
    opacity,
    ...(bg?.fit === "contain" ? { fit: "contain" as const } : {}),
  };
}

function normalizeTextStyle(
  style: TextStyle | undefined,
  legacyTextProps?: {
    titleFontFamily?: SlideFontFamily;
    titleFontSize?: TextStyle["fontSize"];
    titleFontSizePt?: number;
    titleLineSpacingPt?: number;
    titleAlign?: SlideTextAlign;
    titleColor?: string;
    contentColor?: string;
  },
): TextStyle {
  const fontSize: TextStyle["fontSize"] =
    style?.fontSize && VALID_FONT_SIZES.has(style.fontSize) ? style.fontSize : "xlarge";

  const fontSizePt =
    typeof style?.fontSizePt === "number" && Number.isFinite(style.fontSizePt)
      ? clampSlideFontPt(style.fontSizePt)
      : undefined;
  const effectiveBodyPt = getSlideTypography(fontSize, fontSizePt).fontSizePt;
  const lineSpacingPt =
    typeof style?.lineSpacingPt === "number" && Number.isFinite(style.lineSpacingPt)
      ? clampLineSpacingPt(style.lineSpacingPt, effectiveBodyPt)
      : undefined;

  const fontFamily =
    style?.fontFamily && VALID_FONTS.has(style.fontFamily) && style.fontFamily !== "Arial"
      ? style.fontFamily
      : undefined;
  const textAlign =
    style?.textAlign && VALID_ALIGNS.has(style.textAlign) && style.textAlign !== "justify"
      ? style.textAlign
      : undefined;

  const rawContentColor = style?.contentColor ?? legacyTextProps?.contentColor;
  const contentColor =
    typeof rawContentColor === "string" && rawContentColor.trim()
      ? normalizeHexColor(rawContentColor, "#0f172a")
      : undefined;

  const rawTitleFont = style?.titleFontFamily ?? legacyTextProps?.titleFontFamily;
  const titleFontFamily =
    rawTitleFont && VALID_FONTS.has(rawTitleFont) && rawTitleFont !== "Arial" ? rawTitleFont : undefined;

  const rawTitlePt = style?.titleFontSizePt ?? legacyTextProps?.titleFontSizePt;
  const titleFontSizePt =
    typeof rawTitlePt === "number" && Number.isFinite(rawTitlePt) ? clampTitleFontPt(rawTitlePt) : undefined;
  const effectiveTitlePt = getTitleTypography(legacyTextProps?.titleFontSize ?? "large", titleFontSizePt).fontSizePt;
  const rawTitleLinePt = style?.titleLineSpacingPt ?? legacyTextProps?.titleLineSpacingPt;
  const titleLineSpacingPt =
    typeof rawTitleLinePt === "number" && Number.isFinite(rawTitleLinePt)
      ? clampLineSpacingPt(rawTitleLinePt, effectiveTitlePt)
      : undefined;

  const rawTitleAlign = style?.titleAlign ?? legacyTextProps?.titleAlign;
  const titleAlign =
    rawTitleAlign && VALID_ALIGNS.has(rawTitleAlign) && rawTitleAlign !== "center" ? rawTitleAlign : undefined;

  const rawTitleColor = style?.titleColor ?? legacyTextProps?.titleColor;
  const titleColor =
    typeof rawTitleColor === "string" && rawTitleColor.trim()
      ? normalizeHexColor(rawTitleColor, "#dc2626")
      : undefined;

  return {
    fontSize,
    ...(fontSizePt !== undefined ? { fontSizePt } : {}),
    ...(lineSpacingPt !== undefined ? { lineSpacingPt } : {}),
    ...(fontFamily ? { fontFamily } : {}),
    ...(textAlign ? { textAlign } : {}),
    ...(contentColor ? { contentColor } : {}),
    ...(titleFontFamily ? { titleFontFamily } : {}),
    ...(titleFontSizePt !== undefined ? { titleFontSizePt } : {}),
    ...(titleLineSpacingPt !== undefined ? { titleLineSpacingPt } : {}),
    ...(titleAlign ? { titleAlign } : {}),
    ...(titleColor ? { titleColor } : {}),
    showTitleOnEverySlide: Boolean(style?.showTitleOnEverySlide),
  };
}

function normalizeEditableSlide(
  slide: EditableSlideItem,
  sectionTitle: string,
  options?: { forExport?: boolean; transformUrl?: (url: string) => string },
): EditableSlideItem {
  const headingTrimmed = typeof slide.heading === "string" ? slide.heading.trim() : undefined;
  const keepHeading = headingTrimmed !== undefined && headingTrimmed !== sectionTitle;

  const isTitleOnly = slide.showBody === false;
  const subheadingTrimmed = typeof slide.subheading === "string" ? slide.subheading.trim() : "";
  const keepSubheading = Boolean(isTitleOnly && slide.showSubheading && subheadingTrimmed);

  const body = typeof slide.body === "string" ? normalizeSlideBody(slide.body) : "";
  const bodyPrefix = typeof slide.bodyPrefix === "string" && slide.bodyPrefix.trim() ? slide.bodyPrefix.trim() : undefined;
  const backgroundImage = normalizeBackgroundImage(slide.backgroundImage, options?.transformUrl);

  const normalized: EditableSlideItem = {
    id: typeof slide.id === "string" && slide.id.trim() ? slide.id.trim() : "s-1",
    body,
    ...(keepHeading ? { heading: headingTrimmed } : {}),
    ...(slide.showHeading !== undefined ? { showHeading: slide.showHeading } : {}),
    ...(keepSubheading ? { subheading: subheadingTrimmed, showSubheading: true } : {}),
    ...(bodyPrefix ? { bodyPrefix } : {}),
    ...(slide.showBody === false ? { showBody: false } : {}),
    ...(backgroundImage ? { backgroundImage } : {}),
  };

  // Khi lưu dài hạn, giữ thêm cờ flowWithPrev & joinSeparator để reflow 2 chiều hoạt động khi mở lại;
  // khi xuất PPTX chỉ cần nội dung hiển thị nên bỏ sạch metadata chỉnh sửa.
  if (!options?.forExport) {
    if (slide.partLabel?.trim()) normalized.partLabel = slide.partLabel.trim();
    if (slide.flowWithPrev) {
      normalized.flowWithPrev = true;
      if (slide.joinSeparator !== undefined) {
        normalized.joinSeparator = slide.joinSeparator;
      }
    }
  }

  return normalized;
}

/**
 * Chuẩn hóa một section trước khi lưu lên Supabase (`saved_sections`) hoặc gửi tới API xuất `.pptx`:
 * - Loại bỏ trường trùng lặp, trường legacy (`extraSlides`, `showPartPrefix`, `partOrder` khi đã có `slides`),
 *   `customTheme` không dùng tới, và các giá trị mặc định/rỗng gây phình JSONB.
 */
export function normalizeSectionForStorage(
  section: MassSection,
  options?: { titleOverride?: string; forExport?: boolean; transformUrl?: (url: string) => string },
): MassSection {
  const title = (options?.titleOverride ?? section.title ?? "").trim();

  if (section.kind === "image") {
    const rawUrl = typeof section.imageUrl === "string" ? section.imageUrl.trim() : "";
    const imageUrl = rawUrl ? (options?.transformUrl ? options.transformUrl(rawUrl) : rawUrl) : undefined;
    const imageCategory =
      section.imageCategory && VALID_IMAGE_CATEGORIES.has(section.imageCategory) ? section.imageCategory : undefined;
    const imageFit = section.imageFit && VALID_IMAGE_FITS.has(section.imageFit) ? section.imageFit : undefined;
    return {
      id: section.id,
      kind: "image",
      title,
      ...(!options?.forExport && section.savedSectionId ? { savedSectionId: section.savedSectionId } : {}),
      ...(!options?.forExport && imageCategory ? { imageCategory } : {}),
      ...(imageUrl ? { imageUrl } : {}),
      ...(imageFit === "contain" ? { imageFit } : {}),
    };
  }

  const themeId = section.themeId && VALID_THEME_IDS.has(section.themeId) ? section.themeId : undefined;
  const customTheme = themeId === "custom" ? normalizeCustomTheme(section.customTheme) : undefined;

  const slides = Array.isArray(section.slides)
    ? section.slides.length > 0
      ? section.slides.map((slide) => normalizeEditableSlide(slide, title, options))
      : section.kind === "song"
        ? []
        : undefined
    : undefined;

  if (section.kind === "text") {
    const style = normalizeTextStyle(section.style, {
      titleFontFamily: section.titleFontFamily,
      titleFontSize: section.titleFontSize,
      titleFontSizePt: section.titleFontSizePt,
      titleLineSpacingPt: section.titleLineSpacingPt,
      titleAlign: section.titleAlign,
      titleColor: section.titleColor,
      contentColor: section.contentColor,
    });
    const keepTitleFontSize =
      style.titleFontSizePt === undefined &&
      section.titleFontSize &&
      VALID_FONT_SIZES.has(section.titleFontSize) &&
      section.titleFontSize !== "large"
        ? section.titleFontSize
        : undefined;
    return {
      id: section.id,
      kind: "text",
      title,
      ...(!options?.forExport && section.savedSectionId ? { savedSectionId: section.savedSectionId } : {}),
      // Khi đã có `slides`, không lặp lại toàn bộ văn bản ở `content` hoặc `extraSlides`
      content: slides ? "" : normalizeSlideBody(section.content ?? ""),
      ...(slides ? { slides } : section.extraSlides?.length ? { extraSlides: section.extraSlides } : {}),
      ...(section.showTitle === false ? { showTitle: false } : {}),
      ...(section.showContent === false ? { showContent: false } : {}),
      ...(keepTitleFontSize ? { titleFontSize: keepTitleFontSize } : {}),
      ...(themeId ? { themeId } : {}),
      ...(customTheme ? { customTheme } : {}),
      style,
    };
  }

  const style = normalizeTextStyle(section.style);

  if (section.kind === "prayer") {
    return {
      id: section.id,
      kind: "prayer",
      title,
      ...(!options?.forExport && section.savedSectionId ? { savedSectionId: section.savedSectionId } : {}),
      ...(!options?.forExport && section.prayerId ? { prayerId: section.prayerId } : {}),
      content: slides ? "" : normalizeMultilineText(section.content ?? ""),
      ...(slides ? { slides } : {}),
      ...(themeId ? { themeId } : {}),
      ...(customTheme ? { customTheme } : {}),
      style,
    };
  }

  // kind === "song"
  return {
    id: section.id,
    kind: "song",
    title,
    ...(!options?.forExport && section.savedSectionId ? { savedSectionId: section.savedSectionId } : {}),
    songId: section.songId,
    ...(!slides && section.partOrder?.length ? { partOrder: section.partOrder } : {}),
    ...(slides ? { slides } : {}),
    ...(themeId ? { themeId } : {}),
    ...(customTheme ? { customTheme } : {}),
    style,
  };
}

/**
 * Đóng gói payload tối giản cho `POST /api/export-pptx`:
 * 1) Chỉ giữ các trường cần thiết cho việc dựng file PowerPoint (bỏ toàn bộ metadata UI/DB).
 * 2) Chỉ gửi các bài hát thật sự cần (những section bài hát cũ chưa có `slides`) thay vì gửi toàn bộ thư viện 200+ bài!
 * 3) Khử trùng lặp ảnh nội tuyến (Data URL / URL dài lặp lại trên nhiều slide) sang bảng `assets`.
 */
export function buildExportPptxPayload(mass: Mass, songLookup: Map<string, Song>): ExportPptxRequestPayload {
  const urlToAssetRef = new Map<string, string>();
  const assets: Record<string, string> = {};
  let assetCounter = 0;

  const deduplicateImageUrl = (url: string): string => {
    if (!url.startsWith("data:") && url.length <= 256) return url;
    const existing = urlToAssetRef.get(url);
    if (existing) return existing;
    const ref = `${ASSET_REF_PREFIX}${assetCounter}`;
    assetCounter += 1;
    urlToAssetRef.set(url, ref);
    assets[ref] = url;
    return ref;
  };

  const normalizedSections = mass.sections.map((section) =>
    normalizeSectionForStorage(section, { forExport: true, transformUrl: deduplicateImageUrl }),
  );

  // Chỉ đính kèm lời bài hát gốc cho những song section cũ chưa có mảng `slides`
  const neededSongs: Song[] = [];
  const addedSongIds = new Set<string>();
  for (const section of normalizedSections) {
    if (section.kind === "song" && !Array.isArray(section.slides)) {
      if (addedSongIds.has(section.songId)) continue;
      const song = songLookup.get(section.songId);
      if (!song) continue;
      addedSongIds.add(song.id);
      neededSongs.push({
        id: song.id,
        title: song.title,
        tags: [],
        updatedAt: "",
        parts: song.parts.map((part) => ({
          id: part.id,
          kind: part.kind,
          label: part.label,
          lyrics: part.lyrics,
        })),
      });
    }
  }

  const aspectRatio: SlideAspectRatio = VALID_ASPECT_RATIOS.has(mass.aspectRatio) ? mass.aspectRatio : "16:9";
  const themeId: MassThemeId = VALID_THEME_IDS.has(mass.themeId) ? mass.themeId : "pure-white";

  const compactMass: Mass = {
    id: mass.id || "export",
    title: mass.title.trim() || "Thánh lễ",
    celebrationDate: mass.celebrationDate?.trim() ?? "",
    aspectRatio,
    themeId,
    ...(themeId === "custom" ? { customTheme: normalizeCustomTheme(mass.customTheme) } : {}),
    isPublic: false,
    ...(mass.createdByName?.trim() ? { createdByName: mass.createdByName.trim() } : {}),
    sections: normalizedSections,
  };

  return {
    mass: compactMass,
    ...(neededSongs.length > 0 ? { songs: neededSongs } : {}),
    ...(assetCounter > 0 ? { assets } : {}),
  };
}

/** Giải nén & chuẩn hóa payload nhận được tại server route `POST /api/export-pptx`. */
export function hydrateExportPptxPayload(payload: ExportPptxRequestPayload): { mass: Mass; songs: Song[] } {
  const assets = payload.assets && typeof payload.assets === "object" ? payload.assets : undefined;
  const resolveAssetUrl = (url: string): string => {
    if (assets && url.startsWith(ASSET_REF_PREFIX) && typeof assets[url] === "string") {
      return assets[url];
    }
    return url;
  };

  const aspectRatio: SlideAspectRatio = VALID_ASPECT_RATIOS.has(payload.mass.aspectRatio)
    ? payload.mass.aspectRatio
    : "16:9";
  const themeId: MassThemeId = VALID_THEME_IDS.has(payload.mass.themeId) ? payload.mass.themeId : "pure-white";

  const hydratedMass: Mass = {
    id: typeof payload.mass.id === "string" && payload.mass.id.trim() ? payload.mass.id.trim() : "export",
    title: typeof payload.mass.title === "string" ? payload.mass.title.trim() : "Thánh lễ",
    celebrationDate: typeof payload.mass.celebrationDate === "string" ? payload.mass.celebrationDate.trim() : "",
    aspectRatio,
    themeId,
    ...(themeId === "custom" ? { customTheme: normalizeCustomTheme(payload.mass.customTheme) } : {}),
    isPublic: false,
    ...(typeof payload.mass.createdByName === "string" && payload.mass.createdByName.trim()
      ? { createdByName: payload.mass.createdByName.trim() }
      : {}),
    sections: payload.mass.sections.map((section) =>
      normalizeSectionForStorage(section, { forExport: true, transformUrl: resolveAssetUrl }),
    ),
  };

  const hydratedSongs = Array.isArray(payload.songs) ? payload.songs : [];
  return { mass: hydratedMass, songs: hydratedSongs };
}

/**
 * Chuẩn hóa lời của từng phần bài hát (Phiên khúc / Điệp khúc / Coda):
 * - Xóa toàn bộ ký tự xuống dòng (\r, \n) để mỗi câu/phần hát là 1 dòng xuyên suốt.
 * - Gộp mọi khoảng trắng dư (nhiều space, tab, NBSP) thành đúng 1 dấu cách và xóa khoảng trắng đầu cuối.
 */
export function normalizeSongLyrics(value: string): string {
  return value.replace(/[\r\n\t\u00a0\s]+/g, " ").trim();
}

/** Chuẩn hóa dữ liệu bài hát trước khi gửi lên Server Action `createSong` / `updateSong`. */
export function normalizeSongPayload(input: NormalizedSongPayload): NormalizedSongPayload {
  const title = toTitleCaseVi(input.title ?? "");
  const author = input.author ? toTitleCaseVi(input.author) : "";
  const notes = input.notes ? normalizeSongLyrics(input.notes) : "";
  const rawPdfUrl = typeof input.pdfUrl === "string" ? input.pdfUrl.trim() : "";
  const pdfUrl = /^https?:\/\/\S+$/i.test(rawPdfUrl) ? rawPdfUrl : "";

  const parts: SongPart[] = (input.parts ?? [])
    .map((part, idx) => ({
      id: typeof part.id === "string" && part.id.trim() ? part.id.trim() : `part-${idx + 1}`,
      kind: part.kind,
      label: part.label.replace(/\s+/g, " ").trim(),
      lyrics: normalizeSongLyrics(part.lyrics),
    }))
    .filter((part) => part.lyrics.length > 0);

  return {
    title,
    ...(author ? { author } : {}),
    ...(notes ? { notes } : {}),
    ...(pdfUrl ? { pdfUrl } : {}),
    isPublic: Boolean(input.isPublic),
    categories: deduplicateStrings(input.categories),
    topics: deduplicateStrings(input.topics),
    parts,
  };
}

/** Chuẩn hóa dữ liệu kinh trước khi gửi lên Server Action `createPrayer` / `updatePrayer`. */
export function normalizePrayerPayload(input: NormalizedPrayerPayload): NormalizedPrayerPayload {
  return {
    title: (input.title ?? "").trim().replace(/\s+/g, " "),
    content: normalizeMultilineText(input.content ?? ""),
  };
}
