"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { AlertCircle, CheckCircle2, Church, Loader2, Mail } from "lucide-react";

import { login, signInWithGoogle, signUp, type AuthFormState } from "@/app/auth/actions";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "sign-up";

const initialState: AuthFormState = { status: "idle" };

const inputClass =
  "w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-100 aria-invalid:border-rose-400 aria-invalid:focus:ring-rose-100";

const urlErrors: Record<string, string> = {
  auth_callback: "Liên kết xác thực không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.",
  google: "Không thể đăng nhập bằng Google. Vui lòng thử lại.",
};

export default function AuthCard({ mode }: { mode: AuthMode }) {
  const signingUp = mode === "sign-up";
  const [state, formAction, pending] = useActionState(signingUp ? signUp : login, initialState);
  const [, googleAction, googlePending] = useActionState(async () => {
    await signInWithGoogle();
  }, undefined);
  const busy = pending || googlePending;
  const errors = state.fieldErrors ?? {};

  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8fc] p-5">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
          <span className="flex size-9 items-center justify-center rounded-xl bg-violet-600 text-white"><Church className="size-5" /></span>
          pptmass
        </Link>
        <p className="text-sm font-semibold text-violet-700">{signingUp ? "Bắt đầu sử dụng" : "Chào mừng trở lại"}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{signingUp ? "Tạo tài khoản" : "Đăng nhập"}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{signingUp ? "Lưu thư viện bài hát và các Thánh lễ của riêng bạn." : "Tiếp tục soạn Thánh lễ của bạn."}</p>

        <Suspense>
          <UrlError />
        </Suspense>

        {state.message && (
          <div
            role={state.status === "error" ? "alert" : "status"}
            className={cn(
              "mt-6 flex items-start gap-2 rounded-xl p-3 text-sm leading-5",
              state.status === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800",
            )}
          >
            {state.status === "error" ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
            <p>{state.message}</p>
          </div>
        )}

        <form action={formAction} className="mt-7 space-y-4" noValidate>
          {signingUp && (
            <label className="block text-sm font-semibold text-slate-700">
              Tên hiển thị
              <input name="name" autoComplete="name" defaultValue={state.values?.name} aria-invalid={Boolean(errors.name)} placeholder="Ví dụ: Ban Truyền thông Long Thọ" className={cn("mt-1.5", inputClass)} />
              <FieldError message={errors.name} />
            </label>
          )}
          <label className="block text-sm font-semibold text-slate-700">
            Email
            <div className="relative mt-1.5">
              <Mail className="absolute left-3.5 top-3.5 size-4 text-slate-400" />
              <input name="email" type="email" autoComplete="email" defaultValue={state.values?.email} aria-invalid={Boolean(errors.email)} placeholder="bantruyenthong@example.com" className={cn("pl-10", inputClass)} />
            </div>
            <FieldError message={errors.email} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Mật khẩu
            <input name="password" type="password" autoComplete={signingUp ? "new-password" : "current-password"} aria-invalid={Boolean(errors.password)} placeholder="Ít nhất 8 ký tự" className={cn("mt-1.5", inputClass)} />
            <FieldError message={errors.password} />
          </label>
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {signingUp ? "Tạo tài khoản" : "Đăng nhập"}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-slate-400 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200">hoặc</div>
        <form action={googleAction}>
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
            {googlePending ? <Loader2 className="size-4 animate-spin" /> : <span className="font-bold text-[#4285f4]">G</span>} Tiếp tục với Google
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-slate-500">
          {signingUp ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
          <Link className="font-bold text-violet-700 hover:text-violet-900" href={signingUp ? "/login" : "/sign-up"}>{signingUp ? "Đăng nhập" : "Đăng ký"}</Link>
        </p>
      </section>
    </main>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="mt-1.5 block text-xs font-medium text-rose-600">{message}</span>;
}

function UrlError() {
  const code = useSearchParams().get("error");
  const message = code ? urlErrors[code] : undefined;
  if (!message) return null;
  return (
    <div role="alert" className="mt-6 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm leading-5 text-rose-700">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
