import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; name: string; email: string };

/**
 * Đọc người dùng đang đăng nhập. Phụ thuộc request nên phải gọi bên trong <Suspense>.
 * `use cache: private` cho phép đọc cookies và dùng thời gian (Supabase kiểm tra hạn token)
 * trong lúc prerender/prefetch; kết quả chỉ được giữ theo từng phiên, không lưu chung trên server.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  "use cache: private";

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;

  const email = typeof claims.email === "string" ? claims.email : "";
  const metadata = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    [metadata.display_name, metadata.full_name, metadata.name].find((value): value is string => typeof value === "string" && value.trim().length > 0) ??
    email.split("@")[0];

  return { id: claims.sub, name, email };
}

/** Kiểm tra tài khoản hiện tại có nằm trong bảng public.admin_users hay không. */
export async function isAdminUser(userId?: string): Promise<boolean> {
  "use cache: private";

  if (!userId) return false;

  const supabase = await createClient();
  const { data, error } = await supabase.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle();

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") return false;
    console.error("[auth] Failed to check admin role:", error.code, error.message);
    return false;
  }

  return Boolean(data?.user_id);
}
