"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { deleteDirectoryFromBunnyStorage, deleteFromBunnyStorage } from "@/lib/bunny-storage";
import { normalizeSectionForStorage } from "@/lib/payload-normalizer";
import type { MassSection, SavedSection } from "@/lib/pptmass-types";
import { mapSavedSectionRow, type SavedSectionRow } from "@/lib/saved-sections";
import { extractOwnedBunnyPathsFromSections, isValidUuid } from "@/lib/slides";
import { formatDateTimeVi } from "@/lib/songs";
import { createClient } from "@/lib/supabase/server";

export type SavedSectionActionResult =
  | { status: "success"; savedSection: SavedSection; updatedAtLabel: string }
  | { status: "deleted"; id: string }
  | { status: "table_missing"; message: string }
  | { status: "error"; message: string };

const titleSchema = z
  .string()
  .trim()
  .min(1, { error: "Vui lòng nhập tên section." })
  .max(160, { error: "Tên section tối đa 160 ký tự." });

const allowedKinds = new Set(["image", "text", "song", "prayer"]);

export async function saveNewSection(input: {
  id?: string;
  title?: string;
  section: MassSection;
}): Promise<SavedSectionActionResult> {
  const effectiveTitle = (input.title ?? input.section.title ?? "").trim() || "Section chưa đặt tên";
  const parsedTitle = titleSchema.safeParse(effectiveTitle);
  if (!parsedTitle.success) {
    return { status: "error", message: parsedTitle.error.issues[0]?.message ?? "Tên section chưa hợp lệ." };
  }

  if (!input.section || !allowedKinds.has(input.section.kind)) {
    return { status: "error", message: "Loại section không hợp lệ." };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Vui lòng đăng nhập để lưu section cá nhân." };
  }

  const cleanSection = normalizeSectionForStorage(input.section, { titleOverride: parsedTitle.data });
  const explicitId = isValidUuid(input.id) ? input.id : undefined;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_sections")
    .insert({
      ...(explicitId ? { id: explicitId } : {}),
      title: parsedTitle.data,
      kind: cleanSection.kind,
      section_data: explicitId ? { ...cleanSection, savedSectionId: explicitId } : cleanSection,
      created_by: user.id,
      created_by_name: user.name,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      return {
        status: "table_missing",
        message: "Bảng saved_sections chưa được tạo trên Supabase. Hãy chạy mục 5 trong file supabase/schema.sql.",
      };
    }
    console.error("[saved-sections] Failed to insert saved section:", error.code, error.message);
    return { status: "error", message: "Không thể lưu section. Vui lòng thử lại." };
  }

  revalidatePath("/", "layout");
  const savedSection = mapSavedSectionRow(data as SavedSectionRow);
  return {
    status: "success",
    savedSection,
    updatedAtLabel: formatDateTimeVi(savedSection.updatedAt),
  };
}

export async function updateSavedSection(input: {
  id: string;
  title?: string;
  section: MassSection;
}): Promise<SavedSectionActionResult> {
  const effectiveTitle = (input.title ?? input.section.title ?? "").trim() || "Section chưa đặt tên";
  const parsedTitle = titleSchema.safeParse(effectiveTitle);
  if (!parsedTitle.success) {
    return { status: "error", message: parsedTitle.error.issues[0]?.message ?? "Tên section chưa hợp lệ." };
  }

  if (!input.id || !input.section || !allowedKinds.has(input.section.kind)) {
    return { status: "error", message: "Dữ liệu section cần cập nhật không hợp lệ." };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Vui lòng đăng nhập để cập nhật section." };
  }

  const cleanSection = normalizeSectionForStorage(input.section, { titleOverride: parsedTitle.data });
  const supabase = await createClient();
  const { data: prevRow } = await supabase
    .from("saved_sections")
    .select("section_data")
    .eq("id", input.id)
    .eq("created_by", user.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("saved_sections")
    .update({
      title: parsedTitle.data,
      kind: cleanSection.kind,
      section_data: { ...cleanSection, savedSectionId: input.id },
    })
    .eq("id", input.id)
    .eq("created_by", user.id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      return {
        status: "table_missing",
        message: "Bảng saved_sections chưa được tạo trên Supabase. Hãy chạy mục 5 trong file supabase/schema.sql.",
      };
    }
    console.error("[saved-sections] Failed to update saved section:", error.code, error.message);
    return { status: "error", message: "Không thể cập nhật section. Có thể bạn không phải người tạo section này." };
  }

  if (prevRow?.section_data) {
    const sectionPrefixes = [`mass-images/${user.id}/sections/${input.id}/`, `${user.id}/sections/${input.id}/`];
    const oldPaths = extractOwnedBunnyPathsFromSections([prevRow.section_data as MassSection], sectionPrefixes);
    const newPaths = extractOwnedBunnyPathsFromSections([cleanSection], sectionPrefixes);
    for (const oldPath of oldPaths) {
      if (!newPaths.has(oldPath)) {
        await deleteFromBunnyStorage(oldPath).catch(() => false);
      }
    }
  }

  revalidatePath("/", "layout");
  const savedSection = mapSavedSectionRow(data as SavedSectionRow);
  return {
    status: "success",
    savedSection,
    updatedAtLabel: formatDateTimeVi(savedSection.updatedAt),
  };
}

export async function deleteSavedSection(id: string): Promise<SavedSectionActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Vui lòng đăng nhập để xóa section." };
  }

  const supabase = await createClient();
  const { data: prevRow } = await supabase
    .from("saved_sections")
    .select("section_data")
    .eq("id", id)
    .eq("created_by", user.id)
    .maybeSingle();

  const { error } = await supabase.from("saved_sections").delete().eq("id", id).eq("created_by", user.id);

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      return {
        status: "table_missing",
        message: "Bảng saved_sections chưa được tạo trên Supabase.",
      };
    }
    console.error("[saved-sections] Failed to delete saved section:", error.code, error.message);
    return { status: "error", message: "Không thể xóa section. Vui lòng thử lại." };
  }

  if (prevRow?.section_data) {
    const mainDir = `mass-images/${user.id}/sections/${id}`;
    const legacyDir = `${user.id}/sections/${id}`;
    const paths = extractOwnedBunnyPathsFromSections([prevRow.section_data as MassSection], [
      `${mainDir}/`,
      `${legacyDir}/`,
    ]);
    for (const objectPath of paths) {
      await deleteFromBunnyStorage(objectPath).catch(() => false);
    }
    await deleteDirectoryFromBunnyStorage(mainDir).catch(() => false);
    if ([...paths].some((p) => p.startsWith(`${legacyDir}/`))) {
      await deleteDirectoryFromBunnyStorage(legacyDir).catch(() => false);
    }
  }

  revalidatePath("/", "layout");
  return { status: "deleted", id };
}
