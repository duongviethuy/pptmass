import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";

import { deleteFromBunnyStorage, isBunnyStorageConfigured, uploadToBunnyStorage } from "@/lib/bunny-storage";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const STORAGE_BUCKET = "mass-images";
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{4,64}$/;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Vui lòng đăng nhập để lưu hình ảnh lên hệ thống." }, { status: 401 });
    }

    const formData = await request.formData();
    const entry = formData.get("file");
    const rawSlideId = String(formData.get("slideId") ?? "").trim();
    const scope = String(formData.get("scope") ?? "slide").trim() === "section" ? "section" : "slide";

    if (!(entry instanceof File)) {
      return NextResponse.json({ error: "Không tìm thấy tệp ảnh được gửi lên." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(entry.type)) {
      return NextResponse.json(
        { error: "Chỉ hỗ trợ định dạng ảnh JPG, PNG, WebP hoặc GIF." },
        { status: 400 },
      );
    }

    if (entry.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "Ảnh vượt quá dung lượng tối đa 10MB." }, { status: 400 });
    }

    if (!SAFE_ID_RE.test(rawSlideId)) {
      return NextResponse.json({ error: "Thiếu hoặc không hợp lệ mã định danh slide (slideId)." }, { status: 400 });
    }

    const inputBuffer = Buffer.from(await entry.arrayBuffer());
    const rotated = sharp(inputBuffer).rotate();
    const metadata = await rotated.metadata();
    const keepAlpha = Boolean(metadata.hasAlpha && (entry.type === "image/png" || entry.type === "image/webp"));

    const resized = rotated.resize({
      width: 1920,
      height: 1080,
      fit: "inside",
      withoutEnlargement: true,
    });

    const optimizedBuffer = keepAlpha
      ? await resized.png({ compressionLevel: 8 }).toBuffer()
      : await resized.jpeg({ quality: 88, mozjpeg: true }).toBuffer();

    const contentType = keepAlpha ? "image/png" : "image/jpeg";
    const ext = keepAlpha ? "png" : "jpg";
    const fileName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    // Cấu trúc lưu trữ trên Bunny Storage (luôn nằm trong thư mục gốc `mass-images`):
    // - Slide Thánh lễ: mass-images/{userId}/{slideId}/{ten-anh}
    // - Section cá nhân: mass-images/{userId}/sections/{sectionId}/{ten-anh}
    const relativePath =
      scope === "section" ? `${user.id}/sections/${rawSlideId}/${fileName}` : `${user.id}/${rawSlideId}/${fileName}`;
    const objectPath = `${STORAGE_BUCKET}/${relativePath}`;

    if (isBunnyStorageConfigured()) {
      const uploaded = await uploadToBunnyStorage({
        buffer: optimizedBuffer,
        objectPath,
        contentType,
      });
      return NextResponse.json({
        url: uploaded.publicUrl,
        objectPath: uploaded.objectPath,
        storage: "bunny" as const,
      });
    }

    // Dự phòng sang Supabase Storage nếu chưa cấu hình BUNNY_* (bucket `mass-images` dùng đường dẫn con `{userId}/...`)
    const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(relativePath, optimizedBuffer, {
      contentType,
      cacheControl: "3600",
      upsert: false,
    });

    if (!uploadError) {
      const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(relativePath);
      if (publicUrlData?.publicUrl) {
        return NextResponse.json({
          url: publicUrlData.publicUrl,
          objectPath: relativePath,
          storage: "supabase" as const,
        });
      }
    }

    return NextResponse.json(
      { error: "Chưa cấu hình kho lưu trữ Bunny Storage hoặc Supabase Storage." },
      { status: 500 },
    );
  } catch (error) {
    console.error("[api/upload-image] Failed to process image upload:", error);
    return NextResponse.json({ error: "Không thể tải ảnh lên Bunny Storage. Vui lòng thử lại." }, { status: 500 });
  }
}

/** Xóa các ảnh vừa tải lên (dùng khi rollback nếu bước lưu slide vào Supabase gặp lỗi). */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Bạn cần đăng nhập." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { objectPaths?: unknown } | null;
    const rawPaths = Array.isArray(body?.objectPaths) ? body.objectPaths : [];
    const ownerPrefix = `${STORAGE_BUCKET}/${user.id}/`;

    let deleted = 0;
    for (const item of rawPaths) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      // Chỉ cho phép xóa tệp thuộc đúng thư mục `mass-images/{userId}/` của chính người dùng đang đăng nhập
      if (!trimmed.startsWith(ownerPrefix) || trimmed.includes("..")) continue;
      const ok = await deleteFromBunnyStorage(trimmed).catch(() => false);
      if (ok) deleted += 1;
    }

    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("[api/upload-image] Failed to rollback images:", error);
    return NextResponse.json({ error: "Không thể dọn dẹp ảnh tạm." }, { status: 500 });
  }
}
