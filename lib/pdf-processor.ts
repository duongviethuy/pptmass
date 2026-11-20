import * as mupdf from "mupdf";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

export const MAX_PDF_UPLOAD_BYTES = 30 * 1024 * 1024; // 30MB đầu vào tối đa
export const MAX_PDF_PAGES = 30;
/** Ngân sách dung lượng mục tiêu cho mỗi trang PDF sau khi nén: 200 KB/trang (2 trang <= 400 KB, 3 trang <= 600 KB...). */
export const PDF_TARGET_BYTES_PER_PAGE = 200 * 1024;
/** Chuẩn độ phân giải in ấn A4 300 PPI (2480 × 3508 px). */
export const PDF_TARGET_PPI = 300;
export const PDF_MAX_A4_WIDTH_PX = 2480;
export const PDF_MAX_A4_HEIGHT_PX = 3508;

export type PdfValidationFailureCode =
  | "empty"
  | "too_large"
  | "invalid_header"
  | "encrypted"
  | "corrupted"
  | "no_pages"
  | "too_many_pages";

export type PdfValidationResult =
  | {
      valid: true;
      pageCount: number;
      originalBytes: number;
      maxBudgetBytes: number;
      pages: { widthPt: number; heightPt: number }[];
    }
  | {
      valid: false;
      code: PdfValidationFailureCode;
      message: string;
    };

export type PdfCompressionResult = {
  buffer: Buffer;
  pageCount: number;
  originalBytes: number;
  compressedBytes: number;
  maxBudgetBytes: number;
  strategy: "original" | "lossless-repack" | "raster-300ppi" | "raster-adaptive";
  appliedPpi: number;
  appliedQuality?: number;
  withinBudget: boolean;
};

/** Kiểm tra nhanh chữ ký nhị phân `%PDF-` trong 1024 byte đầu tiên. */
function hasPdfMagicHeader(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, 1024);
  const head = Buffer.from(bytes.subarray(0, limit)).toString("latin1");
  return /%PDF-\d\.\d/.test(head);
}

/** Kiểm tra dấu kết thúc `%%EOF` ở cuối tệp để phát hiện PDF tải dở / bị cắt cụt. */
function hasPdfEofMarker(bytes: Uint8Array): boolean {
  const start = Math.max(0, bytes.length - 4096);
  const tail = Buffer.from(bytes.subarray(start)).toString("latin1");
  return tail.includes("%%EOF");
}

/**
 * Kiểm tra tính khả dụng của tệp PDF trước khi nén & lưu trữ:
 * - Định dạng nhị phân chuẩn (%PDF- & %%EOF), không quá 30MB.
 * - Không bị khóa mật khẩu / mã hóa.
 * - Đọc được toàn bộ cấu trúc trang (1–30 trang), không hỏng/lỗi luồng dữ liệu.
 */
export async function validatePdfBuffer(input: Buffer | Uint8Array): Promise<PdfValidationResult> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);

  if (bytes.byteLength === 0) {
    return { valid: false, code: "empty", message: "Tệp PDF rỗng, không có dữ liệu." };
  }
  if (bytes.byteLength > MAX_PDF_UPLOAD_BYTES) {
    return {
      valid: false,
      code: "too_large",
      message: "Tệp PDF vượt quá dung lượng tải lên tối đa (30MB).",
    };
  }
  if (!hasPdfMagicHeader(bytes)) {
    return {
      valid: false,
      code: "invalid_header",
      message: "Tệp không phải định dạng PDF hợp lệ (thiếu chữ ký %PDF).",
    };
  }

  let doc: mupdf.Document | null = null;
  mupdf.setLog({ error: () => {}, warning: () => {} });
  try {
    doc = mupdf.Document.openDocument(bytes, "application/pdf");
    if (!doc.isPDF()) {
      return {
        valid: false,
        code: "invalid_header",
        message: "Tệp gửi lên không phải tài liệu PDF hợp lệ.",
      };
    }

    if (doc.needsPassword()) {
      return {
        valid: false,
        code: "encrypted",
        message: "Tệp PDF đang được bảo vệ bằng mật khẩu. Vui lòng gỡ mật khẩu trước khi tải lên.",
      };
    }

    const pageCount = doc.countPages();
    if (pageCount <= 0) {
      // Phân biệt PDF hỏng nặng (MuPDF repair về 0 trang) với PDF rỗng hợp lệ
      await PDFDocument.load(bytes, { ignoreEncryption: false });
      return { valid: false, code: "no_pages", message: "Tệp PDF không có trang nào." };
    }
    if (pageCount > MAX_PDF_PAGES) {
      return {
        valid: false,
        code: "too_many_pages",
        message: `Tệp PDF có ${pageCount} trang (tối đa cho phép ${MAX_PDF_PAGES} trang mỗi bài hát).`,
      };
    }

    const pages: { widthPt: number; heightPt: number }[] = [];
    for (let i = 0; i < pageCount; i += 1) {
      const page = doc.loadPage(i);
      try {
        const [x0, y0, x1, y1] = page.getBounds();
        const widthPt = Math.abs(x1 - x0);
        const heightPt = Math.abs(y1 - y0);
        if (!Number.isFinite(widthPt) || !Number.isFinite(heightPt) || widthPt < 10 || heightPt < 10) {
          return {
            valid: false,
            code: "corrupted",
            message: `Trang ${i + 1} của tệp PDF bị lỗi kích thước hoặc không thể hiển thị.`,
          };
        }
        pages.push({ widthPt, heightPt });
      } finally {
        page.destroy();
      }
    }

    // Kiểm tra chéo thêm bằng pdf-lib (bắt lỗi cấu trúc/mã hóa nếu có)
    if (!hasPdfEofMarker(bytes)) {
      await PDFDocument.load(bytes, { ignoreEncryption: false });
    }

    return {
      valid: true,
      pageCount,
      originalBytes: bytes.byteLength,
      maxBudgetBytes: pageCount * PDF_TARGET_BYTES_PER_PAGE,
      pages,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message.toLowerCase() : "";
    if (msg.includes("encrypt") || msg.includes("password")) {
      return {
        valid: false,
        code: "encrypted",
        message: "Tệp PDF bị khóa mật khẩu hoặc mã hóa không hỗ trợ. Vui lòng gỡ khóa trước khi tải lên.",
      };
    }
    return {
      valid: false,
      code: "corrupted",
      message: "Tệp PDF bị hỏng hoặc không thể đọc được. Vui lòng kiểm tra lại tệp nguồn.",
    };
  } finally {
    doc?.destroy();
  }
}

/**
 * Phát hiện trang nhạc đen trắng / xám (tờ nhạc phổ thông) bằng lấy mẫu pixel nhanh:
 * nếu >= 98% pixel có sai lệch R/G/B <= 18 thì mã hóa Grayscale giúp giảm ~35-45% dung lượng mà giữ nét 300 PPI.
 */
function isNearGrayscaleRgb(pixels: Uint8ClampedArray, width: number, height: number): boolean {
  const totalPixels = width * height;
  if (totalPixels === 0) return true;

  const sampleStep = Math.max(1, Math.floor(totalPixels / 12000));
  let sampled = 0;
  let colored = 0;

  for (let p = 0; p < totalPixels; p += sampleStep) {
    const idx = p * 3;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    sampled += 1;
    if (maxDiff > 18) {
      colored += 1;
    }
  }

  return sampled === 0 || colored / sampled < 0.02;
}

/** Tính kích thước mục tiêu (pixel) theo PPI và trần A4 300 PPI (2480 × 3508 px). */
function computePageTargetScale(widthPt: number, heightPt: number, targetPpi: number): number {
  const baseScale = targetPpi / 72;
  const isLandscape = widthPt > heightPt;
  const maxW = isLandscape ? PDF_MAX_A4_HEIGHT_PX : PDF_MAX_A4_WIDTH_PX;
  const maxH = isLandscape ? PDF_MAX_A4_WIDTH_PX : PDF_MAX_A4_HEIGHT_PX;

  const maxScaleW = maxW / widthPt;
  const maxScaleH = maxH / heightPt;
  return Math.min(baseScale, maxScaleW, maxScaleH);
}

async function encodeRenderedPageToJpeg(
  rgbBuffer: Buffer,
  width: number,
  height: number,
  grayscale: boolean,
  quality: number,
  scaleFactor = 1,
): Promise<Buffer> {
  let pipeline = sharp(rgbBuffer, { raw: { width, height, channels: 3 } });

  if (scaleFactor < 0.995) {
    const nextW = Math.max(120, Math.round(width * scaleFactor));
    const nextH = Math.max(120, Math.round(height * scaleFactor));
    pipeline = pipeline.resize({ width: nextW, height: nextH, fit: "inside", kernel: sharp.kernel.lanczos3 });
  }

  if (grayscale) {
    // Chuẩn hóa nhẹ độ tương phản cho tờ nhạc scan đen trắng để khuông nhạc sắc nét hơn
    pipeline = pipeline.grayscale().normalise({ lower: 1, upper: 99 });
  }

  return pipeline
    .jpeg({
      quality,
      mozjpeg: true,
      progressive: false,
      chromaSubsampling: grayscale ? "4:4:4" : "4:2:0",
    })
    .toBuffer();
}

async function assembleJpegsToPdf(
  pages: { widthPt: number; heightPt: number; jpeg: Buffer }[],
): Promise<Buffer> {
  const outDoc = await PDFDocument.create();
  for (const item of pages) {
    const embedded = await outDoc.embedJpg(item.jpeg);
    const pdfPage = outDoc.addPage([item.widthPt, item.heightPt]);
    pdfPage.drawImage(embedded, {
      x: 0,
      y: 0,
      width: item.widthPt,
      height: item.heightPt,
    });
  }
  const saved = await outDoc.save({ useObjectStreams: true });
  return Buffer.from(saved);
}

/**
 * Xác thực & nén PDF tờ nhạc tối ưu cho lưu trữ trên Bunny Storage:
 * 1) Kiểm tra toàn diện PDF có khả dụng không (`validatePdfBuffer`).
 * 2) Nếu PDF gốc (hoặc sau nén không mất dữ liệu `useObjectStreams`) đã <= 200 KB/trang -> giữ nguyên nét vector!
 * 3) Nếu vượt 200 KB/trang -> render ở chuẩn 300 PPI (tối đa A4 2480 × 3508 px) bằng MuPDF WASM,
 *    tự phát hiện tờ nhạc đen trắng (Grayscale) và nén MozJPEG thích ứng theo ngân sách 200 KB × số trang.
 */
export async function compressPdfForStorage(input: Buffer | Uint8Array): Promise<PdfCompressionResult> {
  const validation = await validatePdfBuffer(input);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const originalBuf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const { pageCount, maxBudgetBytes, pages: pageDims } = validation;

  // Bước 1: Thử nén không mất dữ liệu (object streams) — bảo toàn 100% độ sắc nét cho PDF vector (MuseScore, Encore, Finale...)
  let losslessBuf = originalBuf;
  let usedRepack = false;
  try {
    const parsed = await PDFDocument.load(originalBuf, { ignoreEncryption: false });
    parsed.setTitle("");
    parsed.setAuthor("");
    parsed.setSubject("");
    parsed.setKeywords([]);
    parsed.setProducer("Pptmass PDF Optimizer");
    const repacked = Buffer.from(await parsed.save({ useObjectStreams: true }));
    if (repacked.byteLength < originalBuf.byteLength) {
      losslessBuf = repacked;
      usedRepack = true;
    }
  } catch {
    // Nếu pdf-lib không repack được một số PDF cũ, chuyển sang bước raster 300 PPI nếu vượt ngân sách
  }

  if (losslessBuf.byteLength <= maxBudgetBytes) {
    return {
      buffer: losslessBuf,
      pageCount,
      originalBytes: originalBuf.byteLength,
      compressedBytes: losslessBuf.byteLength,
      maxBudgetBytes,
      strategy: usedRepack ? "lossless-repack" : "original",
      appliedPpi: PDF_TARGET_PPI,
      withinBudget: true,
    };
  }

  // Bước 2: Render từng trang ở chuẩn 300 PPI (trần A4 2480 × 3508 px) bằng MuPDF
  type RenderedPage = {
    widthPt: number;
    heightPt: number;
    widthPx: number;
    heightPx: number;
    rgb: Buffer;
    grayscale: boolean;
  };

  const renderedPages: RenderedPage[] = [];
  const doc = mupdf.Document.openDocument(originalBuf, "application/pdf");
  try {
    for (let i = 0; i < pageCount; i += 1) {
      const page = doc.loadPage(i);
      try {
        const { widthPt, heightPt } = pageDims[i];
        const scale = computePageTargetScale(widthPt, heightPt, PDF_TARGET_PPI);
        const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false);
        try {
          const widthPx = pixmap.getWidth();
          const heightPx = pixmap.getHeight();
          const pixels = pixmap.getPixels();
          const grayscale = isNearGrayscaleRgb(pixels, widthPx, heightPx);
          // Sao chép buffer RGB ra khỏi bộ nhớ WASM trước khi hủy pixmap
          const rgb = Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength);
          renderedPages.push({ widthPt, heightPt, widthPx, heightPx, rgb: Buffer.from(rgb), grayscale });
        } finally {
          pixmap.destroy();
        }
      } finally {
        page.destroy();
      }
    }
  } finally {
    doc.destroy();
  }

  // Bước 3: Nén thích ứng giữ tối đa 300 PPI trước, sau đó mới hạ dần PPI nếu trang quá phức tạp/nhiều màu
  const attempts: { ppi: number; quality: number }[] = [
    // Ưu tiên tuyệt đối chuẩn 300 PPI (2480 × 3508 px)
    { ppi: 300, quality: 78 },
    { ppi: 300, quality: 62 },
    { ppi: 300, quality: 48 },
    { ppi: 300, quality: 36 },
    // Chỉ hạ PPI khi 300 PPI vẫn lớn hơn 200 KB/trang (VD: ảnh scan màu độ phức tạp cao)
    { ppi: 240, quality: 52 },
    { ppi: 240, quality: 38 },
    { ppi: 200, quality: 48 },
    { ppi: 200, quality: 35 },
    { ppi: 165, quality: 42 },
    { ppi: 140, quality: 36 },
    { ppi: 115, quality: 30 },
  ];

  let bestResult: { buffer: Buffer; ppi: number; quality: number } | null = null;

  for (const attempt of attempts) {
    const scaleFactor = attempt.ppi / PDF_TARGET_PPI;
    const encodedPages = await Promise.all(
      renderedPages.map(async (page) => ({
        widthPt: page.widthPt,
        heightPt: page.heightPt,
        jpeg: await encodeRenderedPageToJpeg(
          page.rgb,
          page.widthPx,
          page.heightPx,
          page.grayscale,
          attempt.quality,
          scaleFactor,
        ),
      })),
    );

    const candidatePdf = await assembleJpegsToPdf(encodedPages);
    if (!bestResult || candidatePdf.byteLength < bestResult.buffer.byteLength) {
      bestResult = { buffer: candidatePdf, ppi: attempt.ppi, quality: attempt.quality };
    }

    if (candidatePdf.byteLength <= maxBudgetBytes) {
      return {
        buffer: candidatePdf,
        pageCount,
        originalBytes: originalBuf.byteLength,
        compressedBytes: candidatePdf.byteLength,
        maxBudgetBytes,
        strategy: attempt.ppi === PDF_TARGET_PPI ? "raster-300ppi" : "raster-adaptive",
        appliedPpi: attempt.ppi,
        appliedQuality: attempt.quality,
        withinBudget: true,
      };
    }
  }

  // Trường hợp cực hiếm vẫn vượt nhẹ ngân sách: chọn bản nhỏ nhất giữa losslessBuf và bestResult
  const finalBuf =
    bestResult && bestResult.buffer.byteLength < losslessBuf.byteLength ? bestResult.buffer : losslessBuf;

  return {
    buffer: finalBuf,
    pageCount,
    originalBytes: originalBuf.byteLength,
    compressedBytes: finalBuf.byteLength,
    maxBudgetBytes,
    strategy: finalBuf === losslessBuf ? "lossless-repack" : "raster-adaptive",
    appliedPpi: bestResult?.ppi ?? PDF_TARGET_PPI,
    appliedQuality: bestResult?.quality,
    withinBudget: finalBuf.byteLength <= maxBudgetBytes,
  };
}
