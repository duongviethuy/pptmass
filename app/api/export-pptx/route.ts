import { NextResponse, type NextRequest } from "next/server";

import { generateMassPptxBuffer } from "@/lib/export-pptx";
import { hydrateExportPptxPayload, type ExportPptxRequestPayload } from "@/lib/payload-normalizer";

const MAX_SECTIONS = 120;
const ALLOWED_SECTION_KINDS = new Set(["image", "text", "song", "prayer"]);

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Partial<ExportPptxRequestPayload>;
    if (
      !payload.mass ||
      !Array.isArray(payload.mass.sections) ||
      payload.mass.sections.length === 0 ||
      payload.mass.sections.length > MAX_SECTIONS ||
      payload.mass.sections.some((sec) => !sec || !ALLOWED_SECTION_KINDS.has(sec.kind))
    ) {
      return NextResponse.json({ error: "Dữ liệu bài trình chiếu không hợp lệ." }, { status: 400 });
    }

    const { mass, songs } = hydrateExportPptxPayload({
      mass: payload.mass,
      songs: payload.songs,
      assets: payload.assets,
    });
    const { buffer, fileName } = await generateMassPptxBuffer(mass, songs);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/export-pptx] Failed to export PowerPoint:", error);
    return NextResponse.json({ error: "Không thể tạo file PowerPoint. Vui lòng thử lại." }, { status: 500 });
  }
}
