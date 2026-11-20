"use client";

import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BookHeart,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { createPrayer, deletePrayer, updatePrayer } from "@/app/prayers/actions";
import { normalizePrayerPayload } from "@/lib/payload-normalizer";
import type { Prayer } from "@/lib/pptmass-types";
import { cn } from "@/lib/utils";

export type PrayerWithLabel = Prayer & { updatedAtLabel: string };

type Feedback =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export default function PrayerManager({
  initialPrayers,
  isAdmin,
  currentUserId,
  tableMissing,
}: {
  initialPrayers: PrayerWithLabel[];
  isAdmin: boolean;
  currentUserId?: string;
  tableMissing?: boolean;
}) {
  const [prayers, setPrayers] = useState<PrayerWithLabel[]>(initialPrayers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; content?: string }>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredPrayers = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi-VN");
    if (!keyword) return prayers;
    return prayers.filter(
      (item) =>
        item.title.toLocaleLowerCase("vi-VN").includes(keyword) ||
        item.content.toLocaleLowerCase("vi-VN").includes(keyword),
    );
  }, [prayers, query]);

  function startCreate() {
    setEditingId(null);
    setTitle("");
    setContent("");
    setFieldErrors({});
    setFeedback(null);
  }

  function startEdit(prayer: PrayerWithLabel) {
    setEditingId(prayer.id);
    setTitle(prayer.title);
    setContent(prayer.content);
    setFieldErrors({});
    setFeedback(null);
  }

  function handleSubmit() {
    const payload = normalizePrayerPayload({ title, content });
    const nextErrors: { title?: string; content?: string } = {};

    if (!payload.title) nextErrors.title = "Vui lòng nhập tên kinh.";
    if (!payload.content) nextErrors.content = "Vui lòng nhập nội dung kinh.";

    if (nextErrors.title || nextErrors.content) {
      setFieldErrors(nextErrors);
      setFeedback(null);
      return;
    }

    setFieldErrors({});
    setFeedback(null);

    startTransition(async () => {
      const result = editingId
        ? await updatePrayer({ id: editingId, ...payload })
        : await createPrayer(payload);

      if (result.status === "success") {
        const nextItem: PrayerWithLabel = { ...result.prayer, updatedAtLabel: result.updatedAtLabel };
        if (editingId) {
          setPrayers((current) => current.map((item) => (item.id === editingId ? nextItem : item)));
          setFeedback({ status: "success", message: `Đã cập nhật "${nextItem.title}".` });
        } else {
          setPrayers((current) => [nextItem, ...current]);
          setFeedback({ status: "success", message: `Đã thêm "${nextItem.title}" vào thư viện kinh.` });
        }
        setEditingId(null);
        setTitle("");
        setContent("");
        return;
      }

      if (result.status === "error" && result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
      if (result.status !== "deleted") {
        setFeedback({ status: "error", message: result.message });
      }
    });
  }

  function handleDelete(prayer: PrayerWithLabel) {
    setFeedback(null);
    startTransition(async () => {
      const result = await deletePrayer(prayer.id);
      if (result.status === "deleted") {
        setPrayers((current) => current.filter((item) => item.id !== prayer.id));
        if (editingId === prayer.id) startCreate();
        setFeedback({ status: "success", message: `Đã xóa "${prayer.title}".` });
        return;
      }
      if (result.status !== "success") {
        setFeedback({ status: "error", message: result.message });
      }
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-7 lg:px-8 lg:py-9">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-violet-700">
            <ArrowLeft className="size-3.5" /> Quay lại trang chủ
          </Link>
          <h1 className="mt-2 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900">
            <span className="flex size-9 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
              <BookHeart className="size-5" />
            </span>
            Thư viện &amp; Quản lý Kinh
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Lưu trữ các kinh thường xuyên lặp lại trong Thánh lễ để đưa nhanh vào trình soạn slide.
          </p>
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold",
            isAdmin ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
          )}
        >
          {isAdmin ? <ShieldCheck className="size-4" /> : <ShieldAlert className="size-4" />}
          {isAdmin ? "Quyền Admin (Được phép tạo & sửa)" : "Thành viên (Chỉ xem)"}
        </span>
      </div>

      {tableMissing && (
        <div role="alert" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-bold text-amber-900">Bảng `prayers` hoặc `admin_users` chưa được tạo trên Supabase</p>
              <p className="mt-1 text-amber-800">
                Hãy mở Supabase Dashboard → SQL Editor và chạy lại toàn bộ file <code>supabase/schema.sql</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div
          role={feedback.status === "error" ? "alert" : "status"}
          className={cn(
            "mb-6 flex items-start gap-2.5 rounded-2xl border p-4 text-sm font-medium",
            feedback.status === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800",
          )}
        >
          {feedback.status === "error" ? (
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          )}
          <p>{feedback.message}</p>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
        {/* Cột trái: Form tạo / sửa kinh (chỉ dành cho Admin) */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          {isAdmin ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {editingId ? "Chỉnh sửa kinh" : "Thêm kinh mới"}
                </h2>
                {editingId && (
                  <button
                    type="button"
                    onClick={startCreate}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                  >
                    <X className="size-3.5" /> Hủy sửa
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">Chỉ cần nhập tên kinh và nội dung kinh.</p>

              <div className="mt-5 space-y-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Tên kinh <span className="text-rose-500">*</span>
                  <input
                    value={title}
                    autoComplete="off"
                    onChange={(event) => {
                      setTitle(event.target.value);
                      setFieldErrors((curr) => ({ ...curr, title: undefined }));
                    }}
                    placeholder="Ví dụ: KINH TRUYỀN TIN"
                    aria-invalid={Boolean(fieldErrors.title)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-100 aria-invalid:border-rose-400"
                  />
                  {fieldErrors.title && <span className="mt-1.5 block text-xs font-medium text-rose-600">{fieldErrors.title}</span>}
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Nội dung kinh <span className="text-rose-500">*</span>
                  <textarea
                    rows={9}
                    value={content}
                    autoComplete="off"
                    onChange={(event) => {
                      setContent(event.target.value);
                      setFieldErrors((curr) => ({ ...curr, content: undefined }));
                    }}
                    placeholder="Nhập nội dung kinh...\nĐể một dòng trống nếu muốn chủ động ngắt slide riêng."
                    aria-invalid={Boolean(fieldErrors.content)}
                    className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-normal leading-relaxed outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-3 focus:ring-violet-100 aria-invalid:border-rose-400"
                  />
                  {fieldErrors.content && <span className="mt-1.5 block text-xs font-medium text-rose-600">{fieldErrors.content}</span>}
                </label>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleSubmit}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : editingId ? <Save className="size-4" /> : <Plus className="size-4" />}
                  {isPending ? "Đang lưu..." : editingId ? "Lưu cập nhật" : "Thêm kinh vào thư viện"}
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
                <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
                <div className="text-xs leading-5 text-slate-600">
                  <p className="text-sm font-bold text-slate-900">Chỉ Admin mới được tạo kinh</p>
                  <p className="mt-1">
                    Để đảm bảo tính chuẩn xác của kinh phụng vụ, chỉ tài khoản Admin mới có quyền thêm hoặc sửa kinh trực tiếp.
                  </p>
                  <p className="mt-2 font-semibold text-violet-700">
                    Tính năng thành viên gửi yêu cầu thêm kinh cho Admin duyệt sẽ được bổ sung ở bước sau.
                  </p>
                </div>
              </div>

              {currentUserId && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-[11px] leading-5 text-slate-600">
                  <p className="font-bold text-slate-800">Nếu bạn là chủ dự án, chạy lệnh SQL sau trên Supabase để cấp quyền Admin cho tài khoản này:</p>
                  <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-[11px] text-slate-800">
                    {`insert into public.admin_users (user_id, note)\nvalues ('${currentUserId}', 'Admin');`}
                  </pre>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Cột phải: Danh sách kinh đã tạo */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Danh sách kinh ({filteredPrayers.length})</h2>
              <p className="mt-0.5 text-xs text-slate-500">Dùng chung trong trình soạn slide Thánh lễ.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm tên kinh hoặc nội dung..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pr-3 pl-9 text-xs outline-none focus:border-violet-400 focus:bg-white"
              />
            </div>
          </div>

          {filteredPrayers.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center text-xs text-slate-500">
              {prayers.length === 0
                ? "Chưa có kinh nào trong cơ sở dữ liệu."
                : "Không tìm thấy kinh nào khớp với từ khóa."}
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {filteredPrayers.map((prayer) => (
                <article key={prayer.id} className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 transition hover:border-violet-200 hover:bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{prayer.title}</h3>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Tạo bởi: {prayer.createdByName || "Admin"} · Cập nhật: {prayer.updatedAtLabel}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(prayer)}
                          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-violet-50 hover:text-violet-700"
                          aria-label={`Sửa ${prayer.title}`}
                          title="Chỉnh sửa"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDelete(prayer)}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                          aria-label={`Xóa ${prayer.title}`}
                          title="Xóa"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-2.5 whitespace-pre-line text-xs leading-6 text-slate-700">{prayer.content}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
