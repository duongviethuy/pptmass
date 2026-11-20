"use server";

import type { AuthError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "password", string>>;
  values?: { name?: string; email?: string };
};

const emailSchema = z.email({ error: "Email không hợp lệ." });

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Vui lòng nhập mật khẩu." }),
});

const signUpSchema = z.object({
  name: z.string().trim().min(2, { error: "Tên hiển thị cần ít nhất 2 ký tự." }).max(80, { error: "Tên hiển thị tối đa 80 ký tự." }),
  email: emailSchema,
  password: z.string().min(8, { error: "Mật khẩu cần ít nhất 8 ký tự." }).max(72, { error: "Mật khẩu tối đa 72 ký tự." }),
});

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

function toFieldErrors(error: z.ZodError): AuthFormState["fieldErrors"] {
  const fieldErrors: AuthFormState["fieldErrors"] = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof NonNullable<AuthFormState["fieldErrors"]>;
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}

function translateAuthError(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Email hoặc mật khẩu không đúng.";
    case "email_not_confirmed":
      return "Email chưa được xác nhận. Vui lòng kiểm tra hộp thư của bạn.";
    case "user_already_exists":
    case "email_exists":
      return "Email này đã được đăng ký. Hãy đăng nhập.";
    case "weak_password":
      return "Mật khẩu quá yếu. Hãy dùng mật khẩu dài hơn, có chữ và số.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "Chức năng đăng ký bằng email đang tạm tắt.";
    case "email_address_invalid":
      return "Địa chỉ email không hợp lệ hoặc không được chấp nhận.";
    default:
      console.error("[auth] Unexpected Supabase error:", error.code, error.message);
      return "Đã có lỗi xảy ra. Vui lòng thử lại.";
  }
}

async function getOrigin() {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (origin) return origin;
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = readForm(formData);
  const values = { email: raw.email };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { status: "error", message: translateAuthError(error), values };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = readForm(formData);
  const values = { name: raw.name, email: raw.email };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.name },
      emailRedirectTo: `${await getOrigin()}/auth/callback`,
    },
  });
  if (error) return { status: "error", message: translateAuthError(error), values };

  // Khi bật "Confirm email", Supabase trả về user giả không có identity nếu email đã tồn tại.
  if (data.user && data.user.identities?.length === 0) {
    return { status: "error", message: "Email này đã được đăng ký. Hãy đăng nhập.", values };
  }

  // Đã tắt "Confirm email": có session ngay, vào thẳng trình soạn.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/");
  }

  return {
    status: "success",
    message: `Đã gửi email xác nhận tới ${parsed.data.email}. Hãy mở email và bấm vào liên kết để kích hoạt tài khoản.`,
    values,
  };
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await getOrigin()}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
