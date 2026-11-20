import { getCurrentUser } from "@/lib/auth";
import type { Song, SongPart } from "@/lib/pptmass-types";
import { createClient } from "@/lib/supabase/server";

export type SongRow = {
  id: string;
  title: string;
  author: string | null;
  notes: string | null;
  pdf_url?: string | null;
  is_public?: boolean | null;
  categories: string[] | null;
  topics: string[] | null;
  parts: SongPart[] | null;
  created_by: string;
  created_by_name: string;
  updated_by: string | null;
  updated_by_name: string;
  created_at: string;
  updated_at: string;
};

export type ListSongsResult = {
  songs: Song[];
  tableMissing: boolean;
  error?: string;
};

/** Định dạng ISO timestamp sang dạng dễ đọc theo giờ Việt Nam: HH:mm · dd/MM/yyyy. */
export function formatDateTimeVi(iso?: string): string {
  if (!iso) return "Vừa xong";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const parts = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
    hour12: false,
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("hour")}:${pick("minute")} · ${pick("day")}/${pick("month")}/${pick("year")}`;
}

export function mapSongRow(row: SongRow): Song {
  const categories = row.categories ?? [];
  const topics = row.topics ?? [];

  return {
    id: row.id,
    title: row.title,
    author: row.author ?? undefined,
    notes: row.notes ?? undefined,
    pdfUrl: row.pdf_url ?? undefined,
    isPublic: row.is_public ?? true,
    categories,
    topics,
    tags: [...categories, ...topics],
    parts: Array.isArray(row.parts) ? row.parts : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    updatedBy: row.updated_by ?? undefined,
    updatedByName: row.updated_by_name,
  };
}

/**
 * Lấy danh sách bài hát từ Supabase (gọi bên trong <Suspense>).
 * Chỉ trả về các bài hát công khai (is_public = true) hoặc do người dùng đang đăng nhập tạo (created_by = user.id).
 */
export async function listSongs(limit = 100): Promise<ListSongsResult> {
  "use cache: private";

  const user = await getCurrentUser();
  const supabase = await createClient();

  let query = supabase.from("songs").select("*").order("updated_at", { ascending: false }).limit(limit);
  if (user) {
    query = query.or(`is_public.eq.true,created_by.eq.${user.id}`);
  } else {
    query = query.eq("is_public", true);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01" || error.code === "42703" || error.code === "PGRST204") {
      return { songs: [], tableMissing: true };
    }
    console.error("[songs] Failed to list songs:", error.code, error.message);
    return { songs: [], tableMissing: false, error: error.message };
  }

  return {
    songs: (data ?? []).map((row) => mapSongRow(row as SongRow)),
    tableMissing: false,
  };
}

/** Lấy chi tiết 1 bài hát thuộc quyền sở hữu của người dùng hiện tại để chỉnh sửa. */
export async function getSongByIdForEdit(
  songId: string,
): Promise<{ song: Song | null; reason?: "unauthenticated" | "not_found" }> {
  const trimmedId = songId.trim();
  if (!trimmedId) return { song: null, reason: "not_found" };

  const user = await getCurrentUser();
  if (!user) return { song: null, reason: "unauthenticated" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("songs")
    .select("*")
    .eq("id", trimmedId)
    .eq("created_by", user.id)
    .single();

  if (error || !data) {
    return { song: null, reason: "not_found" };
  }

  return { song: mapSongRow(data as SongRow) };
}
