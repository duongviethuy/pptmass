"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { deleteFromBunnyStorage, extractBunnyObjectPathFromUrl } from "@/lib/bunny-storage";
import { normalizeSongPayload } from "@/lib/payload-normalizer";
import type { Song, SongPart } from "@/lib/pptmass-types";
import { formatDateTimeVi, mapSongRow, type SongRow } from "@/lib/songs";
import { createClient } from "@/lib/supabase/server";
import { toTitleCaseVi } from "@/lib/utils";

export type CreateSongInput = {
  title: string;
  author?: string;
  notes?: string;
  pdfUrl?: string;
  isPublic: boolean;
  categories: string[];
  topics: string[];
  parts: SongPart[];
};

export type UpdateSongInput = CreateSongInput & {
  id: string;
};

export type CreateSongResult =
  | { status: "success"; song: Song; createdAtLabel: string; updatedAtLabel: string; oldPdfDeleted?: boolean }
  | { status: "table_missing"; message: string }
  | { status: "error"; message: string; fieldErrors?: { title?: string; parts?: string } };

export type DeleteSongResult =
  | { status: "deleted"; id: string; pdfDeleted: boolean }
  | { status: "error"; message: string };

const songPartSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["verse", "chorus", "bridge"]),
  label: z.string().trim().min(1),
  lyrics: z.string().trim().min(1),
});

const createSongSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: "Vui lòng nhập tên bài hát." })
    .max(160, { error: "Tên bài hát tối đa 160 ký tự." })
    .transform(toTitleCaseVi),
  author: z
    .string()
    .trim()
    .max(120, { error: "Tên tác giả tối đa 120 ký tự." })
    .optional()
    .transform((val) => (val ? toTitleCaseVi(val) : undefined)),
  notes: z.string().trim().max(500, { error: "Ghi chú tối đa 500 ký tự." }).optional(),
  pdfUrl: z
    .string()
    .trim()
    .url({ error: "Đường dẫn tệp PDF không hợp lệ." })
    .max(1000, { error: "Đường dẫn tệp PDF quá dài." })
    .optional(),
  isPublic: z.boolean().default(true),
  categories: z.array(z.string().trim().min(1)).default([]),
  topics: z.array(z.string().trim().min(1)).default([]),
  parts: z.array(songPartSchema).min(1, { error: "Vui lòng nhập lời cho ít nhất một phần của bài hát." }),
});

export async function createSong(input: CreateSongInput): Promise<CreateSongResult> {
  const parsed = createSongSchema.safeParse(normalizeSongPayload(input));
  if (!parsed.success) {
    const fieldErrors: { title?: string; parts?: string } = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "title") fieldErrors.title ??= issue.message;
      if (key === "parts") fieldErrors.parts ??= issue.message;
    }
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Dữ liệu bài hát chưa hợp lệ.",
      fieldErrors,
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("songs")
    .insert({
      title: parsed.data.title,
      author: parsed.data.author || null,
      notes: parsed.data.notes || null,
      pdf_url: parsed.data.pdfUrl || null,
      is_public: parsed.data.isPublic,
      categories: parsed.data.categories,
      topics: parsed.data.topics,
      parts: parsed.data.parts,
      created_by: user.id,
      created_by_name: user.name,
      updated_by: user.id,
      updated_by_name: user.name,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01" || error.code === "42703" || error.code === "PGRST204") {
      return {
        status: "table_missing",
        message:
          "Bảng songs trên Supabase chưa có hoặc thiếu cột is_public / pdf_url. Hãy mở Supabase Dashboard -> SQL Editor và chạy lại file supabase/schema.sql trước khi lưu.",
      };
    }
    console.error("[songs] Failed to create song:", error.code, error.message);
    return { status: "error", message: "Không thể lưu bài hát lên Supabase. Vui lòng thử lại." };
  }

  revalidatePath("/", "layout");

  const song = mapSongRow(data as SongRow);
  return {
    status: "success",
    song,
    createdAtLabel: formatDateTimeVi(song.createdAt),
    updatedAtLabel: formatDateTimeVi(song.updatedAt),
  };
}

/**
 * Cập nhật bài hát của người dùng hiện tại.
 * Nếu tệp PDF bị thay đổi hoặc bị gỡ bỏ -> tự động xóa tệp PDF cũ trên Bunny Storage sau khi cập nhật DB thành công.
 */
export async function updateSong(input: UpdateSongInput): Promise<CreateSongResult> {
  const songId = input.id?.trim() ?? "";
  if (!songId) {
    return { status: "error", message: "Thiếu mã bài hát cần chỉnh sửa." };
  }

  const parsed = createSongSchema.safeParse(normalizeSongPayload(input));
  if (!parsed.success) {
    const fieldErrors: { title?: string; parts?: string } = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "title") fieldErrors.title ??= issue.message;
      if (key === "parts") fieldErrors.parts ??= issue.message;
    }
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Dữ liệu bài hát chưa hợp lệ.",
      fieldErrors,
    };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
  }

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("songs")
    .select("id, pdf_url, created_by")
    .eq("id", songId)
    .eq("created_by", user.id)
    .single();

  if (fetchError || !existing) {
    return { status: "error", message: "Không tìm thấy bài hát hoặc bạn không có quyền chỉnh sửa bài hát này." };
  }

  const previousPdfUrl = (existing as { pdf_url?: string | null }).pdf_url ?? null;
  const nextPdfUrl = parsed.data.pdfUrl || null;

  const { data, error } = await supabase
    .from("songs")
    .update({
      title: parsed.data.title,
      author: parsed.data.author || null,
      notes: parsed.data.notes || null,
      pdf_url: nextPdfUrl,
      is_public: parsed.data.isPublic,
      categories: parsed.data.categories,
      topics: parsed.data.topics,
      parts: parsed.data.parts,
      updated_by: user.id,
      updated_by_name: user.name,
    })
    .eq("id", songId)
    .eq("created_by", user.id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01" || error.code === "42703" || error.code === "PGRST204") {
      return {
        status: "table_missing",
        message:
          "Bảng songs trên Supabase chưa có hoặc thiếu cột is_public / pdf_url. Hãy chạy lại file supabase/schema.sql trong Supabase SQL Editor.",
      };
    }
    console.error("[songs] Failed to update song:", error.code, error.message);
    return { status: "error", message: "Không thể cập nhật bài hát lên Supabase. Vui lòng thử lại." };
  }

  // Nếu tệp PDF bị thay bằng tệp mới hoặc bị gỡ bỏ -> xóa tệp PDF cũ trên Bunny Storage
  let oldPdfDeleted = false;
  if (previousPdfUrl && previousPdfUrl !== nextPdfUrl) {
    const oldObjectPath = extractBunnyObjectPathFromUrl(previousPdfUrl);
    if (oldObjectPath && oldObjectPath.startsWith("songs/pdfs/")) {
      try {
        oldPdfDeleted = await deleteFromBunnyStorage(oldObjectPath);
      } catch (err) {
        console.error("[songs] Failed to delete replaced PDF on Bunny Storage:", err);
      }
    }
  }

  revalidatePath("/", "layout");

  const song = mapSongRow(data as SongRow);
  return {
    status: "success",
    song,
    createdAtLabel: formatDateTimeVi(song.createdAt),
    updatedAtLabel: formatDateTimeVi(song.updatedAt),
    oldPdfDeleted,
  };
}

/**
 * Xóa bài hát thuộc quyền sở hữu của người dùng hiện tại và tự động dọn tệp PDF đã lưu trên Bunny Storage (nếu có).
 */
export async function deleteSong(songId: string): Promise<DeleteSongResult> {
  const trimmedId = songId.trim();
  if (!trimmedId) {
    return { status: "error", message: "Mã bài hát không hợp lệ." };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", message: "Vui lòng đăng nhập để xóa bài hát." };
  }

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("songs")
    .select("id, pdf_url, created_by")
    .eq("id", trimmedId)
    .eq("created_by", user.id)
    .single();

  if (fetchError || !existing) {
    return { status: "error", message: "Không tìm thấy bài hát hoặc bạn không có quyền xóa bài hát này." };
  }

  const { error: deleteError } = await supabase
    .from("songs")
    .delete()
    .eq("id", trimmedId)
    .eq("created_by", user.id);

  if (deleteError) {
    console.error("[songs] Failed to delete song:", deleteError.code, deleteError.message);
    return { status: "error", message: "Không thể xóa bài hát trên Supabase. Vui lòng thử lại." };
  }

  let pdfDeleted = false;
  const pdfUrl = (existing as { pdf_url?: string | null }).pdf_url;
  if (pdfUrl) {
    const objectPath = extractBunnyObjectPathFromUrl(pdfUrl);
    if (objectPath && objectPath.startsWith("songs/pdfs/")) {
      try {
        pdfDeleted = await deleteFromBunnyStorage(objectPath);
      } catch (err) {
        console.error("[songs] Failed to delete PDF on Bunny Storage:", err);
      }
    }
  }

  revalidatePath("/", "layout");
  return { status: "deleted", id: trimmedId, pdfDeleted };
}
