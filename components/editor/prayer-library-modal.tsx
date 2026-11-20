"use client";

import { BookHeart, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { Prayer } from "@/lib/pptmass-types";

export function PrayerLibraryModal({
  prayers,
  readOnly,
  onSelectPrayer,
  onClose,
}: {
  prayers: Prayer[];
  readOnly: boolean;
  onSelectPrayer: (prayer: Prayer) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const filteredPrayers = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("vi-VN");
    if (!keyword) return prayers;
    return prayers.filter((prayer) =>
      `${prayer.title} ${prayer.content}`.toLocaleLowerCase("vi-VN").includes(keyword),
    );
  }, [prayers, query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-xs sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Thư viện kinh"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-teal-100 text-teal-700">
              <BookHeart className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Chọn kinh từ Thư viện kinh</h2>
              <p className="text-[11px] text-slate-500">
                {prayers.length} bài kinh khả dụng · Nhấn &ldquo;Thêm&rdquo; để đưa vào Trình tự Thánh lễ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thư viện kinh"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
          <div className="relative">
            <Search className="absolute top-2.5 left-3 size-3.5 text-slate-400" />
            <input
              value={query}
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-8 text-xs outline-none placeholder:text-slate-400 focus:border-violet-400"
              placeholder="Tìm tên kinh hoặc nội dung lời kinh..."
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {filteredPrayers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-xs text-slate-400">
              Không tìm thấy bài kinh nào phù hợp với từ khóa.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {filteredPrayers.map((prayer) => (
                <div
                  key={prayer.id}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 transition hover:border-teal-300 hover:bg-teal-50/30"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                    <BookHeart className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-slate-900">{prayer.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                      {prayer.content.replace(/\s+/g, " ").trim()}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => onSelectPrayer(prayer)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="size-3.5" /> Thêm
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
          <Link
            href="/prayers"
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-teal-300 bg-white px-3.5 py-2 text-xs font-bold text-teal-700 transition hover:bg-teal-50"
          >
            <Plus className="size-3.5" /> Quản lý &amp; tạo kinh mới
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
