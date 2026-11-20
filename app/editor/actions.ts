"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import {
  deleteDirectoryFromBunnyStorage,
  deleteFromBunnyStorage,
  isBunnyStorageConfigured,
} from "@/lib/bunny-storage";
import { normalizeCustomTheme, normalizeSectionForStorage } from "@/lib/payload-normalizer";
import type { Mass, MassSection, MassThemeId, SavedSlideSummary, SlideAspectRatio } from "@/lib/pptmass-types";
import {
  extractOwnedBunnyPathsFromSections,
  isValidUuid,
  mapSlideRowToMass,
  mapSlideRowToSummary,
  type SlideFullRow,
} from "@/lib/slides";
import { formatDateTimeVi } from "@/lib/songs";
import { createClient } from "@/lib/supabase/server";

export type SlideActionResult =
  | {
      status: "success";
      slide: Mass;
      summary: SavedSlideSummary;
      updatedAtLabel: string;
      cleanedImagesCount: number;
    }
  | { status: "deleted"; id: string; cleanedImagesCount: number }
  | { status: "table_missing"; message: string }
  | { status: "error"; message: string };

const titleSchema = z
  .string()
  .trim()
  .min(1, { error: "Vui lòng nhập tên bài trình chiếu trước khi lưu." })
  .max(180, { error: "Tên bài trình chiếu tối đa 180 ký tự." });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_RATIOS = new Set<SlideAspectRatio>(["16:9", "4:3"]);
const VALID_THEMES = new Set<MassThemeId>(["pure-white", "warm-light", "lenten-violet", "feast-red", "custom"]);

function hasUnresolvedBlobUrl(sections: MassSection[]): boolean {
  for (const section of sections) {
    if (section.kind === "image" && section.imageUrl?.startsWith("blob:")) return true;
    if (section.kind !== "image") {
      for (const slide of section.slides ?? []) {
        if (slide.backgroundImage?.url?.startsWith("blob:")) return true;
      }
    }
  }
  return false;
}

function computeSlideCount(sections: MassSection[]): number {
  let count = 0;
  for (const section of sections) {
    if (section.kind === "image") {
      count += 1;
      continue;
    }
    if (Array.isArray(section.slides)) {
      count += section.slides.length;
    } else if (section.kind === "text") {
      count += 1 + (section.extraSlides?.length ?? 0);
    } else {
      count += 1;
    }
  }
  return count;
}

function findCoverImageUrl(sections: MassSection[]): string | null {
  for (const section of sections) {
    if (section.kind === "image" && section.imageCategory === "cover" && section.imageUrl?.trim()) {
      return section.imageUrl.trim();
    }
  }
  for (const section of sections) {
    if (section.kind === "image" && section.imageUrl?.trim()) {
      return section.imageUrl.trim();
    }
  }
  return null;
}

/**
 * Lưu (tạo mới hoặc cập nhật) một bài trình chiếu Thánh lễ vào bảng `public.slides` trên Supabase.
 * Tự động chuẩn hóa dữ liệu `sections` gọn tối đa và dọn các ảnh cũ trên Bunny Storage
 * (`{userId}/{slideId}/...`) nếu ảnh đó không còn được dùng trong bài slide nữa.
 */
export async function saveMassSlide(input: {
  id: string;
  isExisting?: boolean;
  mass: Mass;
}): Promise<SlideActionResult> {
  if (!isValidUuid(input.id)) {
    return { status: "error", message: "Mã định danh slide (UUID) không hợp lệ." };
  }

  const parsedTitle = titleSchema.safeParse(input.mass?.title ?? "");
  if (!parsedTitle.success) {
    return { status: "error", message: parsedTitle.error.issues[0]?.message ?? "Tên bài trình chiếu chưa hợp lệ." };
  }

  if (!Array.isArray(input.mass?.sections) || input.mass.sections.length === 0) {
    return { status: "error", message: "Bài trình chiếu phải có ít nhất 1 section." };
  }

  if (hasUnresolvedBlobUrl(input.mass.sections)) {
    return {
      status: "error",
      message: "Vẫn còn hình ảnh cục bộ chưa được tải lên Bunny Storage. Vui lòng thử lưu lại.",
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Vui lòng đăng nhập để lưu bài trình chiếu." };
  }

  const normalizedSections = input.mass.sections.map((section) => normalizeSectionForStorage(section));
  const aspectRatio: SlideAspectRatio = VALID_RATIOS.has(input.mass.aspectRatio) ? input.mass.aspectRatio : "16:9";
  const themeId: MassThemeId = VALID_THEMES.has(input.mass.themeId) ? input.mass.themeId : "pure-white";
  const customTheme = themeId === "custom" ? normalizeCustomTheme(input.mass.customTheme) : null;
  const rawDate = (input.mass.celebrationDate ?? "").trim();
  const celebrationDate = DATE_RE.test(rawDate) ? rawDate : null;

  const sectionCount = normalizedSections.length;
  const slideCount = computeSlideCount(normalizedSections);
  const coverImageUrl = findCoverImageUrl(normalizedSections);

  const supabase = await createClient();
  // Cấu trúc chính: `mass-images/{userId}/{slideId}/` (kèm tương thích ngược nếu có ảnh cũ ở `{userId}/{slideId}/`)
  const ownerSlidePrefixes = [`mass-images/${user.id}/${input.id}/`, `${user.id}/${input.id}/`];

  // Nếu đang cập nhật bài slide đã tồn tại -> đọc danh sách sections cũ để dọn ảnh thừa trên Bunny sau khi lưu
  let previousSections: MassSection[] = [];
  if (input.isExisting) {
    const { data: existingRow, error: fetchError } = await supabase
      .from("slides")
      .select("sections")
      .eq("id", input.id)
      .eq("created_by", user.id)
      .maybeSingle();

    if (fetchError) {
      if (fetchError.code === "PGRST205" || fetchError.code === "42P01") {
        return {
          status: "table_missing",
          message: "Bảng slides chưa được tạo trên Supabase. Hãy chạy mục 6 trong file supabase/schema.sql.",
        };
      }
      console.error("[slides] Failed to load existing slide before update:", fetchError.code, fetchError.message);
      return { status: "error", message: "Không thể kiểm tra bài trình chiếu cũ. Vui lòng thử lại." };
    }

    if (existingRow && Array.isArray(existingRow.sections)) {
      previousSections = existingRow.sections as MassSection[];
    }
  }

  const dbPayload = {
    title: parsedTitle.data,
    celebration_date: celebrationDate,
    aspect_ratio: aspectRatio,
    theme_id: themeId,
    custom_theme: customTheme,
    sections: normalizedSections,
    section_count: sectionCount,
    slide_count: slideCount,
    cover_image_url: coverImageUrl,
  };

  const query = input.isExisting
    ? supabase
        .from("slides")
        .update(dbPayload)
        .eq("id", input.id)
        .eq("created_by", user.id)
        .select("*")
        .single()
    : supabase
        .from("slides")
        .insert({
          id: input.id,
          ...dbPayload,
          created_by: user.id,
          created_by_name: user.name,
        })
        .select("*")
        .single();

  const { data, error } = await query;

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      return {
        status: "table_missing",
        message: "Bảng slides chưa được tạo trên Supabase. Hãy chạy mục 6 trong file supabase/schema.sql.",
      };
    }
    console.error("[slides] Failed to save slide:", error.code, error.message);
    return { status: "error", message: "Không thể lưu bài trình chiếu lên Supabase. Vui lòng thử lại." };
  }

  // Dọn ảnh rác trên Bunny Storage (những ảnh thuộc đúng `mass-images/{userId}/{slideId}/` đã bị gỡ khỏi bài slide)
  let cleanedImagesCount = 0;
  if (previousSections.length > 0) {
    const oldPaths = extractOwnedBunnyPathsFromSections(previousSections, ownerSlidePrefixes);
    const newPaths = extractOwnedBunnyPathsFromSections(normalizedSections, ownerSlidePrefixes);
    for (const oldPath of oldPaths) {
      if (!newPaths.has(oldPath)) {
        const deleted = await deleteFromBunnyStorage(oldPath).catch(() => false);
        if (deleted) cleanedImagesCount += 1;
      }
    }
  }

  revalidatePath("/", "layout");
  const savedRow = data as SlideFullRow;
  const slide = mapSlideRowToMass(savedRow);
  const summary = mapSlideRowToSummary(savedRow);

  return {
    status: "success",
    slide,
    summary,
    updatedAtLabel: formatDateTimeVi(summary.updatedAt),
    cleanedImagesCount,
  };
}

/** Xóa một bài trình chiếu đã lưu của người dùng và BẮT BUỘC xóa toàn bộ hình ảnh & thư mục slide đó trên Bunny Storage. */
export async function deleteMassSlide(slideId: string): Promise<SlideActionResult> {
  if (!isValidUuid(slideId)) {
    return { status: "error", message: "Mã bài trình chiếu không hợp lệ." };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Vui lòng đăng nhập để xóa bài trình chiếu." };
  }

  const supabase = await createClient();
  const { data: existingRow, error: fetchError } = await supabase
    .from("slides")
    .select("sections")
    .eq("id", slideId)
    .eq("created_by", user.id)
    .maybeSingle();

  if (fetchError) {
    if (fetchError.code === "PGRST205" || fetchError.code === "42P01") {
      return {
        status: "table_missing",
        message: "Bảng slides chưa được tạo trên Supabase.",
      };
    }
    console.error("[slides] Failed to inspect slide before delete:", fetchError.code, fetchError.message);
    return { status: "error", message: "Không thể xóa bài trình chiếu. Vui lòng thử lại." };
  }

  // Bước 1: Xóa sạch toàn bộ hình ảnh & thư mục của slide này trên Bunny Storage TRƯỚC khi xóa bản ghi Supabase
  const mainSlideDir = `mass-images/${user.id}/${slideId}`;
  const legacySlideDir = `${user.id}/${slideId}`;
  const sections = existingRow && Array.isArray(existingRow.sections) ? (existingRow.sections as MassSection[]) : [];
  const bunnyPaths = extractOwnedBunnyPathsFromSections(sections, [`${mainSlideDir}/`, `${legacySlideDir}/`]);

  let cleanedImagesCount = 0;
  if (isBunnyStorageConfigured()) {
    const failedDeletes: string[] = [];
    for (const objectPath of bunnyPaths) {
      const ok = await deleteFromBunnyStorage(objectPath).catch(() => false);
      if (ok) {
        cleanedImagesCount += 1;
      } else {
        failedDeletes.push(objectPath);
      }
    }

    // Xóa luôn thư mục chứa ảnh của slide trên Bunny (`mass-images/{userId}/{slideId}/`) để không để lại thư mục rỗng
    const mainDirDeleted = await deleteDirectoryFromBunnyStorage(mainSlideDir).catch(() => false);
    const hasLegacyPaths = [...bunnyPaths].some((p) => p.startsWith(`${legacySlideDir}/`));
    if (hasLegacyPaths) {
      await deleteDirectoryFromBunnyStorage(legacySlideDir).catch(() => false);
    }

    if (failedDeletes.length > 0 && !mainDirDeleted) {
      console.error("[slides] Failed to delete Bunny images before slide removal:", failedDeletes);
      return {
        status: "error",
        message: "Không thể xóa hình ảnh đính kèm trên Bunny Storage nên bài trình chiếu chưa bị xóa. Vui lòng thử lại.",
      };
    }
  }

  // Bước 2: Xóa bản ghi bài trình chiếu trên Supabase
  const { error: deleteError } = await supabase
    .from("slides")
    .delete()
    .eq("id", slideId)
    .eq("created_by", user.id);

  if (deleteError) {
    console.error("[slides] Failed to delete slide:", deleteError.code, deleteError.message);
    return { status: "error", message: "Không thể xóa bài trình chiếu. Vui lòng thử lại." };
  }

  revalidatePath("/", "layout");
  return { status: "deleted", id: slideId, cleanedImagesCount };
}
