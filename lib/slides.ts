import { getCurrentUser } from "@/lib/auth";
import { extractBunnyObjectPathFromUrl } from "@/lib/bunny-storage";
import type {
  CustomSlideTheme,
  Mass,
  MassSection,
  MassThemeId,
  SavedSlideSummary,
  SlideAspectRatio,
} from "@/lib/pptmass-types";
import { DEFAULT_CUSTOM_THEME } from "@/lib/slide-utils";
import { createClient } from "@/lib/supabase/server";

export type SlideSummaryRow = {
  id: string;
  title: string;
  celebration_date: string | null;
  aspect_ratio: SlideAspectRatio;
  theme_id: MassThemeId;
  section_count: number;
  slide_count: number;
  cover_image_url: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
};

export type SlideFullRow = SlideSummaryRow & {
  custom_theme: CustomSlideTheme | null;
  sections: MassSection[] | null;
};

export type ListMySlidesResult = {
  slides: SavedSlideSummary[];
  tableMissing: boolean;
  error?: string;
};

const SUMMARY_SELECT =
  "id, title, celebration_date, aspect_ratio, theme_id, section_count, slide_count, cover_image_url, created_by, created_by_name, created_at, updated_at";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | undefined | null): value is string {
  return Boolean(value && UUID_RE.test(value.trim()));
}

export function mapSlideRowToSummary(row: SlideSummaryRow): SavedSlideSummary {
  return {
    id: row.id,
    title: row.title,
    celebrationDate: row.celebration_date ?? "",
    aspectRatio: row.aspect_ratio === "4:3" ? "4:3" : "16:9",
    themeId: row.theme_id ?? "pure-white",
    sectionCount: typeof row.section_count === "number" ? row.section_count : 0,
    slideCount: typeof row.slide_count === "number" ? row.slide_count : 0,
    coverImageUrl: row.cover_image_url ?? undefined,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSlideRowToMass(row: SlideFullRow): Mass {
  return {
    id: row.id,
    title: row.title,
    celebrationDate: row.celebration_date ?? "",
    aspectRatio: row.aspect_ratio === "4:3" ? "4:3" : "16:9",
    themeId: row.theme_id ?? "pure-white",
    customTheme: row.custom_theme ?? DEFAULT_CUSTOM_THEME,
    isPublic: false,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sections: Array.isArray(row.sections) ? row.sections : [],
  };
}

/**
 * Trích xuất tất cả objectPath trên Bunny Storage thuộc một hoặc nhiều tiền tố cho phép
 * (VD: `mass-images/{userId}/{slideId}/`) đang được tham chiếu trong `sections`.
 */
export function extractOwnedBunnyPathsFromSections(
  sections: MassSection[],
  requiredPrefixes: string | string[],
): Set<string> {
  const paths = new Set<string>();
  const prefixList = (Array.isArray(requiredPrefixes) ? requiredPrefixes : [requiredPrefixes]).map((prefix) =>
    prefix.endsWith("/") ? prefix : `${prefix}/`,
  );

  const tryAdd = (url?: string) => {
    if (!url) return;
    const objectPath = extractBunnyObjectPathFromUrl(url);
    if (objectPath && prefixList.some((prefix) => objectPath.startsWith(prefix))) {
      paths.add(objectPath);
    }
  };

  for (const section of sections) {
    if (section.kind === "image") {
      tryAdd(section.imageUrl);
      continue;
    }
    for (const slide of section.slides ?? []) {
      tryAdd(slide.backgroundImage?.url);
    }
  }

  return paths;
}

/** Lấy danh sách tóm tắt các bài trình chiếu của người đang đăng nhập (chỉ đọc cột nhẹ, không kéo JSONB `sections`). */
export async function listMySlides(limit = 50): Promise<ListMySlidesResult> {
  "use cache: private";

  const user = await getCurrentUser();
  if (!user) {
    return { slides: [], tableMissing: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("slides")
    .select(SUMMARY_SELECT)
    .eq("created_by", user.id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      return { slides: [], tableMissing: true };
    }
    console.error("[slides] Failed to list slides:", error.code, error.message);
    return { slides: [], tableMissing: false, error: error.message };
  }

  return {
    slides: (data ?? []).map((row) => mapSlideRowToSummary(row as SlideSummaryRow)),
    tableMissing: false,
  };
}

/** Tải chi tiết một bài trình chiếu thuộc sở hữu của người đang đăng nhập để mở lại trong `/editor?id=...`. */
export async function getMySlideById(id: string): Promise<{ slide: Mass | null; tableMissing: boolean }> {
  "use cache: private";

  if (!isValidUuid(id)) {
    return { slide: null, tableMissing: false };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { slide: null, tableMissing: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("slides")
    .select("*")
    .eq("id", id)
    .eq("created_by", user.id)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      return { slide: null, tableMissing: true };
    }
    console.error("[slides] Failed to get slide by id:", error.code, error.message);
    return { slide: null, tableMissing: false };
  }

  return {
    slide: data ? mapSlideRowToMass(data as SlideFullRow) : null,
    tableMissing: false,
  };
}
