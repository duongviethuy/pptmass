import type { Mass, MassSection } from "@/lib/pptmass-types";

const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Kho lưu tạm các tệp ảnh người dùng vừa chọn từ máy (blob: URL -> File gốc).
 * Ảnh CHỈ được tải lên Bunny Storage khi người dùng bấm Lưu slide hoặc Lưu section,
 * tránh tạo dữ liệu rác trên server nếu người dùng đổi ảnh liên tục hoặc thoát không lưu.
 */
const pendingImageRegistry = new Map<string, File>();

export function validateLocalImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_MIMES.has(file.type)) {
    return "Vui lòng chọn đúng tệp ảnh (JPG, PNG, WebP hoặc GIF).";
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return "Ảnh vượt quá dung lượng tối đa 10MB. Vui lòng chọn ảnh nhẹ hơn.";
  }
  return null;
}

/** Đăng ký ảnh cục bộ để xem trước tức thì bằng `blob:` URL mà chưa tải lên server. */
export function registerPendingImageFile(file: File): string {
  const blobUrl = URL.createObjectURL(file);
  pendingImageRegistry.set(blobUrl, file);
  return blobUrl;
}

export function isPendingImageUrl(url?: string): boolean {
  return Boolean(url && url.startsWith("blob:") && pendingImageRegistry.has(url));
}

export function getPendingImageFile(blobUrl: string): File | undefined {
  return pendingImageRegistry.get(blobUrl);
}

export function revokePendingImageUrl(blobUrl: string): void {
  if (!pendingImageRegistry.has(blobUrl)) return;
  pendingImageRegistry.delete(blobUrl);
  try {
    URL.revokeObjectURL(blobUrl);
  } catch {
    // ignore
  }
}

/** Gom tất cả URL ảnh (ảnh bìa + ảnh nền slide) hiện đang dùng trong danh sách section. */
export function collectImageUrlsFromSections(sections: MassSection[]): Set<string> {
  const urls = new Set<string>();
  for (const section of sections) {
    if (section.kind === "image") {
      if (section.imageUrl?.trim()) urls.add(section.imageUrl.trim());
      continue;
    }
    for (const slide of section.slides ?? []) {
      if (slide.backgroundImage?.url?.trim()) {
        urls.add(slide.backgroundImage.url.trim());
      }
    }
  }
  return urls;
}

export function countPendingImagesInSections(sections: MassSection[]): number {
  let count = 0;
  for (const url of collectImageUrlsFromSections(sections)) {
    if (isPendingImageUrl(url)) count += 1;
  }
  return count;
}

/** Thay thế đồng loạt các URL ảnh (từ `blob:` sang URL CDN Bunny hoặc Data URL) trong danh sách section. */
export function replaceImageUrlsInSections(sections: MassSection[], replacements: Map<string, string>): MassSection[] {
  if (replacements.size === 0) return sections;

  return sections.map((section) => {
    if (section.kind === "image") {
      const nextUrl = section.imageUrl ? replacements.get(section.imageUrl) : undefined;
      return nextUrl ? { ...section, imageUrl: nextUrl } : section;
    }

    if (!section.slides || section.slides.length === 0) return section;

    let changed = false;
    const nextSlides = section.slides.map((slide) => {
      const currentUrl = slide.backgroundImage?.url;
      const nextUrl = currentUrl ? replacements.get(currentUrl) : undefined;
      if (!nextUrl || !slide.backgroundImage) return slide;
      changed = true;
      return {
        ...slide,
        backgroundImage: {
          ...slide.backgroundImage,
          url: nextUrl,
        },
      };
    });

    return changed ? { ...section, slides: nextSlides } : section;
  });
}

/** Gọi API xóa các tệp vừa tải lên Bunny để rollback sạch sẽ nếu bước lưu DB bị lỗi. */
export async function rollbackUploadedImages(objectPaths: string[]): Promise<void> {
  if (objectPaths.length === 0) return;
  try {
    await fetch("/api/upload-image", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectPaths }),
    });
  } catch {
    // best-effort rollback
  }
}

/**
 * Tải toàn bộ các ảnh cục bộ (`blob:`) còn đang chờ trong `sections` lên Bunny Storage
 * theo cấu trúc `{userId}/{slideId}/{image}` (hoặc `{userId}/sections/{sectionId}/{image}`),
 * tự động khử trùng lặp nếu 1 ảnh được gắn cho nhiều slide, và rollback sạch nếu tải lỗi giữa chừng.
 */
export async function uploadPendingImagesForSections(
  sections: MassSection[],
  options: { slideId: string; scope?: "slide" | "section" },
): Promise<{
  sections: MassSection[];
  uploadedObjectPaths: string[];
  replacedBlobUrls: string[];
  uploadedCount: number;
}> {
  const allUrls = collectImageUrlsFromSections(sections);
  const pendingUrls = [...allUrls].filter((url) => url.startsWith("blob:"));

  if (pendingUrls.length === 0) {
    return { sections, uploadedObjectPaths: [], replacedBlobUrls: [], uploadedCount: 0 };
  }

  const replacements = new Map<string, string>();
  const uploadedObjectPaths: string[] = [];

  try {
    for (const blobUrl of pendingUrls) {
      const file = pendingImageRegistry.get(blobUrl);
      if (!file) {
        throw new Error("Một tệp ảnh tạm đã hết hạn trong bộ nhớ trình duyệt. Vui lòng chọn lại ảnh đó.");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("slideId", options.slideId);
      formData.append("scope", options.scope ?? "slide");

      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as {
        url?: string;
        objectPath?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || "Không thể tải ảnh lên Bunny Storage. Vui lòng thử lại.");
      }

      replacements.set(blobUrl, payload.url);
      if (payload.objectPath) {
        uploadedObjectPaths.push(payload.objectPath);
      }
    }

    return {
      sections: replaceImageUrlsInSections(sections, replacements),
      uploadedObjectPaths,
      replacedBlobUrls: pendingUrls,
      uploadedCount: pendingUrls.length,
    };
  } catch (error) {
    await rollbackUploadedImages(uploadedObjectPaths);
    throw error;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Không thể đọc dữ liệu ảnh cục bộ."));
    };
    reader.onerror = () => reject(new Error("Không thể đọc dữ liệu ảnh cục bộ."));
    reader.readAsDataURL(file);
  });
}

/**
 * Chuyển tạm các ảnh cục bộ (`blob:`) sang Data URL trong bộ nhớ trình duyệt
 * để xuất `.pptx` ngay cả khi người dùng chưa bấm Lưu slide lên Supabase/Bunny.
 */
export async function inlinePendingImagesForExport(mass: Mass): Promise<Mass> {
  const allUrls = collectImageUrlsFromSections(mass.sections);
  const pendingUrls = [...allUrls].filter((url) => isPendingImageUrl(url));
  if (pendingUrls.length === 0) return mass;

  const replacements = new Map<string, string>();
  for (const blobUrl of pendingUrls) {
    const file = pendingImageRegistry.get(blobUrl);
    if (!file) continue;
    const dataUrl = await readFileAsDataUrl(file);
    replacements.set(blobUrl, dataUrl);
  }

  return {
    ...mass,
    sections: replaceImageUrlsInSections(mass.sections, replacements),
  };
}
