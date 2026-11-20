import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  buildSafeStorageSlug,
  deleteFromBunnyStorage,
  isBunnyStorageConfigured,
  uploadToBunnyStorage,
} from "@/lib/bunny-storage";
import { MAX_PDF_UPLOAD_BYTES, compressPdfForStorage } from "@/lib/pdf-processor";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Vui lòng đăng nhập trước khi tải tệp PDF tờ nhạc lên." },
        { status: 401 },
      );
    }

    if (!isBunnyStorageConfigured()) {
      return NextResponse.json(
        {
          error:
            "Chưa cấu hình Bunny Storage trên server. Hãy thêm BUNNY_STORAGE_ZONE, BUNNY_STORAGE_ACCESS_KEY và BUNNY_CDN_BASE_URL vào tệp .env.local rồi khởi động lại server.",
        },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const entry = formData.get("file");
    const songTitleRaw = formData.get("songTitle");
    const songTitle = typeof songTitleRaw === "string" ? songTitleRaw.trim() : "";

    if (!(entry instanceof File)) {
      return NextResponse.json({ error: "Không tìm thấy tệp PDF được gửi lên." }, { status: 400 });
    }

    const lowerName = entry.name.toLowerCase();
    if (entry.type && entry.type !== "application/pdf" && entry.type !== "application/octet-stream" && !lowerName.endsWith(".pdf")) {
      return NextResponse.json({ error: "Chỉ hỗ trợ định dạng tệp PDF (.pdf)." }, { status: 400 });
    }

    if (entry.size > MAX_PDF_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Tệp PDF vượt quá dung lượng tải lên tối đa (30MB)." },
        { status: 400 },
      );
    }

    const rawBuffer = Buffer.from(await entry.arrayBuffer());

    let compressed;
    try {
      compressed = await compressPdfForStorage(rawBuffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tệp PDF không hợp lệ hoặc không thể nén.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const baseName = songTitle || entry.name.replace(/\.pdf$/i, "");
    const safeSlug = buildSafeStorageSlug(baseName, "to-nhac");
    const objectPath = `songs/pdfs/${user.id}/${Date.now()}-${safeSlug}.pdf`;

    const uploaded = await uploadToBunnyStorage({
      buffer: compressed.buffer,
      objectPath,
      contentType: "application/pdf",
    });

    return NextResponse.json({
      url: uploaded.publicUrl,
      objectPath: uploaded.objectPath,
      storage: "bunny" as const,
      pageCount: compressed.pageCount,
      originalBytes: compressed.originalBytes,
      compressedBytes: compressed.compressedBytes,
      maxBudgetBytes: compressed.maxBudgetBytes,
      strategy: compressed.strategy,
      appliedPpi: compressed.appliedPpi,
      withinBudget: compressed.withinBudget,
    });
  } catch (error) {
    console.error("[api/upload-song-pdf] Failed to process or upload PDF:", error);
    const detail = error instanceof Error ? error.message : "";
    const hint = detail.includes("HTTP 401")
      ? "Bunny Storage từ chối xác thực (HTTP 401): kiểm tra lại BUNNY_STORAGE_ZONE, BUNNY_STORAGE_REGION và Password (không dùng Read-only password)."
      : detail.includes("HTTP 404")
        ? "Không tìm thấy Storage Zone trên Bunny (HTTP 404): kiểm tra lại tên BUNNY_STORAGE_ZONE và BUNNY_STORAGE_REGION."
        : "Không thể tải tệp PDF lên Bunny Storage. Vui lòng kiểm tra cấu hình và thử lại.";
    return NextResponse.json({ error: hint }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as { objectPath?: string } | null;
    const objectPath = typeof body?.objectPath === "string" ? body.objectPath.trim() : "";
    const expectedPrefix = `songs/pdfs/${user.id}/`;

    if (!objectPath || !objectPath.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: "Đường dẫn tệp không hợp lệ." }, { status: 400 });
    }

    await deleteFromBunnyStorage(objectPath);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[api/upload-song-pdf] Failed to delete PDF:", error);
    return NextResponse.json({ error: "Không thể xóa tệp PDF." }, { status: 500 });
  }
}
