import type { CSSProperties } from "react";

import type {
  CustomSlideTheme,
  EditableSlideItem,
  ImageFitMode,
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

export const PPTX_FONT_FACE = "Arial";
export const SLIDE_FONT_FAMILY = "Arial, Helvetica, sans-serif";
export const SLIDE_DPI = 96;

export type SlideBoxIn = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Kích thước chuẩn của PowerPoint: LAYOUT_WIDE (13.333" x 7.5" = 1280x720px) và LAYOUT_4x3 (10" x 7.5" = 960x720px). */
export function getSlideDimensions(aspectRatio: SlideAspectRatio) {
  if (aspectRatio === "4:3") {
    return { widthIn: 10, heightIn: 7.5, widthPx: 960, heightPx: 720 };
  }
  return { widthIn: 13.333, heightIn: 7.5, widthPx: 1280, heightPx: 720 };
}

/** Tọa độ hộp Tiêu đề và Nội dung tính theo inch — dùng chung 1:1 giữa xem trước web và file .pptx. */
export function getSlideLayoutBoxes(
  aspectRatio: SlideAspectRatio,
  hasHeading: boolean,
  hasBody: boolean,
): { headingBox?: SlideBoxIn; bodyBox?: SlideBoxIn } {
  const { widthIn, heightIn } = getSlideDimensions(aspectRatio);
  const marginX = 0.25;
  const marginY = 0.2;
  const contentW = Number((widthIn - marginX * 2).toFixed(3));

  if (hasHeading && hasBody) {
    const headingH = 1.05;
    const gap = 0.12;
    const bodyY = marginY + headingH + gap;
    return {
      headingBox: { x: marginX, y: marginY, w: contentW, h: headingH },
      bodyBox: { x: marginX, y: bodyY, w: contentW, h: Number((heightIn - bodyY - marginY).toFixed(3)) },
    };
  }

  if (hasHeading) {
    return {
      headingBox: { x: marginX, y: marginY, w: contentW, h: Number((heightIn - marginY * 2).toFixed(3)) },
    };
  }

  return {
    bodyBox: { x: marginX, y: marginY, w: contentW, h: Number((heightIn - marginY * 2).toFixed(3)) },
  };
}

export type PresetThemeId = Exclude<MassThemeId, "custom">;

export type MassThemeConfig = {
  id: PresetThemeId;
  label: string;
  swatchClass: string;
  canvasClass: string;
  overlayClass: string;
  titleClass: string;
  bodyClass: string;
  mutedClass: string;
};

export const PRESET_THEMES: Record<PresetThemeId, MassThemeConfig> = {
  "pure-white": {
    id: "pure-white",
    label: "Nền Trắng (Mặc định)",
    swatchClass: "bg-white border border-slate-300",
    canvasClass: "bg-white text-slate-950 border border-slate-200",
    overlayClass: "",
    titleClass: "text-red-600",
    bodyClass: "text-slate-950",
    mutedClass: "text-slate-500",
  },
  "warm-light": {
    id: "warm-light",
    label: "Trắng Kem Trang Nhã",
    swatchClass: "bg-[#f8f3e9] border border-amber-300",
    canvasClass: "bg-[#fbf8f1] text-slate-900 border border-amber-200/70",
    overlayClass:
      "bg-[radial-gradient(circle_at_85%_10%,rgba(217,119,6,.12),transparent_42%),linear-gradient(140deg,#fdfbf6,#f3ead8)]",
    titleClass: "text-amber-800",
    bodyClass: "text-slate-900",
    mutedClass: "text-slate-500",
  },
  "lenten-violet": {
    id: "lenten-violet",
    label: "Tím Mùa Chay / Vọng",
    swatchClass: "bg-[#3f2459]",
    canvasClass: "bg-[#341d4b] text-white",
    overlayClass:
      "bg-[radial-gradient(circle_at_75%_0%,rgba(216,180,254,.28),transparent_40%),linear-gradient(130deg,#251338,#4d2a70_55%,#221133)]",
    titleClass: "text-amber-200",
    bodyClass: "text-white",
    mutedClass: "text-white/60",
  },
  "feast-red": {
    id: "feast-red",
    label: "Đỏ Lễ Trọng",
    swatchClass: "bg-[#6b1d28]",
    canvasClass: "bg-[#5a1620] text-white",
    overlayClass:
      "bg-[radial-gradient(circle_at_80%_0%,rgba(251,191,36,.32),transparent_38%),linear-gradient(130deg,#420e16,#7c212e_55%,#3c0d14)]",
    titleClass: "text-amber-200",
    bodyClass: "text-white",
    mutedClass: "text-white/60",
  },
};

export const DEFAULT_CUSTOM_THEME: CustomSlideTheme = {
  mode: "gradient",
  colorFrom: "#f8fafc",
  colorTo: "#e2e8f0",
  angle: 135,
  textColor: "dark",
};

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function normalizeHexColor(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (HEX_COLOR_RE.test(trimmed)) return trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`;
  return fallback;
}

export function getCustomThemeBackgroundStyle(custom: CustomSlideTheme): CSSProperties {
  const from = normalizeHexColor(custom.colorFrom, DEFAULT_CUSTOM_THEME.colorFrom);
  const to = normalizeHexColor(custom.colorTo, DEFAULT_CUSTOM_THEME.colorTo);
  if (custom.mode === "solid") {
    return { backgroundColor: from };
  }
  return { backgroundImage: `linear-gradient(${custom.angle}deg, ${from}, ${to})` };
}

export function resolveSlideTheme(themeId: MassThemeId, customTheme?: CustomSlideTheme) {
  if (themeId === "custom") {
    const custom = customTheme ?? DEFAULT_CUSTOM_THEME;
    const isDarkText = custom.textColor === "dark";
    return {
      canvasClass: isDarkText ? "text-slate-950 border border-slate-200/80" : "text-white",
      canvasStyle: getCustomThemeBackgroundStyle(custom),
      overlayClass: "",
      titleClass: isDarkText ? "text-red-600" : "text-amber-200",
      bodyClass: isDarkText ? "text-slate-950" : "text-white",
      mutedClass: isDarkText ? "text-slate-600" : "text-white/60",
    };
  }

  const preset = PRESET_THEMES[themeId] ?? PRESET_THEMES["pure-white"];
  return {
    canvasClass: preset.canvasClass,
    canvasStyle: undefined as CSSProperties | undefined,
    overlayClass: preset.overlayClass,
    titleClass: preset.titleClass,
    bodyClass: preset.bodyClass,
    mutedClass: preset.mutedClass,
  };
}

export const SLIDE_FONT_OPTIONS: {
  value: SlideFontFamily;
  label: string;
  cssFont: string;
  pptxFont: string;
  widthScale: number;
}[] = [
  { value: "Arial", label: "Arial (Mặc định)", cssFont: "Arial, Helvetica, sans-serif", pptxFont: "Arial", widthScale: 1 },
  {
    value: "Times New Roman",
    label: "Times New Roman",
    cssFont: '"Times New Roman", Times, serif',
    pptxFont: "Times New Roman",
    widthScale: 0.9,
  },
  {
    value: "Calibri",
    label: "Calibri",
    cssFont: 'Calibri, "Segoe UI", sans-serif',
    pptxFont: "Calibri",
    widthScale: 0.87,
  },
  { value: "Georgia", label: "Georgia", cssFont: "Georgia, serif", pptxFont: "Georgia", widthScale: 1.12 },
  { value: "Tahoma", label: "Tahoma", cssFont: "Tahoma, Geneva, sans-serif", pptxFont: "Tahoma", widthScale: 1.04 },
  { value: "Verdana", label: "Verdana", cssFont: "Verdana, Geneva, sans-serif", pptxFont: "Verdana", widthScale: 1.16 },
];

export function getSlideFontOption(font?: SlideFontFamily) {
  return SLIDE_FONT_OPTIONS.find((item) => item.value === font) ?? SLIDE_FONT_OPTIONS[0];
}

export const MIN_SLIDE_FONT_PT = 28;
export const MAX_SLIDE_FONT_PT = 140;
export const MIN_TITLE_FONT_PT = 20;
export const MAX_TITLE_FONT_PT = 140;

export function clampSlideFontPt(pt: number): number {
  if (!Number.isFinite(pt)) return 85;
  return Math.min(MAX_SLIDE_FONT_PT, Math.max(MIN_SLIDE_FONT_PT, Math.round(pt)));
}

export function clampTitleFontPt(pt: number): number {
  if (!Number.isFinite(pt)) return 70;
  return Math.min(MAX_TITLE_FONT_PT, Math.max(MIN_TITLE_FONT_PT, Math.round(pt)));
}

export function clampLineSpacingPt(pt: number, fontSizePt: number): number {
  const minPt = Math.max(16, Math.round(fontSizePt * 0.85));
  const maxPt = Math.round(fontSizePt * 2.5);
  if (!Number.isFinite(pt)) return fontSizePt === 85 ? 105 : Math.round(fontSizePt * 1.24);
  return Math.min(maxPt, Math.max(minPt, Math.round(pt)));
}

/** Cỡ chữ & khoảng cách dòng tính bằng Point (pt) chuẩn dùng đồng bộ cho cả web (1280x720 / 960x720) và PowerPoint. */
export function getSlideTypography(
  fontSize: TextStyle["fontSize"],
  customFontSizePt?: number,
  customLineSpacingPt?: number,
): { fontSizePt: number; lineSpacingPt: number } {
  let fontSizePt = 85;
  let defaultLinePt = 105;
  if (typeof customFontSizePt === "number" && Number.isFinite(customFontSizePt)) {
    fontSizePt = clampSlideFontPt(customFontSizePt);
    defaultLinePt = fontSizePt === 85 ? 105 : Math.round(fontSizePt * 1.2);
  } else if (fontSize === "medium") {
    fontSizePt = 44;
    defaultLinePt = 54;
  } else if (fontSize === "large") {
    fontSizePt = 56;
    defaultLinePt = 68;
  }
  const lineSpacingPt =
    typeof customLineSpacingPt === "number" && Number.isFinite(customLineSpacingPt)
      ? clampLineSpacingPt(customLineSpacingPt, fontSizePt)
      : defaultLinePt;
  return { fontSizePt, lineSpacingPt };
}

/** Cỡ chữ tiêu đề tính bằng Point (pt) chuẩn dùng đồng bộ cho cả web và PowerPoint. */
export function getTitleTypography(
  fontSize: TextStyle["fontSize"],
  customFontSizePt?: number,
  customLineSpacingPt?: number,
): { fontSizePt: number; lineSpacingPt: number } {
  let fontSizePt = 42;
  let defaultLinePt = 50;
  if (typeof customFontSizePt === "number" && Number.isFinite(customFontSizePt)) {
    fontSizePt = clampTitleFontPt(customFontSizePt);
    defaultLinePt = Math.round(fontSizePt * 1.18);
  } else if (fontSize === "medium") {
    fontSizePt = 34;
    defaultLinePt = 42;
  } else if (fontSize === "xlarge") {
    fontSizePt = 52;
    defaultLinePt = 62;
  }
  const lineSpacingPt =
    typeof customLineSpacingPt === "number" && Number.isFinite(customLineSpacingPt)
      ? clampLineSpacingPt(customLineSpacingPt, fontSizePt)
      : defaultLinePt;
  return { fontSizePt, lineSpacingPt };
}

export type SlidePreviewItem = {
  id: string;
  kind: MassSection["kind"];
  heading?: string;
  headingFont?: SlideFontFamily;
  headingPt?: number;
  headingLinePt?: number;
  headingColor?: string;
  headingAlign?: SlideTextAlign;
  subheading?: string;
  bodyPrefix?: string;
  body?: string;
  bodyFont?: SlideFontFamily;
  bodyPt?: number;
  bodyLinePt?: number;
  bodyColor?: string;
  bodyAlign?: SlideTextAlign;
  backgroundImage?: SlideBackgroundImage;
  imageUrl?: string;
  imageFit?: ImageFitMode;
  partLabel?: string;
  emptyHint?: string;
};

function cloneEditableSlides(slides: EditableSlideItem[] | undefined, prefixId: string): EditableSlideItem[] | undefined {
  if (!slides) return undefined;
  return slides.map((slide, idx) => ({
    ...slide,
    id: `${prefixId}-s-${idx + 1}`,
    backgroundImage: slide.backgroundImage ? { ...slide.backgroundImage } : undefined,
  }));
}

/** Nhân bản sâu một section với ID mới (dùng cho Nhân đôi hoặc chèn từ Section đã lưu). */
export function cloneSectionWithNewId(
  section: MassSection,
  newId: string,
  options?: { keepSavedSectionId?: boolean; overrideSavedSectionId?: string },
): MassSection {
  const savedSectionId =
    options?.overrideSavedSectionId !== undefined
      ? options.overrideSavedSectionId
      : options?.keepSavedSectionId
        ? section.savedSectionId
        : undefined;

  if (section.kind === "image") {
    return {
      ...section,
      id: newId,
      savedSectionId,
    };
  }
  if (section.kind === "text") {
    return {
      ...section,
      id: newId,
      savedSectionId,
      customTheme: section.customTheme ? { ...section.customTheme } : undefined,
      style: { ...section.style },
      slides: cloneEditableSlides(section.slides, newId),
      extraSlides: section.extraSlides?.map((slide, idx) => ({
        ...slide,
        id: `${newId}-slide-${idx + 2}`,
      })),
    };
  }
  if (section.kind === "prayer") {
    return {
      ...section,
      id: newId,
      savedSectionId,
      customTheme: section.customTheme ? { ...section.customTheme } : undefined,
      style: { ...section.style },
      slides: cloneEditableSlides(section.slides, newId),
    };
  }
  return {
    ...section,
    id: newId,
    savedSectionId,
    customTheme: section.customTheme ? { ...section.customTheme } : undefined,
    partOrder: section.partOrder ? [...section.partOrder] : undefined,
    slides: cloneEditableSlides(section.slides, newId),
    style: { ...section.style },
  };
}

/** Bề rộng khả dụng thực tế (tính bằng pt) của khung nội dung, dùng thống nhất 1 nguồn giữa chia slide ban đầu và reflow 2 chiều. */
function getUsableBodyWidthPt(aspectRatio: SlideAspectRatio, fontFamily?: SlideFontFamily): number {
  const { bodyBox } = getSlideLayoutBoxes(aspectRatio, false, true);
  const fontScale = getSlideFontOption(fontFamily).widthScale;
  // Chừa 2% dự phòng subpixel/kerning giữa trình duyệt (Windows/macOS) và PowerPoint để không bao giờ bị cắt dòng
  return ((bodyBox?.w ?? 12.833) * 72 * 0.98) / fontScale;
}

/** Tính sức chứa số dòng hiển thị tối đa của bodyBox dựa trên chiều cao thực tế (pt) và lineSpacingPt. */
function getNaturalSlideLineCapacity(
  fontSize: TextStyle["fontSize"],
  aspectRatio: SlideAspectRatio,
  hasHeading: boolean,
  customFontSizePt?: number,
  customLineSpacingPt?: number,
): number {
  const { lineSpacingPt } = getSlideTypography(fontSize, customFontSizePt, customLineSpacingPt);
  const { bodyBox } = getSlideLayoutBoxes(aspectRatio, hasHeading, true);
  // Dung sai +0.005 dòng chỉ để chống sai số dấu phẩy động, tuyệt đối không nhận dư dòng gây cắt khung dọc
  const usableHeightPt = (bodyBox?.h ?? 5.7) * 72;
  return Math.max(1, Math.floor((usableHeightPt + lineSpacingPt * 0.005) / lineSpacingPt));
}

/** Tỉ lệ bề rộng thực tế của từng ký tự theo bảng metrics TrueType Arial Bold chuẩn (arialbd.ttf, unitsPerEm = 2048). */
function estimateArialBoldCharFactor(char: string): number {
  // Bỏ qua dấu tổ hợp NFD (không chiếm độ rộng ngang riêng)
  if (char >= "\u0300" && char <= "\u036f") return 0;
  if (char === " ") return 0.278;
  if (".,'|".includes(char)) return 0.278;
  if (":;!()-/\\\"".includes(char)) return 0.333;
  if ("–“”".includes(char)) return 0.556;
  if ("‘’".includes(char)) return 0.278;
  if (char === "—" || char === "…") return 1.0;
  if (char === "?") return 0.611;
  if (char === "%") return 0.889;
  if (char === "@") return 0.975;
  if (char === "&") return 0.722;
  if ("0123456789".includes(char)) return 0.556;

  // Chuẩn hóa NFD: tách riêng dấu móc (U+031B) của ơ/ư/Ơ/Ư (cả 5 thanh điệu) trước khi bỏ các dấu thanh khác
  const nfd = char.normalize("NFD");
  const hasHorn = nfd.includes("\u031b");
  const base = nfd.replace(/[\u0300-\u036f]/g, "");
  if (hasHorn) {
    if (base === "O") return 0.853;
    if (base === "U") return 0.83;
    if (base === "o") return 0.711;
    if (base === "u") return 0.724;
  }
  if (base === "W") return 0.944;
  if (base === "M") return 0.833;
  if (base === "G" || base === "O" || base === "Q") return 0.778;
  if (base === "J") return 0.556;
  if (base === "F" || base === "L" || base === "T" || base === "Z") return 0.611;
  if ("EPSVXY".includes(base)) return 0.667;
  if (base === "Đ" || (base >= "A" && base <= "Z")) return 0.722;
  if (base === "m") return 0.889;
  if (base === "w") return 0.778;
  if ("ijlI".includes(base)) return 0.278;
  if ("ft".includes(base)) return 0.333;
  if (base === "r") return 0.389;
  if (base === "z") return 0.5;
  if ("aceksvxy".includes(base)) return 0.556;
  const cp = char.codePointAt(0) ?? 0;
  // Ký tự rộng (emoji, biểu tượng toán học, chữ CJK...) chiếm bề rộng lớn hơn chữ Latin
  if (cp >= 0x2600) return 1.15;
  return 0.611;
}

function estimateArialBoldWidthPt(text: string, fontSizePt: number): number {
  let factorSum = 0;
  for (const ch of text) {
    factorSum += estimateArialBoldCharFactor(ch);
  }
  return factorSum * fontSizePt;
}

/**
 * Đếm chính xác số dòng hiển thị của một đoạn văn.
 * Khi gặp 1 từ không dấu cách dài vượt 1 dòng, ngắt từng ký tự rời rạc (discrete glyph wrapping)
 * khớp 1:1 với cơ chế `overflow-wrap: break-word` của trình duyệt và PowerPoint.
 */
function countWrappedLinesForParagraph(paragraph: string, maxWidthPt: number, fontSizePt: number): number {
  const words = paragraph.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;

  let lineCount = 1;
  let currentLineWidth = 0;
  const spaceWidth = estimateArialBoldCharFactor(" ") * fontSizePt;

  const placeLongWord = (word: string) => {
    currentLineWidth = 0;
    for (const ch of word) {
      const chWidth = estimateArialBoldCharFactor(ch) * fontSizePt;
      if (currentLineWidth > 0 && currentLineWidth + chWidth > maxWidthPt) {
        lineCount += 1;
        currentLineWidth = chWidth;
      } else {
        currentLineWidth += chWidth;
      }
    }
  };

  for (const word of words) {
    const wordWidth = estimateArialBoldWidthPt(word, fontSizePt);
    if (currentLineWidth === 0) {
      if (wordWidth <= maxWidthPt) {
        currentLineWidth = wordWidth;
      } else {
        placeLongWord(word);
      }
      continue;
    }

    if (currentLineWidth + spaceWidth + wordWidth <= maxWidthPt) {
      currentLineWidth += spaceWidth + wordWidth;
    } else {
      lineCount += 1;
      if (wordWidth <= maxWidthPt) {
        currentLineWidth = wordWidth;
      } else {
        placeLongWord(word);
      }
    }
  }
  return lineCount;
}

/** Đếm tổng số dòng hiển thị của chuỗi văn bản (có thể gồm nhiều đoạn cách nhau bởi \n). */
function measureVisualLineCount(text: string, maxWidthPt: number, fontSizePt: number): number {
  const paragraphs = text.split("\n");
  let total = 0;
  for (const para of paragraphs) {
    total += countWrappedLinesForParagraph(para, maxWidthPt, fontSizePt);
  }
  return total;
}

/**
 * Chia văn bản thành các slide vừa khít hộp chữ (bodyBox) thông qua cùng động cơ `reflowTextToChunks`:
 * - Dòng trống (\n\n) luôn chủ động ngắt sang slide mới.
 * - Dùng chung 100% logic đo chữ với trình chỉnh sửa trực tiếp nên không bao giờ lệch khi tạo section mới.
 */
export function splitTextIntoSlideChunks(
  text: string,
  fontSize: TextStyle["fontSize"] = "xlarge",
  aspectRatio: SlideAspectRatio = "16:9",
  firstSlideHasHeading = false,
  nextSlidesHaveHeading?: boolean,
  customFontSizePt?: number,
  options?: {
    leadingPrefix?: string;
    preserveLineBreaks?: boolean;
    fontFamily?: SlideFontFamily;
    customLineSpacingPt?: number;
  },
): string[] {
  const leadingPrefix = options?.leadingPrefix?.trim() || undefined;
  const preserveLineBreaks = options?.preserveLineBreaks ?? false;
  const effectiveNextHeading = nextSlidesHaveHeading ?? firstSlideHasHeading;

  const blocks = text
    .split(/\r?\n\s*\r?\n/)
    .map((block) =>
      block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length > 0);

  const slides: string[] = [];

  for (const blockLines of blocks) {
    const isFirstBlock = slides.length === 0;
    const blockText = preserveLineBreaks ? blockLines.join("\n") : blockLines.join(" ");
    const chunks = reflowTextToChunks(blockText, {
      fontSize,
      customFontSizePt,
      customLineSpacingPt: options?.customLineSpacingPt,
      fontFamily: options?.fontFamily,
      aspectRatio,
      firstSlideHasHeading: isFirstBlock ? firstSlideHasHeading : effectiveNextHeading,
      nextSlidesHaveHeading: effectiveNextHeading,
      leadingPrefix: isFirstBlock ? leadingPrefix : undefined,
    });
    for (const chunk of chunks) {
      const cleaned = chunk.body.trim();
      if (cleaned) slides.push(cleaned);
    }
  }

  return slides;
}

const LEADING_PART_PREFIX_RE = /^((?:ĐK|DK|Coda|Kết)\s*\d*\s*[:.]|\d+\s*[:.)])\s+/i;

/** Tạo ký hiệu/số câu hiển thị ở đầu mỗi phần bài hát (ĐK:, 1., 2., Coda:, ...). */
export function formatSongPartPrefix(part: SongPart, allParts: SongPart[]): string {
  const numMatch = part.label.match(/(\d+)/);
  const num = numMatch ? Number(numMatch[1]) : undefined;

  if (part.kind === "chorus") {
    const chorusCount = allParts.filter((item) => item.kind === "chorus").length;
    if (num && (chorusCount > 1 || num > 1)) {
      return `ĐK ${num}:`;
    }
    return "ĐK:";
  }

  if (part.kind === "verse") {
    if (num) return `${num}.`;
    const verseIndex = allParts.filter((item) => item.kind === "verse").findIndex((item) => item.id === part.id);
    return `${verseIndex >= 0 ? verseIndex + 1 : 1}.`;
  }

  if (/coda/i.test(part.label)) {
    return num && num > 1 ? `Coda ${num}:` : "Coda:";
  }
  if (/kết/i.test(part.label)) {
    return "Kết:";
  }
  const cleanLabel = part.label.trim().replace(/[:.]+$/, "");
  return cleanLabel ? `${cleanLabel}:` : "Đoạn:";
}

/** Mặc định khi thêm bài hát: chỉ chọn sẵn 1 phần Điệp khúc đầu tiên (hoặc phần đầu nếu không có Điệp khúc). */
export function buildDefaultSongPartOrder(parts: SongPart[]): string[] {
  if (parts.length === 0) return [];
  const primaryChorus = parts.find((part) => part.kind === "chorus");
  return [primaryChorus ? primaryChorus.id : parts[0].id];
}

/** Tiện ích nhanh: rải Điệp khúc xen kẽ sau mỗi Phiên khúc để người dùng bấm nếu muốn. */
export function buildRepeatChorusOrder(parts: SongPart[]): string[] {
  if (parts.length === 0) return [];
  const primaryChorus = parts.find((part) => part.kind === "chorus");
  if (!primaryChorus) return parts.map((part) => part.id);

  const order: string[] = [primaryChorus.id];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part.id === primaryChorus.id && order[order.length - 1] === primaryChorus.id) {
      continue;
    }
    order.push(part.id);
    const nextPart = parts[i + 1];
    if (part.kind === "verse" && nextPart?.id !== primaryChorus.id) {
      order.push(primaryChorus.id);
    }
  }
  return order;
}

/** Xác định trạng thái ẩn/hiện Tiêu đề & Nội dung cho từng slide (thống nhất dùng chung giữa Editor, Reflow & Export PPTX). */
export function resolveSlideVisibility(
  section: Exclude<MassSection, { kind: "image" }>,
  slideItem: EditableSlideItem | undefined,
  slideIndex: number,
): { showHeading: boolean; showBody: boolean } {
  const showHeading =
    slideItem?.showHeading !== undefined
      ? slideItem.showHeading
      : section.kind === "text"
        ? section.showTitle !== false && (slideIndex === 0 || section.style.showTitleOnEverySlide)
        : slideIndex === 0 || Boolean(section.style.showTitleOnEverySlide);

  const showBody =
    slideItem?.showBody !== undefined
      ? slideItem.showBody
      : section.kind === "text"
        ? section.showContent !== false
        : true;

  return { showHeading, showBody };
}

/**
 * Đổ lời của 1 phần bài hát (Điệp khúc / Phiên khúc) thành danh sách EditableSlideItem.
 * Khi `firstSlideHasHeading = true`, slide đầu tiên hiển thị tiêu đề bài hát, các slide tràn sau ẩn tiêu đề (trừ khi bật `showTitleOnEverySlide`).
 */
export function createEditableSlidesFromSongPart(
  song: Song,
  part: SongPart,
  style: TextStyle,
  aspectRatio: SlideAspectRatio = "16:9",
  idPrefix = "slide",
  firstSlideHasHeading?: boolean,
): EditableSlideItem[] {
  const trimmedLyrics = part.lyrics.trim();
  const manualPrefixMatch = trimmedLyrics.match(LEADING_PART_PREFIX_RE);
  const partPrefix = manualPrefixMatch ? manualPrefixMatch[1].trim() : formatSongPartPrefix(part, song.parts);
  const effectiveLyrics = manualPrefixMatch ? trimmedLyrics.slice(manualPrefixMatch[0].length) : part.lyrics;

  const firstHeading = firstSlideHasHeading ?? Boolean(style.showTitleOnEverySlide);
  const nextHeading = Boolean(style.showTitleOnEverySlide);
  const chunks = splitTextIntoSlideChunks(
    effectiveLyrics,
    style.fontSize,
    aspectRatio,
    firstHeading,
    nextHeading,
    style.fontSizePt,
    {
      leadingPrefix: partPrefix,
      fontFamily: style.fontFamily,
      customLineSpacingPt: style.lineSpacingPt,
    },
  );

  if (chunks.length === 0) {
    return [
      {
        id: `${idPrefix}-0`,
        partLabel: part.label,
        showHeading: firstHeading,
        bodyPrefix: partPrefix,
        body: "",
        showBody: true,
      },
    ];
  }

  return chunks.map((body, idx) => ({
    id: `${idPrefix}-${idx}`,
    partLabel: part.label,
    showHeading: idx === 0 ? firstHeading : nextHeading,
    bodyPrefix: idx === 0 ? partPrefix : undefined,
    body,
    showBody: true,
    flowWithPrev: idx > 0,
    joinSeparator: idx > 0 ? " " : undefined,
  }));
}

/** Đổ danh sách phần hát (partOrder) thành EditableSlideItem[] ban đầu — mặc định hiển thị Tiêu đề ở slide đầu tiên. */
export function createEditableSlidesFromSongOrder(
  song: Song,
  partOrder: string[],
  style: TextStyle,
  aspectRatio: SlideAspectRatio = "16:9",
  idPrefix = "song-slide",
  firstSlideHasHeading = true,
): EditableSlideItem[] {
  const partsMap = new Map(song.parts.map((part) => [part.id, part]));
  const orderedIds = partOrder.length > 0 ? partOrder : buildDefaultSongPartOrder(song.parts);
  const result: EditableSlideItem[] = [];

  orderedIds.forEach((partId, orderIdx) => {
    const part = partsMap.get(partId);
    if (!part) return;
    const showHeadingOnFirst = result.length === 0 ? firstSlideHasHeading : Boolean(style.showTitleOnEverySlide);
    result.push(
      ...createEditableSlidesFromSongPart(song, part, style, aspectRatio, `${idPrefix}-${orderIdx}`, showHeadingOnFirst),
    );
  });

  if (result.length === 0) {
    return [{ id: `${idPrefix}-empty`, showHeading: firstSlideHasHeading, body: "", showBody: true }];
  }
  return result;
}

/** Đổ nội dung một bài kinh thành EditableSlideItem[] ban đầu (mỗi đoạn tách bởi dòng trống là 1 nhóm luồng riêng). */
export function createEditableSlidesFromPrayer(
  title: string,
  content: string,
  style: TextStyle,
  aspectRatio: SlideAspectRatio = "16:9",
  idPrefix = "prayer-slide",
): EditableSlideItem[] {
  const hasTitleText = Boolean(title.trim());
  const rawBlocks = content
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (rawBlocks.length === 0) {
    return [{ id: `${idPrefix}-0`, showHeading: hasTitleText, body: "", showBody: true }];
  }

  const result: EditableSlideItem[] = [];
  rawBlocks.forEach((block, blockIdx) => {
    const isFirstOverall = result.length === 0;
    const chunks = splitTextIntoSlideChunks(
      block,
      style.fontSize,
      aspectRatio,
      hasTitleText && (isFirstOverall || style.showTitleOnEverySlide),
      hasTitleText && style.showTitleOnEverySlide,
      style.fontSizePt,
      { fontFamily: style.fontFamily, customLineSpacingPt: style.lineSpacingPt },
    );
    chunks.forEach((body, chunkIdx) => {
      const slideIndex = result.length;
      result.push({
        id: `${idPrefix}-${blockIdx}-${chunkIdx}`,
        showHeading: hasTitleText && (slideIndex === 0 || style.showTitleOnEverySlide),
        body,
        showBody: true,
        flowWithPrev: chunkIdx > 0,
        joinSeparator: chunkIdx > 0 ? " " : undefined,
      });
    });
  });

  return result;
}

/**
 * Lấy danh sách EditableSlideItem của một section không phải Hình ảnh.
 * - Nếu section đã có `section.slides` → trả trực tiếp 1:1 (KHÔNG tự nhảy chữ!).
 * - Nếu là dữ liệu cũ chưa có `slides` → khởi tạo 1 lần từ `content`/`extraSlides`/`partOrder`.
 */
export function getEffectiveEditableSlides(
  section: Exclude<MassSection, { kind: "image" }>,
  song?: Song,
  aspectRatio: SlideAspectRatio = "16:9",
): EditableSlideItem[] {
  // Section bài hát cho phép chủ động rỗng (`slides: []`) cho tới khi người dùng chèn lời
  if (section.kind === "song" && Array.isArray(section.slides)) {
    return section.slides;
  }

  if (section.slides && section.slides.length > 0) {
    return section.slides;
  }

  if (section.kind === "text") {
    const showTitle = section.showTitle !== false;
    const showContent = section.showContent !== false;
    return [
      {
        id: `${section.id}-s-1`,
        showHeading: showTitle,
        body: section.content,
        showBody: showContent,
        flowWithPrev: false,
      },
      ...(section.extraSlides ?? []).map((extra, idx) => ({
        id: extra.id || `${section.id}-s-${idx + 2}`,
        showHeading: showTitle && Boolean(section.style.showTitleOnEverySlide),
        body: extra.content,
        showBody: showContent,
        flowWithPrev: false,
      })),
    ];
  }

  if (section.kind === "prayer") {
    return createEditableSlidesFromPrayer(section.title, section.content, section.style, aspectRatio, `${section.id}-p`);
  }

  if (!song) {
    return [{ id: `${section.id}-missing`, showHeading: true, body: "", showBody: true, flowWithPrev: false }];
  }

  return createEditableSlidesFromSongOrder(
    song,
    section.partOrder && section.partOrder.length > 0 ? section.partOrder : buildDefaultSongPartOrder(song.parts),
    section.style,
    aspectRatio,
    `${section.id}-sg`,
  );
}

export type ReflowedChunk = {
  body: string;
  /** Ký tự ngăn cách gốc giữa slide trước và slide này trong luồng văn bản ("", " " hoặc "\n"). */
  joinSeparator?: "" | " " | "\n";
  /** Vị trí bắt đầu (inclusive) của chunk này trong `fullText`. */
  startOffset: number;
  /** Vị trí kết thúc (exclusive) của chunk này trong `fullText`. */
  endOffset: number;
};

type TextSegment = {
  kind: "newline" | "space" | "word";
  text: string;
  start: number;
  end: number;
};

function tokenizePreserveAll(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /(\n)|([ \t]+)|([^\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const segText = match[0];
    const start = match.index;
    const end = start + segText.length;
    if (match[1]) {
      segments.push({ kind: "newline", text: segText, start, end });
    } else if (match[2]) {
      segments.push({ kind: "space", text: segText, start, end });
    } else {
      segments.push({ kind: "word", text: segText, start, end });
    }
  }
  return segments;
}

/** Bước nhảy code-point an toàn (không bao giờ cắt đôi surrogate pair UTF-16). */
function getCodePointBoundaries(text: string, start: number, end: number): number[] {
  const boundaries: number[] = [];
  let idx = start;
  while (idx < end) {
    const cp = text.codePointAt(idx);
    idx += cp !== undefined && cp > 0xffff ? 2 : 1;
    boundaries.push(idx);
  }
  return boundaries;
}

/**
 * Chia lại (reflow) một luồng văn bản liên tục thành các slide vừa khít viewport,
 * bảo toàn 100% vị trí ký tự (startOffset..endOffset) để đồng bộ con trỏ và chảy chữ 2 chiều (tràn qua & kéo về).
 */
  export function reflowTextToChunks(
  rawFullText: string,
  options: {
    fontSize: TextStyle["fontSize"];
    customFontSizePt?: number;
    customLineSpacingPt?: number;
    fontFamily?: SlideFontFamily;
    aspectRatio: SlideAspectRatio;
    firstSlideHasHeading: boolean;
    nextSlidesHaveHeading: boolean;
    leadingPrefix?: string;
    /** Nếu con trỏ đang đứng ngay sau khoảng trắng ở điểm ngắt slide, giữ lại khoảng trắng đó trên slide trước. */
    preserveTrailingSpaceAtCursor?: number;
  },
): ReflowedChunk[] {
  const fullText = rawFullText.replace(/\r\n/g, "\n");
  if (!fullText) {
    return [{ body: "", startOffset: 0, endOffset: 0 }];
  }

  const { fontSizePt } = getSlideTypography(options.fontSize, options.customFontSizePt, options.customLineSpacingPt);
  const firstMaxLines = getNaturalSlideLineCapacity(
    options.fontSize,
    options.aspectRatio,
    options.firstSlideHasHeading,
    options.customFontSizePt,
    options.customLineSpacingPt,
  );
  const nextMaxLines = getNaturalSlideLineCapacity(
    options.fontSize,
    options.aspectRatio,
    options.nextSlidesHaveHeading,
    options.customFontSizePt,
    options.customLineSpacingPt,
  );
  const usableWidthPt = getUsableBodyWidthPt(options.aspectRatio, options.fontFamily);
  const leadingPrefix = options.leadingPrefix?.trim() || undefined;
  const preserveSpaceCursor = options.preserveTrailingSpaceAtCursor;

  const countLines = (text: string, prefix?: string) => {
    const measured = prefix ? `${prefix} ${text}` : text;
    return measureVisualLineCount(measured, usableWidthPt, fontSizePt);
  };

  if (countLines(fullText, leadingPrefix) <= firstMaxLines) {
    return [{ body: fullText, startOffset: 0, endOffset: fullText.length }];
  }

  const segments = tokenizePreserveAll(fullText);
  const chunks: ReflowedChunk[] = [];
  let chunkStart = 0;
  let chunkEnd = 0;
  let currentJoinSep: "" | " " | "\n" | undefined;

  const activeLimit = () => (chunks.length === 0 ? firstMaxLines : nextMaxLines);
  const activePrefix = () => (chunks.length === 0 ? leadingPrefix : undefined);
  const fitsActive = (candidate: string) => countLines(candidate, activePrefix()) <= activeLimit();

  for (const seg of segments) {
    if (seg.kind === "space") {
      // Khoảng trắng ngang không tự tạo dòng mới -> giữ nguyên để không nuốt phím Space
      chunkEnd = seg.end;
      continue;
    }

    if (seg.kind === "newline") {
      const candidate = fullText.slice(chunkStart, seg.end);
      if (fitsActive(candidate)) {
        chunkEnd = seg.end;
      } else {
        chunks.push({
          body: fullText.slice(chunkStart, chunkEnd),
          joinSeparator: currentJoinSep,
          startOffset: chunkStart,
          endOffset: chunkEnd,
        });
        chunkStart = seg.end;
        chunkEnd = seg.end;
        currentJoinSep = "\n";
      }
      continue;
    }

    // seg.kind === "word"
    const candidate = fullText.slice(chunkStart, seg.end);
    if (fitsActive(candidate)) {
      chunkEnd = seg.end;
      continue;
    }

    // Nếu slide hiện tại đã có chữ -> ngắt slide trước từ này (tôn trọng biên từ)
    if (chunkEnd > chunkStart) {
      let trimmedEnd = chunkEnd;
      while (trimmedEnd > chunkStart && (fullText[trimmedEnd - 1] === " " || fullText[trimmedEnd - 1] === "\t")) {
        trimmedEnd -= 1;
      }
      const keepEnd =
        preserveSpaceCursor !== undefined && preserveSpaceCursor > trimmedEnd && preserveSpaceCursor <= chunkEnd
          ? preserveSpaceCursor
          : trimmedEnd;

      chunks.push({
        body: fullText.slice(chunkStart, keepEnd),
        joinSeparator: currentJoinSep,
        startOffset: chunkStart,
        endOffset: keepEnd,
      });

      chunkStart = seg.start;
      chunkEnd = seg.start;
      currentJoinSep = " ";
    }

    // Kiểm tra xem bản thân từ đơn có vừa 1 slide mới không
    if (fitsActive(fullText.slice(chunkStart, seg.end))) {
      chunkEnd = seg.end;
      continue;
    }

    // Trường hợp hiếm: 1 chuỗi không có dấu cách dài vượt cả chiều cao slide -> tách theo ký tự bằng tìm kiếm nhị phân
    let pos = seg.start;
    while (pos < seg.end) {
      const boundaries = getCodePointBoundaries(fullText, pos, seg.end);
      if (boundaries.length === 0) break;

      let low = 0;
      let high = boundaries.length - 1;
      let best = 0; // luôn tiến ít nhất 1 code-point để không bao giờ lặp vô hạn
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (fitsActive(fullText.slice(pos, boundaries[mid]))) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      const splitEnd = boundaries[best];
      if (splitEnd < seg.end) {
        chunks.push({
          body: fullText.slice(pos, splitEnd),
          joinSeparator: currentJoinSep,
          startOffset: pos,
          endOffset: splitEnd,
        });
        pos = splitEnd;
        chunkStart = pos;
        chunkEnd = pos;
        currentJoinSep = "";
      } else {
        chunkEnd = seg.end;
        break;
      }
    }
  }

  chunks.push({
    body: fullText.slice(chunkStart, chunkEnd),
    joinSeparator: currentJoinSep,
    startOffset: chunkStart,
    endOffset: chunkEnd,
  });

  return chunks;
}

export function mapGlobalCursorToChunk(
  chunks: ReflowedChunk[],
  globalCursor: number,
  preferStayOnPrev = false,
): { chunkIdx: number; localOffset: number } {
  for (let i = 0; i < chunks.length; i += 1) {
    const c = chunks[i];
    if (globalCursor >= c.startOffset && globalCursor <= c.endOffset) {
      return { chunkIdx: i, localOffset: globalCursor - c.startOffset };
    }
    if (i + 1 < chunks.length && globalCursor > c.endOffset && globalCursor < chunks[i + 1].startOffset) {
      if (preferStayOnPrev) {
        return { chunkIdx: i, localOffset: c.body.length };
      }
      return { chunkIdx: i + 1, localOffset: 0 };
    }
  }
  const lastIdx = Math.max(0, chunks.length - 1);
  return { chunkIdx: lastIdx, localOffset: chunks[lastIdx]?.body.length ?? 0 };
}

export type SlideEditOperation =
  | { kind: "replaceBody"; slideIndex: number; nextBody: string; cursorOffset: number | null }
  | { kind: "forwardDeleteAtEnd"; slideIndex: number }
  | { kind: "backspaceAtStart"; slideIndex: number };

export type ReflowSlidesResult = {
  slides: EditableSlideItem[];
  targetSlideIndex: number;
  targetCursorOffset: number | null;
  didSplit: boolean;
  didMerge: boolean;
};

/** Nhận diện slide tràn cũ (lưu trước khi có cờ `flowWithPrev`) để tự tương thích chảy chữ 2 chiều. */
function isSlideFlowingFromPrev(slide: EditableSlideItem, prevSlide: EditableSlideItem | undefined): boolean {
  if (!prevSlide) return false;
  if (prevSlide.showBody === false || slide.showBody === false) return false;
  if (slide.flowWithPrev === true) return true;
  if (slide.flowWithPrev === false) return false;
  return /-p\d+$/.test(slide.id) && !slide.bodyPrefix && slide.partLabel === prevSlide.partLabel;
}

/**
 * Động cơ chảy chữ 2 chiều (bidirectional reflow) chuẩn PowerPoint/Word cho danh sách slide của section:
 * - Các slide cùng luồng (`flowWithPrev: true`) tự động chảy tràn sang slide mới khi gõ quá dòng/tăng cỡ chữ,
 *   VÀ tự động kéo chữ từ slide sau quay về slide trước (xóa slide thừa) khi xóa chữ/giảm cỡ chữ.
 * - Bấm `Delete` ở cuối slide trước hoặc `Backspace` ở đầu slide sau sẽ trực tiếp gỡ ranh giới và nối 2 slide lại.
 */
export function reflowEditableSlides(
  inputSlides: EditableSlideItem[],
  section: Exclude<MassSection, { kind: "image" }>,
  aspectRatio: SlideAspectRatio,
  editOp?: SlideEditOperation,
  activeSlideIndex?: number,
  preserveTrailingSpaceSlideIndex?: number,
): ReflowSlidesResult {
  if (inputSlides.length === 0) {
    return { slides: [], targetSlideIndex: 0, targetCursorOffset: 0, didSplit: false, didMerge: false };
  }

  // Bước 1: Nếu người dùng chủ động nhấn Delete ở cuối slide i hoặc Backspace ở đầu slide i,
  // nối slide liền kề vào cùng 1 luồng văn bản trước khi reflow.
  const workingSlides = inputSlides.map((s) => ({ ...s }));
  let mergeDirection: "forwardDelete" | "backspace" | null = null;
  const opSlideIndex = editOp?.slideIndex ?? activeSlideIndex ?? 0;

  if (editOp?.kind === "forwardDeleteAtEnd") {
    if (editOp.slideIndex < 0 || editOp.slideIndex >= workingSlides.length - 1) {
      return {
        slides: workingSlides,
        targetSlideIndex: Math.min(Math.max(0, editOp.slideIndex), workingSlides.length - 1),
        targetCursorOffset: workingSlides[editOp.slideIndex]?.body.length ?? 0,
        didSplit: false,
        didMerge: false,
      };
    }
    const prevSlide = workingSlides[editOp.slideIndex];
    const nextSlide = workingSlides[editOp.slideIndex + 1];
    if (prevSlide.showBody === false || nextSlide.showBody === false) {
      return {
        slides: workingSlides,
        targetSlideIndex: editOp.slideIndex,
        targetCursorOffset: prevSlide.body.length,
        didSplit: false,
        didMerge: false,
      };
    }
    const alreadyFlowing = isSlideFlowingFromPrev(nextSlide, prevSlide);
    workingSlides[editOp.slideIndex + 1] = {
      ...nextSlide,
      flowWithPrev: true,
      joinSeparator: alreadyFlowing ? (nextSlide.joinSeparator ?? " ") : "\n",
    };
    mergeDirection = "forwardDelete";
  } else if (editOp?.kind === "backspaceAtStart") {
    if (editOp.slideIndex <= 0 || editOp.slideIndex >= workingSlides.length) {
      return {
        slides: workingSlides,
        targetSlideIndex: 0,
        targetCursorOffset: 0,
        didSplit: false,
        didMerge: false,
      };
    }
    const prevSlide = workingSlides[editOp.slideIndex - 1];
    const curSlide = workingSlides[editOp.slideIndex];
    if (prevSlide.showBody === false || curSlide.showBody === false) {
      return {
        slides: workingSlides,
        targetSlideIndex: editOp.slideIndex,
        targetCursorOffset: 0,
        didSplit: false,
        didMerge: false,
      };
    }
    const alreadyFlowing = isSlideFlowingFromPrev(curSlide, prevSlide);
    workingSlides[editOp.slideIndex] = {
      ...curSlide,
      flowWithPrev: true,
      joinSeparator: alreadyFlowing ? (curSlide.joinSeparator ?? " ") : "\n",
    };
    mergeDirection = "backspace";
  }

  // Bước 2: Phân tách `workingSlides` thành các nhóm luồng liên tục (flow groups) theo cờ `flowWithPrev`
  type FlowGroup = { startIndex: number; slides: EditableSlideItem[] };
  const groups: FlowGroup[] = [];
  for (let i = 0; i < workingSlides.length; i += 1) {
    const slide = workingSlides[i];
    if (i > 0 && isSlideFlowingFromPrev(slide, workingSlides[i - 1]) && groups.length > 0) {
      groups[groups.length - 1].slides.push(slide);
    } else {
      groups.push({ startIndex: i, slides: [slide] });
    }
  }

  const showPartPrefix = section.kind === "song";
  const nextSlidesHaveHeading =
    section.kind === "text"
      ? section.showTitle !== false && Boolean(section.style.showTitleOnEverySlide)
      : Boolean(section.style.showTitleOnEverySlide);

  const usedIds = new Set<string>(workingSlides.map((s) => s.id));
  const nextUniqueSlideId = (baseId: string, suffix: number) => {
    let candidate = `${baseId}-p${suffix}`;
    let counter = suffix;
    while (usedIds.has(candidate)) {
      counter += 1;
      candidate = `${baseId}-p${counter}`;
    }
    usedIds.add(candidate);
    return candidate;
  };

  const finalSlides: EditableSlideItem[] = [];
  let targetSlideIndex = Math.min(opSlideIndex, workingSlides.length - 1);
  let targetCursorOffset: number | null = editOp?.kind === "replaceBody" ? editOp.cursorOffset : null;
  let didSplit = false;
  let didMerge = false;

  for (const group of groups) {
    const groupEndIndex = group.startIndex + group.slides.length - 1;
    const isActiveGroup = editOp !== undefined && opSlideIndex >= group.startIndex && opSlideIndex <= groupEndIndex;
    const headSlide = group.slides[0];

    const headShowBody =
      headSlide.showBody !== undefined
        ? headSlide.showBody
        : section.kind === "text"
          ? section.showContent !== false
          : true;

    // Nếu cả nhóm đang ẩn nội dung (VD: Slide tiêu đề riêng) -> giữ nguyên
    if (!headShowBody) {
      finalSlides.push(...group.slides);
      continue;
    }

    // Ghép toàn bộ luồng văn bản của nhóm kèm bảng vị trí bắt đầu từng slide
    let fullText = "";
    const slideStarts: number[] = [];
    for (let i = 0; i < group.slides.length; i += 1) {
      if (i > 0) {
        const sep = group.slides[i].joinSeparator ?? " ";
        if (sep === "\n") {
          fullText += "\n";
        } else if (
          sep === " " &&
          fullText.length > 0 &&
          !/\s$/.test(fullText) &&
          group.slides[i].body.length > 0 &&
          !/^\s/.test(group.slides[i].body)
        ) {
          fullText += " ";
        }
      }
      slideStarts.push(fullText.length);
      fullText += group.slides[i].body;
    }

    let nextFullText = fullText;
    let nextGlobalCursor: number | null = null;
    let preserveTrailingSpaceAtCursor: number | undefined;
    let preferStayOnPrev = false;

    if (
      !editOp &&
      preserveTrailingSpaceSlideIndex !== undefined &&
      preserveTrailingSpaceSlideIndex >= group.startIndex &&
      preserveTrailingSpaceSlideIndex <= groupEndIndex
    ) {
      const pLocalIdx = preserveTrailingSpaceSlideIndex - group.startIndex;
      const pBody = group.slides[pLocalIdx]?.body ?? "";
      if (pBody.length > 0 && (pBody.endsWith(" ") || pBody.endsWith("\t"))) {
        preserveTrailingSpaceAtCursor = slideStarts[pLocalIdx] + pBody.length;
      }
    }

    if (isActiveGroup && editOp) {
      const localIdx = opSlideIndex - group.startIndex;
      const oldBody = group.slides[localIdx].body;
      const localStart = slideStarts[localIdx];
      const localEnd = localStart + oldBody.length;

      if (editOp.kind === "replaceBody") {
        const before = fullText.slice(0, localStart);
        let after = fullText.slice(localEnd);
        const nextBody = editOp.nextBody.replace(/\r\n/g, "\n");
        const localCursor = editOp.cursorOffset ?? nextBody.length;
        const isShrinking = nextBody.length < oldBody.length;

        if (localIdx < group.slides.length - 1) {
          const nextSep = group.slides[localIdx + 1].joinSeparator ?? " ";
          if (nextSep === " ") {
            if (
              after.startsWith(" ") &&
              (nextBody.endsWith(" ") || nextBody.endsWith("\t") || nextBody.endsWith("\n") || nextBody.length === 0)
            ) {
              // Tránh tạo dấu cách kép ("  ") khi người dùng gõ space / xóa về space / nhấn Enter / xóa trắng slide
              after = after.slice(1);
            } else if (
              nextBody.length > 0 &&
              !/\s$/.test(nextBody) &&
              after.length > 0 &&
              !/^\s/.test(after)
            ) {
              // Giữ ranh giới từ (" ") nếu slide trước vừa có khoảng trắng tạm ở cuối rồi gõ thêm chữ hoặc xóa space đó
              after = ` ${after}`;
            }
          }
        }

        nextFullText = before + nextBody + after;
        nextGlobalCursor = localStart + localCursor;

        // Nếu người dùng đang gõ hoặc xóa và con trỏ nằm ngay sau dấu cách cuối của slide hiện tại -> giữ dấu cách đó trên slide hiện tại
        if (
          localCursor === nextBody.length &&
          nextBody.length > 0 &&
          (nextBody.endsWith(" ") || nextBody.endsWith("\t"))
        ) {
          preserveTrailingSpaceAtCursor = nextGlobalCursor;
        }
        if (isShrinking) {
          preferStayOnPrev = true;
        }
      } else if (mergeDirection === "forwardDelete") {
        const nextSlideBody = group.slides[localIdx + 1]?.body ?? "";
        const nextSlideStart = slideStarts[localIdx + 1];
        if (nextSlideBody === "") {
          // Slide sau đang trống -> xóa luôn dấu ngăn cách và slide trống
          nextFullText = fullText.slice(0, localEnd) + fullText.slice(nextSlideStart);
          nextGlobalCursor = localEnd;
        } else if (localEnd < fullText.length) {
          // Xóa đúng 1 ký tự ngay sau con trỏ (dấu \n nối dòng, dấu cách nối từ, hoặc ký tự đầu của slide sau)
          nextFullText = fullText.slice(0, localEnd) + fullText.slice(localEnd + 1);
          nextGlobalCursor = localEnd;
        } else {
          nextGlobalCursor = localEnd;
        }
        preferStayOnPrev = true;
      } else if (mergeDirection === "backspace") {
        const curSlideBody = group.slides[localIdx]?.body ?? "";
        if (localStart > 0) {
          if (curSlideBody === "") {
            // Slide hiện tại đang trống -> xóa sạch dấu ngăn cách trước nó để quay về cuối slide trước
            const prevEnd = slideStarts[localIdx - 1] + group.slides[localIdx - 1].body.length;
            nextFullText = fullText.slice(0, prevEnd) + fullText.slice(localStart);
            nextGlobalCursor = prevEnd;
          } else {
            // Xóa đúng 1 ký tự ngay trước vị trí 0 của slide hiện tại (\n hoặc dấu cách nối)
            nextFullText = fullText.slice(0, localStart - 1) + fullText.slice(localStart);
            nextGlobalCursor = localStart - 1;
          }
        } else {
          nextGlobalCursor = 0;
        }
        preferStayOnPrev = true;
      }
    }

    const { showHeading: headShowHeading } = resolveSlideVisibility(section, headSlide, group.startIndex);

    const headingTitleText = (headSlide.heading ?? section.title).trim();
    const leadingPrefix = showPartPrefix ? headSlide.bodyPrefix : undefined;

    const reflowedChunks = reflowTextToChunks(nextFullText, {
      fontSize: section.style.fontSize,
      customFontSizePt: section.style.fontSizePt,
      customLineSpacingPt: section.style.lineSpacingPt,
      fontFamily: section.style.fontFamily,
      aspectRatio,
      firstSlideHasHeading: headShowHeading && Boolean(headingTitleText),
      nextSlidesHaveHeading: nextSlidesHaveHeading && Boolean(headingTitleText),
      leadingPrefix,
      preserveTrailingSpaceAtCursor,
    });

    if (reflowedChunks.length > group.slides.length) didSplit = true;
    if (reflowedChunks.length < group.slides.length) didMerge = true;

    const outputGroupStart = finalSlides.length;

    reflowedChunks.forEach((chunk, chunkIdx) => {
      const existing = group.slides[chunkIdx];
      if (chunkIdx === 0) {
        finalSlides.push({
          ...headSlide,
          body: chunk.body,
          flowWithPrev: false,
          joinSeparator: undefined,
        });
      } else {
        finalSlides.push({
          id: existing?.id ?? nextUniqueSlideId(headSlide.id, chunkIdx + 1),
          partLabel: existing?.partLabel ?? headSlide.partLabel,
          heading: existing?.heading ?? headSlide.heading,
          showHeading: nextSlidesHaveHeading,
          body: chunk.body,
          showBody: true,
          backgroundImage: existing?.backgroundImage
            ? { ...existing.backgroundImage }
            : headSlide.backgroundImage
              ? { ...headSlide.backgroundImage }
              : undefined,
          flowWithPrev: true,
          joinSeparator: chunk.joinSeparator !== undefined ? chunk.joinSeparator : " ",
        });
      }
    });

    if (isActiveGroup && nextGlobalCursor !== null) {
      const mapped = mapGlobalCursorToChunk(reflowedChunks, nextGlobalCursor, preferStayOnPrev);
      targetSlideIndex = outputGroupStart + mapped.chunkIdx;
      targetCursorOffset = mapped.localOffset;
    } else if (!editOp && opSlideIndex >= group.startIndex && opSlideIndex <= groupEndIndex) {
      const localOffsetIdx = opSlideIndex - group.startIndex;
      targetSlideIndex = outputGroupStart + Math.min(localOffsetIdx, reflowedChunks.length - 1);
    }
  }

  return {
    slides: finalSlides,
    targetSlideIndex: Math.min(Math.max(0, targetSlideIndex), Math.max(0, finalSlides.length - 1)),
    targetCursorOffset,
    didSplit,
    didMerge,
  };
}

/**
 * Sắp xếp lại thứ tự các slide khi người dùng kéo thả trong viewport ngang.
 * Tự động ngắt cờ `flowWithPrev` tại những vị trí có slide đứng trước thay đổi
 * để giữ nguyên đúng thứ tự người dùng đã kéo thả mà không bị reflow gom ngược về thứ tự cũ.
 */
export function reorderEditableSlides(
  slides: EditableSlideItem[],
  fromIndex: number,
  toIndex: number,
): EditableSlideItem[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= slides.length ||
    toIndex >= slides.length
  ) {
    return slides;
  }

  const prevIdBefore = new Map<string, string | null>();
  slides.forEach((item, idx) => {
    prevIdBefore.set(item.id, idx > 0 ? slides[idx - 1].id : null);
  });

  const moved = [...slides];
  const [picked] = moved.splice(fromIndex, 1);
  moved.splice(toIndex, 0, picked);

  return moved.map((slide, idx) => {
    if (idx === 0) {
      return { ...slide, flowWithPrev: false, joinSeparator: undefined };
    }
    const prevIdNow = moved[idx - 1].id;
    if (prevIdNow !== prevIdBefore.get(slide.id)) {
      return { ...slide, flowWithPrev: false, joinSeparator: undefined };
    }
    return slide;
  });
}

/**
 * Di chuyển đồng thời cả cụm nhiều slide đang chọn (giữ nguyên thứ tự tương đối bên trong cụm)
 * tới vị trí mục tiêu ứng với `overId` khi kéo thả một lần cả cụm.
 * Tự động ngắt cờ `flowWithPrev` tại các ranh giới có slide đứng trước thay đổi.
 */
export function reorderEditableSlideCluster(
  slides: EditableSlideItem[],
  selectedIds: ReadonlySet<string>,
  activeId: string,
  overId: string,
): EditableSlideItem[] {
  if (slides.length <= 1 || activeId === overId) return slides;

  const activeIndex = slides.findIndex((item) => item.id === activeId);
  const overIndex = slides.findIndex((item) => item.id === overId);
  if (activeIndex < 0 || overIndex < 0) return slides;

  // Nếu chỉ chọn 1 slide hoặc slide đang kéo không nằm trong cụm chọn -> kéo thả 1 slide như bình thường
  if (selectedIds.size <= 1 || !selectedIds.has(activeId)) {
    return reorderEditableSlides(slides, activeIndex, overIndex);
  }

  // Thả lên một slide khác cũng đang nằm trong cùng cụm chọn -> không xáo trộn cụm
  if (selectedIds.has(overId)) {
    return slides;
  }

  const prevIdBefore = new Map<string, string | null>();
  slides.forEach((item, idx) => {
    prevIdBefore.set(item.id, idx > 0 ? slides[idx - 1].id : null);
  });

  const cluster: EditableSlideItem[] = [];
  const remaining: EditableSlideItem[] = [];
  for (const slide of slides) {
    if (selectedIds.has(slide.id)) {
      cluster.push(slide);
    } else {
      remaining.push(slide);
    }
  }

  const overRemainingIndex = remaining.findIndex((item) => item.id === overId);
  if (overRemainingIndex < 0) return slides;

  // Kéo sang phải (activeIndex < overIndex) -> chèn sau mục tiêu; kéo sang trái -> chèn trước mục tiêu
  const insertIndex = activeIndex < overIndex ? overRemainingIndex + 1 : overRemainingIndex;
  const moved = [...remaining.slice(0, insertIndex), ...cluster, ...remaining.slice(insertIndex)];

  return moved.map((slide, idx) => {
    if (idx === 0) {
      return { ...slide, flowWithPrev: false, joinSeparator: undefined };
    }
    const prevIdNow = moved[idx - 1].id;
    if (prevIdNow !== prevIdBefore.get(slide.id)) {
      return { ...slide, flowWithPrev: false, joinSeparator: undefined };
    }
    return slide;
  });
}

/** Chuyển một section thành danh sách các slide xem trước & xuất PowerPoint (luôn bảo đảm không tràn viewport). */
export function buildSectionSlides(
  section: MassSection,
  song?: Song,
  aspectRatio: SlideAspectRatio = "16:9",
): SlidePreviewItem[] {
  if (section.kind === "image") {
    return [
      {
        id: `${section.id}-0`,
        kind: "image",
        heading: section.title,
        imageUrl: section.imageUrl,
        imageFit: section.imageFit ?? "cover",
        emptyHint: section.imageUrl ? undefined : "Chưa có ảnh được tải lên",
      },
    ];
  }

  const rawEditableSlides = getEffectiveEditableSlides(section, song, aspectRatio);
  const { slides: editableSlides } = reflowEditableSlides(rawEditableSlides, section, aspectRatio);
  const titleFont =
    section.kind === "text"
      ? (section.titleFontFamily ?? section.style.titleFontFamily ?? "Arial")
      : (section.style.titleFontFamily ?? "Arial");
  const titleTypo =
    section.kind === "text"
      ? getTitleTypography(
          section.titleFontSize ?? "large",
          section.titleFontSizePt ?? section.style.titleFontSizePt,
          section.titleLineSpacingPt ?? section.style.titleLineSpacingPt,
        )
      : getTitleTypography("large", section.style.titleFontSizePt, section.style.titleLineSpacingPt);
  const titleAlign =
    section.kind === "text"
      ? (section.titleAlign ?? section.style.titleAlign ?? "center")
      : (section.style.titleAlign ?? "center");
  const titleColor =
    section.kind === "text" ? (section.titleColor ?? section.style.titleColor) : section.style.titleColor;

  const bodyFont = section.style.fontFamily ?? "Arial";
  const bodyTypo = getSlideTypography(section.style.fontSize, section.style.fontSizePt, section.style.lineSpacingPt);
  const bodyAlign = section.style.textAlign ?? "justify";
  const bodyColor =
    section.kind === "text" ? (section.contentColor ?? section.style.contentColor) : section.style.contentColor;
  const showPartPrefix = section.kind === "song";

  return editableSlides.map((slideItem, idx) => {
    const { showHeading, showBody } = resolveSlideVisibility(section, slideItem, idx);

    const isTitleOnlySlide = showHeading && !showBody;
    const rawCustomTitlePt =
      section.kind === "text"
        ? (section.titleFontSizePt ?? section.style.titleFontSizePt)
        : section.style.titleFontSizePt;
    const rawCustomTitleLinePt =
      section.kind === "text"
        ? (section.titleLineSpacingPt ?? section.style.titleLineSpacingPt)
        : section.style.titleLineSpacingPt;
    const slideHeadingTypo =
      isTitleOnlySlide && rawCustomTitlePt === undefined
        ? getTitleTypography("xlarge", 70, rawCustomTitleLinePt)
        : titleTypo;

    const rawHeading = (slideItem.heading ?? section.title).trim();
    const heading = showHeading && rawHeading ? rawHeading : undefined;
    const rawSubheading = (slideItem.subheading ?? "").trim();
    const subheading = showHeading && !showBody && slideItem.showSubheading && rawSubheading ? rawSubheading : undefined;
    const cleanedBody = slideItem.body.replace(/[ \t]+$/, "");
    const body = showBody && cleanedBody.trim() ? cleanedBody : undefined;
    const bodyPrefix = showPartPrefix && body && slideItem.bodyPrefix ? slideItem.bodyPrefix : undefined;

    return {
      id: slideItem.id || `${section.id}-${idx}`,
      kind: section.kind,
      heading,
      headingFont: titleFont,
      headingPt: slideHeadingTypo.fontSizePt,
      headingLinePt: slideHeadingTypo.lineSpacingPt,
      headingColor: titleColor,
      headingAlign: titleAlign,
      subheading,
      bodyPrefix,
      body,
      bodyFont,
      bodyPt: bodyTypo.fontSizePt,
      bodyLinePt: bodyTypo.lineSpacingPt,
      bodyColor,
      bodyAlign,
      backgroundImage: slideItem.backgroundImage,
      partLabel: slideItem.partLabel,
      emptyHint: !heading && !body && !slideItem.backgroundImage?.url ? "Slide trống" : undefined,
    };
  });
}
