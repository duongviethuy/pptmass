import { createHash } from "node:crypto";

const REGION_HOSTS: Record<string, string> = {
  "": "storage.bunnycdn.com",
  de: "storage.bunnycdn.com",
  falkenstein: "storage.bunnycdn.com",
  sg: "sg.storage.bunnycdn.com",
  singapore: "sg.storage.bunnycdn.com",
  syd: "syd.storage.bunnycdn.com",
  ny: "ny.storage.bunnycdn.com",
  la: "la.storage.bunnycdn.com",
  uk: "uk.storage.bunnycdn.com",
  se: "se.storage.bunnycdn.com",
  br: "br.storage.bunnycdn.com",
  jh: "jh.storage.bunnycdn.com",
};

export type BunnyStorageConfig = {
  storageZone: string;
  accessKey: string;
  regionHost: string;
  cdnBaseUrl: string;
};

export type BunnyUploadResult = {
  publicUrl: string;
  objectPath: string;
  sizeBytes: number;
};

/**
 * Đọc cấu hình Bunny Storage từ biến môi trường server-side.
 * Trả về `null` nếu chưa cấu hình đủ 3 biến bắt buộc:
 * - BUNNY_STORAGE_ZONE
 * - BUNNY_STORAGE_ACCESS_KEY
 * - BUNNY_CDN_BASE_URL
 * (Tùy chọn: BUNNY_STORAGE_REGION, khuyến nghị `sg` cho Việt Nam)
 */
export function getBunnyStorageConfig(): BunnyStorageConfig | null {
  const storageZone = process.env.BUNNY_STORAGE_ZONE?.trim() ?? "";
  const accessKey = process.env.BUNNY_STORAGE_ACCESS_KEY?.trim() ?? "";
  const rawCdnBase = process.env.BUNNY_CDN_BASE_URL?.trim() ?? "";
  const rawRegion = (process.env.BUNNY_STORAGE_REGION?.trim() ?? "").toLowerCase();

  if (!storageZone || !accessKey || !rawCdnBase) {
    return null;
  }

  const regionHost = REGION_HOSTS[rawRegion] ?? `${rawRegion}.storage.bunnycdn.com`;
  const normalizedCdn = /^https?:\/\//i.test(rawCdnBase) ? rawCdnBase : `https://${rawCdnBase}`;

  return {
    storageZone: storageZone.replace(/^\/+|\/+$/g, ""),
    accessKey,
    regionHost,
    cdnBaseUrl: normalizedCdn.replace(/\/+$/, ""),
  };
}

export function isBunnyStorageConfigured(): boolean {
  return getBunnyStorageConfig() !== null;
}

function sanitizeObjectPath(objectPath: string): string {
  return objectPath
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Tải một buffer nhị phân (PDF hoặc Hình ảnh) lên Bunny Edge Storage qua HTTP PUT.
 * Tự động đính kèm SHA-256 `Checksum` để Bunny kiểm chứng toàn vẹn dữ liệu trên đường truyền.
 */
export async function uploadToBunnyStorage(options: {
  buffer: Buffer | Uint8Array;
  objectPath: string;
  contentType: string;
}): Promise<BunnyUploadResult> {
  const config = getBunnyStorageConfig();
  if (!config) {
    throw new Error(
      "Chưa cấu hình Bunny Storage (thiếu BUNNY_STORAGE_ZONE, BUNNY_STORAGE_ACCESS_KEY hoặc BUNNY_CDN_BASE_URL trong .env.local).",
    );
  }

  const encodedPath = sanitizeObjectPath(options.objectPath);
  if (!encodedPath) {
    throw new Error("Đường dẫn tệp trên Bunny Storage không hợp lệ.");
  }

  const bytes = options.buffer instanceof Uint8Array ? options.buffer : new Uint8Array(options.buffer);
  const sha256Hex = createHash("sha256").update(bytes).digest("hex").toUpperCase();
  const endpoint = `https://${config.regionHost}/${encodeURIComponent(config.storageZone)}/${encodedPath}`;

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      AccessKey: config.accessKey,
      "Content-Type": options.contentType || "application/octet-stream",
      Checksum: sha256Hex,
    },
    body: new Uint8Array(bytes),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Bunny Storage trả về lỗi HTTP ${response.status}${errBody ? `: ${errBody.slice(0, 200)}` : ""}`);
  }

  const cleanDisplayPath = options.objectPath
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)
    .join("/");

  return {
    publicUrl: `${config.cdnBaseUrl}/${encodedPath}`,
    objectPath: cleanDisplayPath,
    sizeBytes: bytes.byteLength,
  };
}

/** Xóa tệp khỏi Bunny Storage (hữu ích khi rollback lỗi lưu hoặc khi người dùng xóa bài hát). */
export async function deleteFromBunnyStorage(objectPath: string): Promise<boolean> {
  const config = getBunnyStorageConfig();
  if (!config) return false;

  const encodedPath = sanitizeObjectPath(objectPath);
  if (!encodedPath) return false;

  const endpoint = `https://${config.regionHost}/${encodeURIComponent(config.storageZone)}/${encodedPath}`;
  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: { AccessKey: config.accessKey },
  });

  return response.ok || response.status === 404;
}

/**
 * Xóa đệ quy toàn bộ một thư mục (và mọi tệp bên trong) trên Bunny Storage bằng HTTP DELETE có dấu `/` ở cuối.
 * Ràng buộc an toàn: chỉ chấp nhận đường dẫn có tối thiểu 2 cấp thư mục (VD: `mass-images/{userId}/{slideId}`)
 * để tránh bao giờ xóa nhầm thư mục gốc.
 */
export async function deleteDirectoryFromBunnyStorage(dirPath: string): Promise<boolean> {
  const config = getBunnyStorageConfig();
  if (!config) return false;

  const encodedPath = sanitizeObjectPath(dirPath);
  const segments = encodedPath.split("/").filter(Boolean);
  if (segments.length < 2) return false;

  const endpoint = `https://${config.regionHost}/${encodeURIComponent(config.storageZone)}/${encodedPath}/`;
  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: { AccessKey: config.accessKey },
  });

  return response.ok || response.status === 404;
}

/** Trích xuất `objectPath` nội bộ trên Bunny Storage từ URL CDN công khai (chỉ chấp nhận đúng domain `BUNNY_CDN_BASE_URL`). */
export function extractBunnyObjectPathFromUrl(publicUrl: string): string | null {
  const config = getBunnyStorageConfig();
  if (!config) return null;

  const trimmed = publicUrl.trim();
  const expectedPrefix = `${config.cdnBaseUrl}/`;
  if (!trimmed.startsWith(expectedPrefix)) return null;

  const rawPath = trimmed.slice(expectedPrefix.length).split(/[?#]/)[0] ?? "";
  const segments = rawPath
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment).trim();
      } catch {
        return segment.trim();
      }
    })
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..");

  return segments.length > 0 ? segments.join("/") : null;
}

/** Chuyển tên bài hát / tên tệp tiếng Việt sang slug ASCII an toàn cho URL trên Bunny CDN. */
export function buildSafeStorageSlug(raw: string, fallback = "file"): string {
  const slug = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug || fallback;
}
