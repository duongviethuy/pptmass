import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import sharp from "sharp";

import type {
  CustomSlideTheme,
  ImageFitMode,
  Mass,
  MassThemeId,
  SlideBackgroundImage,
  Song,
} from "@/lib/pptmass-types";
import {
  DEFAULT_CUSTOM_THEME,
  PPTX_FONT_FACE,
  buildSectionSlides,
  getSlideDimensions,
  getSlideFontOption,
  getSlideLayoutBoxes,
  getSlideTypography,
  getTitleTypography,
  normalizeHexColor,
} from "@/lib/slide-utils";

type PptxThemeColors = {
  bgSolid: string;
  bgGradientSvg?: (width: number, height: number) => string;
  titleHex: string;
  bodyHex: string;
  mutedHex: string;
};

/** Chuyển mã màu #HEX sang dạng 6 ký tự in hoa không có dấu # cho PptxGenJS. */
export function toPptxHex(color: string | undefined, fallback: string): string {
  if (!color) return fallback;
  const normalized = normalizeHexColor(color, `#${fallback}`);
  return normalized.replace(/^#/, "").toUpperCase();
}

/** Tính tọa độ (x1, y1, x2, y2) theo phần trăm cho thẻ <linearGradient> từ góc độ CSS (0-360deg). */
function angleToSvgGradientCoords(angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const x1 = Math.round(50 - Math.cos(rad) * 50);
  const y1 = Math.round(50 - Math.sin(rad) * 50);
  const x2 = Math.round(50 + Math.cos(rad) * 50);
  const y2 = Math.round(50 + Math.sin(rad) * 50);
  return { x1: `${x1}%`, y1: `${y1}%`, x2: `${x2}%`, y2: `${y2}%` };
}

function resolvePptxTheme(themeId: MassThemeId, customTheme?: CustomSlideTheme): PptxThemeColors {
  if (themeId === "custom") {
    const custom = customTheme ?? DEFAULT_CUSTOM_THEME;
    const fromHex = normalizeHexColor(custom.colorFrom, DEFAULT_CUSTOM_THEME.colorFrom);
    const toHex = normalizeHexColor(custom.colorTo, DEFAULT_CUSTOM_THEME.colorTo);
    const isDarkText = custom.textColor === "dark";

    return {
      bgSolid: toPptxHex(fromHex, "F8FAFC"),
      bgGradientSvg:
        custom.mode === "gradient"
          ? (w, h) => {
              const coords = angleToSvgGradientCoords(custom.angle);
              return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="${coords.x1}" y1="${coords.y1}" x2="${coords.x2}" y2="${coords.y2}"><stop offset="0%" stop-color="${fromHex}"/><stop offset="100%" stop-color="${toHex}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`;
            }
          : undefined,
      titleHex: isDarkText ? "DC2626" : "FDE68A",
      bodyHex: isDarkText ? "0F172A" : "FFFFFF",
      mutedHex: isDarkText ? "475569" : "CBD5E1",
    };
  }

  switch (themeId) {
    case "warm-light":
      return {
        bgSolid: "FBF8F1",
        bgGradientSvg: (w, h) =>
          `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fdfbf6"/><stop offset="100%" stop-color="#f3ead8"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`,
        titleHex: "92400E",
        bodyHex: "0F172A",
        mutedHex: "64748B",
      };
    case "lenten-violet":
      return {
        bgSolid: "341D4B",
        bgGradientSvg: (w, h) =>
          `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#251338"/><stop offset="55%" stop-color="#4d2a70"/><stop offset="100%" stop-color="#221133"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`,
        titleHex: "FDE68A",
        bodyHex: "FFFFFF",
        mutedHex: "CBD5E1",
      };
    case "feast-red":
      return {
        bgSolid: "5A1620",
        bgGradientSvg: (w, h) =>
          `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#420e16"/><stop offset="55%" stop-color="#7c212e"/><stop offset="100%" stop-color="#3c0d14"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`,
        titleHex: "FDE68A",
        bodyHex: "FFFFFF",
        mutedHex: "CBD5E1",
      };
    case "pure-white":
    default:
      return {
        bgSolid: "FFFFFF",
        titleHex: "DC2626",
        bodyHex: "0F172A",
        mutedHex: "64748B",
      };
  }
}

async function renderGradientDataUrl(svgBuilder: (w: number, h: number) => string, widthPx: number, heightPx: number): Promise<string | null> {
  try {
    const svg = svgBuilder(widthPx, heightPx);
    const pngBuffer = await sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();
    return `image/png;base64,${pngBuffer.toString("base64")}`;
  } catch (error) {
    console.error("[export-pptx] Failed to rasterize gradient background:", error);
    return null;
  }
}

async function loadImageBuffer(imageUrl: string): Promise<Buffer | null> {
  if (imageUrl.startsWith("data:")) {
    const commaIdx = imageUrl.indexOf(",");
    if (commaIdx === -1) return null;
    return Buffer.from(imageUrl.slice(commaIdx + 1), "base64");
  }
  if (/^https?:\/\//i.test(imageUrl)) {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }
  return null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace(/^#/, "");
  return {
    r: Number.parseInt(clean.slice(0, 2), 16) || 255,
    g: Number.parseInt(clean.slice(2, 4), 16) || 255,
    b: Number.parseInt(clean.slice(4, 6), 16) || 255,
  };
}

/**
 * Hòa trộn ảnh nền (có độ trong suốt `opacity` 0–100% và chế độ `cover`/`contain`) lên trên nền màu/gradient của slide
 * để file PowerPoint xuất ra giống hệt 100% bản xem trước trên web.
 */
async function renderCompositedBackgroundDataUrl(
  themeColors: PptxThemeColors,
  widthPx: number,
  heightPx: number,
  bgImage: SlideBackgroundImage,
): Promise<string | null> {
  try {
    const rawBuffer = await loadImageBuffer(bgImage.url);
    if (!rawBuffer) return null;

    const targetW = Math.round(widthPx * 1.5);
    const targetH = Math.round(heightPx * 1.5);
    const opacity = Math.min(1, Math.max(0, bgImage.opacity / 100));
    const fit = bgImage.fit ?? "cover";

    // Tạo lớp nền gốc (gradient hoặc màu đơn)
    const baseBuffer = themeColors.bgGradientSvg
      ? await sharp(Buffer.from(themeColors.bgGradientSvg(targetW, targetH)))
          .png()
          .toBuffer()
      : await sharp({
          create: {
            width: targetW,
            height: targetH,
            channels: 4,
            background: { ...hexToRgb(themeColors.bgSolid), alpha: 1 },
          },
        })
          .png()
          .toBuffer();

    if (opacity <= 0.005) {
      const jpeg = await sharp(baseBuffer).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      return `image/jpeg;base64,${jpeg.toString("base64")}`;
    }

    // Resize ảnh nền đúng tỉ lệ + áp dụng độ trong suốt chính xác
    const resizedBg = sharp(rawBuffer)
      .rotate()
      .resize(targetW, targetH, {
        fit,
        position: "centre",
        ...(fit === "contain" ? { background: { r: 0, g: 0, b: 0, alpha: 0 } } : {}),
      });

    const { data, info } = await resizedBg.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (opacity < 0.999) {
      for (let i = 3; i < data.length; i += 4) {
        data[i] = Math.round(data[i] * opacity);
      }
    }

    const overlayPng = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toBuffer();

    const compositedJpeg = await sharp(baseBuffer)
      .composite([{ input: overlayPng, blend: "over" }])
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();

    return `image/jpeg;base64,${compositedJpeg.toString("base64")}`;
  } catch (error) {
    console.error("[export-pptx] Failed to composite slide background image:", error);
    return null;
  }
}

/**
 * Chuẩn hóa ảnh slide (từ Data URL hoặc HTTPS Supabase Storage) về đúng tỉ lệ khung chiếu (16:9 hoặc 4:3)
 * theo chế độ `cover` (phủ kín) hoặc `contain` (vừa khung, nền trong suốt) để khớp 100% với bản xem trước web.
 */
async function prepareSlideImageDataUrl(
  imageUrl: string,
  widthPx: number,
  heightPx: number,
  fit: ImageFitMode,
): Promise<string | null> {
  try {
    const rawBuffer = await loadImageBuffer(imageUrl);
    if (!rawBuffer) return null;

    // Xuất ở độ phân giải Full HD (1920x1080 cho 16:9, 1440x1080 cho 4:3) để chiếu máy chiếu sắc nét
    const targetW = Math.round(widthPx * 1.5);
    const targetH = Math.round(heightPx * 1.5);
    const rotated = sharp(rawBuffer).rotate();

    if (fit === "contain") {
      const pngBuffer = await rotated
        .resize(targetW, targetH, {
          fit: "contain",
          position: "centre",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 8 })
        .toBuffer();
      return `image/png;base64,${pngBuffer.toString("base64")}`;
    }

    const jpegBuffer = await rotated
      .resize(targetW, targetH, { fit: "cover", position: "centre" })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
    return `image/jpeg;base64,${jpegBuffer.toString("base64")}`;
  } catch (error) {
    console.error("[export-pptx] Failed to prepare slide image:", error);
    return null;
  }
}

export function slugifyFileName(title: string, celebrationDate?: string): string {
  const base = title
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const datePart = celebrationDate?.trim() ? `-${celebrationDate.trim()}` : "";
  return `${base || "thanh-le"}${datePart}.pptx`;
}

/**
 * Khắc phục lỗi của pptxgenjs@4.0.0 khi render nhiều text run trong cùng 1 đoạn (<a:p>):
 * thư viện chèn thừa thẻ <a:pPr> sau thẻ </a:r>, khiến PowerPoint cảnh báo lỗi định dạng.
 */
async function sanitizePptxDuplicateParagraphProps(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const slidePaths = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  let modified = false;

  for (const path of slidePaths) {
    const xml = await zip.file(path)?.async("string");
    if (!xml) continue;
    const cleaned = xml.replace(/<\/a:r>(?:<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>|<a:pPr\b[^>]*\/>)/g, "</a:r>");
    if (cleaned !== xml) {
      zip.file(path, cleaned);
      modified = true;
    }
  }

  if (!modified) return buffer;
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** Tạo file PowerPoint (.pptx) dạng Buffer trên server khớp 1:1 về tọa độ, font Arial, cỡ chữ (pt) và khoảng cách dòng (pt) với bản xem trước web. */
export async function generateMassPptxBuffer(mass: Mass, songs: Song[]): Promise<{ buffer: Buffer; fileName: string }> {
  const pptx = new PptxGenJS();
  const is4x3 = mass.aspectRatio === "4:3";
  const dims = getSlideDimensions(mass.aspectRatio);

  pptx.layout = is4x3 ? "LAYOUT_4x3" : "LAYOUT_WIDE";
  pptx.title = mass.title || "Thánh lễ";
  pptx.author = mass.createdByName || "Pptmass";
  pptx.company = "Pptmass";
  pptx.theme = { headFontFace: PPTX_FONT_FACE, bodyFontFace: PPTX_FONT_FACE };

  const songLookup = new Map<string, Song>(songs.map((song) => [song.id, song]));
  const defaultTitleTypo = getTitleTypography("large");
  const compositedBgCache = new Map<string, string | null>();
  const gradientCache = new Map<string, string | null>();
  const slideImageCache = new Map<string, string | null>();

  const getGradientForTheme = async (tId: MassThemeId, cTheme: CustomSlideTheme | undefined, colors: PptxThemeColors) => {
    if (!colors.bgGradientSvg) return null;
    const key =
      tId === "custom"
        ? `custom|${cTheme?.mode ?? "gradient"}|${cTheme?.colorFrom ?? ""}|${cTheme?.colorTo ?? ""}|${cTheme?.angle ?? 135}`
        : tId;
    if (gradientCache.has(key)) return gradientCache.get(key) ?? null;
    const url = await renderGradientDataUrl(colors.bgGradientSvg, dims.widthPx, dims.heightPx);
    gradientCache.set(key, url);
    return url;
  };

  for (const section of mass.sections) {
    const linkedSong = section.kind === "song" ? songLookup.get(section.songId) : undefined;
    const previewSlides = buildSectionSlides(section, linkedSong, mass.aspectRatio);
    const sectionStyle =
      section.kind === "song" || section.kind === "text" || section.kind === "prayer" ? section.style : undefined;
    const defaultBodyTypo = getSlideTypography(
      sectionStyle?.fontSize ?? "xlarge",
      sectionStyle?.fontSizePt,
      sectionStyle?.lineSpacingPt,
    );

    const effThemeId: MassThemeId =
      section.kind === "image" ? "pure-white" : (section.themeId ?? mass.themeId);
    const effCustomTheme: CustomSlideTheme | undefined =
      section.kind === "image"
        ? undefined
        : section.themeId
          ? (section.customTheme ?? mass.customTheme)
          : mass.customTheme;
    const themeColors = resolvePptxTheme(effThemeId, effCustomTheme);
    const gradientDataUrl = await getGradientForTheme(effThemeId, effCustomTheme, themeColors);

    for (const item of previewSlides) {
      const slide = pptx.addSlide();

      if (item.backgroundImage?.url) {
        const cacheKey = `${effThemeId}|${effCustomTheme?.colorFrom ?? ""}|${effCustomTheme?.colorTo ?? ""}|${item.backgroundImage.url}|${item.backgroundImage.opacity}|${item.backgroundImage.fit ?? "cover"}`;
        let composited = compositedBgCache.get(cacheKey);
        if (composited === undefined) {
          composited = await renderCompositedBackgroundDataUrl(
            themeColors,
            dims.widthPx,
            dims.heightPx,
            item.backgroundImage,
          );
          compositedBgCache.set(cacheKey, composited);
        }
        slide.background = composited
          ? { data: composited }
          : gradientDataUrl
            ? { data: gradientDataUrl }
            : { color: themeColors.bgSolid };
      } else {
        slide.background = gradientDataUrl ? { data: gradientDataUrl } : { color: themeColors.bgSolid };
      }

      if (item.kind === "image") {
        if (section.kind === "image" && section.imageUrl) {
          const fit = section.imageFit ?? "cover";
          const imgCacheKey = `${section.imageUrl}|${dims.widthPx}x${dims.heightPx}|${fit}`;
          let preparedData = slideImageCache.get(imgCacheKey);
          if (preparedData === undefined) {
            preparedData = await prepareSlideImageDataUrl(section.imageUrl, dims.widthPx, dims.heightPx, fit);
            slideImageCache.set(imgCacheKey, preparedData);
          }
          if (preparedData) {
            slide.addImage({
              data: preparedData,
              x: 0,
              y: 0,
              w: dims.widthIn,
              h: dims.heightIn,
            });
            continue;
          }
        }
        if (item.heading) {
          const { headingBox } = getSlideLayoutBoxes(mass.aspectRatio, true, false);
          if (headingBox) {
            slide.addText(item.heading, {
              ...headingBox,
              fontFace: PPTX_FONT_FACE,
              fontSize: 48,
              bold: true,
              color: themeColors.titleHex,
              align: "center",
              valign: "middle",
              margin: 0,
              paraSpaceBefore: 0,
              paraSpaceAfter: 0,
            });
          }
        }
        continue;
      }

      // Các loại slide nội dung: song, prayer, text — dùng chung getSlideLayoutBoxes + font + pt chính xác
      const headingText = item.heading?.trim();
      const bodyText = item.body?.trim();
      const bodyPrefix = item.bodyPrefix?.trim();
      const bodyAlign = item.bodyAlign ?? "justify";
      const headingFontFace = getSlideFontOption(item.headingFont).pptxFont;
      const bodyFontFace = getSlideFontOption(item.bodyFont).pptxFont;
      const { headingBox, bodyBox } = getSlideLayoutBoxes(mass.aspectRatio, Boolean(headingText), Boolean(bodyText));

      const headingPt = item.headingPt ?? defaultTitleTypo.fontSizePt;
      const headingLinePt = item.headingLinePt ?? defaultTitleTypo.lineSpacingPt;
      const bodyPt = item.bodyPt ?? defaultBodyTypo.fontSizePt;
      const bodyLinePt = item.bodyLinePt ?? defaultBodyTypo.lineSpacingPt;
      const headingHex = toPptxHex(item.headingColor, themeColors.titleHex);
      const bodyHex = toPptxHex(item.bodyColor, themeColors.bodyHex);

      if (headingText && headingBox) {
        const subheadingText = item.subheading?.trim();
        if (subheadingText && !bodyText) {
          const subPt = Math.max(20, Math.round(headingPt * 0.65));
          const runs: PptxGenJS.TextProps[] = [
            {
              text: headingText.toUpperCase(),
              options: {
                fontFace: headingFontFace,
                fontSize: headingPt,
                bold: true,
                color: headingHex,
                breakLine: true,
              },
            },
            {
              text: subheadingText,
              options: {
                fontFace: headingFontFace,
                fontSize: subPt,
                bold: true,
                color: bodyHex,
              },
            },
          ];
          slide.addText(runs, {
            ...headingBox,
            align: item.headingAlign ?? "center",
            valign: "middle",
            margin: 0,
            paraSpaceBefore: 0,
            paraSpaceAfter: 12,
            lineSpacing: headingLinePt,
          });
        } else {
          slide.addText(headingText.toUpperCase(), {
            ...headingBox,
            fontFace: headingFontFace,
            fontSize: headingPt,
            bold: true,
            color: headingHex,
            align: item.headingAlign ?? "center",
            valign: "middle",
            margin: 0,
            paraSpaceBefore: 0,
            paraSpaceAfter: 0,
            lineSpacing: headingLinePt,
          });
        }
      }

      if (bodyText && bodyBox) {
        if (bodyPrefix) {
          const paragraphs = bodyText.split("\n");
          const runs: PptxGenJS.TextProps[] = [
            {
              text: `${bodyPrefix} `,
              options: {
                fontFace: bodyFontFace,
                fontSize: bodyPt,
                bold: true,
                color: headingHex,
              },
            },
            ...paragraphs.map((para, pIdx) => ({
              text: para,
              options: {
                fontFace: bodyFontFace,
                fontSize: bodyPt,
                bold: true,
                color: bodyHex,
                breakLine: pIdx < paragraphs.length - 1,
              },
            })),
          ];

          slide.addText(runs, {
            ...bodyBox,
            align: bodyAlign,
            valign: "middle",
            margin: 0,
            paraSpaceBefore: 0,
            paraSpaceAfter: 0,
            lineSpacing: bodyLinePt,
          });
        } else {
          slide.addText(bodyText, {
            ...bodyBox,
            fontFace: bodyFontFace,
            fontSize: bodyPt,
            bold: true,
            color: bodyHex,
            align: bodyAlign,
            valign: "middle",
            margin: 0,
            paraSpaceBefore: 0,
            paraSpaceAfter: 0,
            lineSpacing: bodyLinePt,
          });
        }
      }
    }
  }

  const rawOutput = await pptx.write({ outputType: "nodebuffer" });
  const rawBuffer = Buffer.isBuffer(rawOutput) ? rawOutput : Buffer.from(rawOutput as ArrayBuffer);
  const buffer = await sanitizePptxDuplicateParagraphProps(rawBuffer);
  return {
    buffer,
    fileName: slugifyFileName(mass.title, mass.celebrationDate),
  };
}
