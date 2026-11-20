import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { buildSafeStorageSlug } from "@/lib/bunny-storage";
import { createClient } from "@/lib/supabase/server";

/**
 * Proxy tải tệp PDF tờ nhạc về máy người dùng với `Content-Disposition: attachment`
 * (tránh bị chặn CORS / chỉ mở tab mới trên domain CDN, đặc biệt dùng cho luồng "Tải về rồi mới xóa").
 */
export async function GET(request: NextRequest) {
  try {
    const songId = request.nextUrl.searchParams.get("id")?.trim() ?? "";
    if (!songId) {
      return NextResponse.json({ error: "Thiếu mã bài hát." }, { status: 400 });
    }

    const user = await getCurrentUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("songs")
      .select("id, title, pdf_url, is_public, created_by")
      .eq("id", songId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Không tìm thấy bài hát." }, { status: 404 });
    }

    const row = data as {
      id: string;
      title: string;
      pdf_url?: string | null;
      is_public?: boolean | null;
      created_by: string;
    };

    const isOwner = Boolean(user && row.created_by === user.id);
    const isPublic = row.is_public !== false;
    if (!isOwner && !isPublic) {
      return NextResponse.json({ error: "Bạn không có quyền tải tệp PDF này." }, { status: 403 });
    }

    const pdfUrl = row.pdf_url?.trim();
    if (!pdfUrl || !/^https?:\/\//i.test(pdfUrl)) {
      return NextResponse.json({ error: "Bài hát này chưa có tệp PDF đính kèm." }, { status: 404 });
    }

    const upstream = await fetch(pdfUrl, { cache: "no-store" });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Không thể tải tệp PDF từ máy chủ lưu trữ (HTTP ${upstream.status}).` },
        { status: 502 },
      );
    }

    const pdfBytes = await upstream.arrayBuffer();
    const fileName = `${buildSafeStorageSlug(row.title, "to-nhac")}.pdf`;

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/download-song-pdf] Failed to download song PDF:", error);
    return NextResponse.json({ error: "Không thể tải tệp PDF về máy." }, { status: 500 });
  }
}
