"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { normalizePrayerPayload } from "@/lib/payload-normalizer";
import type { Prayer } from "@/lib/pptmass-types";
import { mapPrayerRow, type PrayerRow } from "@/lib/prayers";
import { formatDateTimeVi } from "@/lib/songs";
import { createClient } from "@/lib/supabase/server";

export type PrayerActionResult =
  | { status: "success"; prayer: Prayer; updatedAtLabel: string }
  | { status: "deleted"; id: string }
  | { status: "table_missing"; message: string }
  | { status: "forbidden"; message: string }
  | { status: "error"; message: string; fieldErrors?: { title?: string; content?: string } };

const prayerSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { error: "Vui lòng nhập tên kinh." })
    .max(160, { error: "Tên kinh tối đa 160 ký tự." }),
  content: z
    .string()
    .trim()
    .min(1, { error: "Vui lòng nhập nội dung kinh." })
    .max(10000, { error: "Nội dung kinh tối đa 10.000 ký tự." }),
});

function parseFieldErrors(error: z.ZodError): { title?: string; content?: string } {
  const fieldErrors: { title?: string; content?: string } = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (key === "title") fieldErrors.title ??= issue.message;
    if (key === "content") fieldErrors.content ??= issue.message;
  }
  return fieldErrors;
}

export async function createPrayer(input: { title: string; content: string }): Promise<PrayerActionResult> {
  const parsed = prayerSchema.safeParse(normalizePrayerPayload(input));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Dữ liệu kinh chưa hợp lệ.",
      fieldErrors: parseFieldErrors(parsed.error),
    };
  }

  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };

  const admin = await isAdminUser(user.id);
  if (!admin) {
    return {
      status: "forbidden",
      message: "Chỉ tài khoản Admin mới có quyền thêm kinh mới. Tính năng gửi yêu cầu cho Admin sẽ được bổ sung sau.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prayers")
    .insert({
      title: parsed.data.title,
      content: parsed.data.content,
      created_by: user.id,
      created_by_name: user.name,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      return {
        status: "table_missing",
        message: "Bảng prayers chưa được tạo trên Supabase. Hãy chạy file supabase/schema.sql trong SQL Editor.",
      };
    }
    if (error.code === "42501") {
      return { status: "forbidden", message: "Tài khoản của bạn chưa được cấp quyền Admin trong bảng admin_users." };
    }
    console.error("[prayers] Failed to create prayer:", error.code, error.message);
    return { status: "error", message: "Không thể lưu kinh mới. Vui lòng thử lại." };
  }

  revalidatePath("/", "layout");
  const prayer = mapPrayerRow(data as PrayerRow);
  return { status: "success", prayer, updatedAtLabel: formatDateTimeVi(prayer.updatedAt) };
}

export async function updatePrayer(input: { id: string; title: string; content: string }): Promise<PrayerActionResult> {
  const parsed = prayerSchema.safeParse(normalizePrayerPayload(input));
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Dữ liệu kinh chưa hợp lệ.",
      fieldErrors: parseFieldErrors(parsed.error),
    };
  }

  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };

  const admin = await isAdminUser(user.id);
  if (!admin) {
    return { status: "forbidden", message: "Chỉ tài khoản Admin mới có quyền chỉnh sửa kinh." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prayers")
    .update({ title: parsed.data.title, content: parsed.data.content })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "42501") {
      return { status: "forbidden", message: "Tài khoản của bạn chưa có quyền Admin." };
    }
    console.error("[prayers] Failed to update prayer:", error.code, error.message);
    return { status: "error", message: "Không thể cập nhật kinh. Vui lòng thử lại." };
  }

  revalidatePath("/", "layout");
  const prayer = mapPrayerRow(data as PrayerRow);
  return { status: "success", prayer, updatedAtLabel: formatDateTimeVi(prayer.updatedAt) };
}

export async function deletePrayer(id: string): Promise<PrayerActionResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };

  const admin = await isAdminUser(user.id);
  if (!admin) {
    return { status: "forbidden", message: "Chỉ tài khoản Admin mới có quyền xóa kinh." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("prayers").delete().eq("id", id);

  if (error) {
    console.error("[prayers] Failed to delete prayer:", error.code, error.message);
    return { status: "error", message: "Không thể xóa kinh. Vui lòng thử lại." };
  }

  revalidatePath("/", "layout");
  return { status: "deleted", id };
}
