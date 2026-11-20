import { BookHeart, FileText, Image as ImageIcon, Music2, type LucideIcon } from "lucide-react";

import type { ImageCategory, SectionKind } from "@/lib/pptmass-types";

export const SECTION_META: Record<SectionKind, { label: string; icon: LucideIcon; color: string }> = {
  image: { label: "Hình ảnh", icon: ImageIcon, color: "bg-amber-100 text-amber-700" },
  text: { label: "Section tùy chỉnh", icon: FileText, color: "bg-sky-100 text-sky-700" },
  song: { label: "Bài hát", icon: Music2, color: "bg-rose-100 text-rose-700" },
  prayer: { label: "Kinh", icon: BookHeart, color: "bg-teal-100 text-teal-700" },
};

export const IMAGE_CATEGORY_OPTIONS: { value: ImageCategory; label: string; defaultTitle: string }[] = [
  { value: "cover", label: "Ảnh bìa lễ", defaultTitle: "Ảnh bìa lễ" },
  { value: "reading", label: "Ảnh bài đọc", defaultTitle: "Ảnh bài đọc" },
  { value: "other", label: "Ảnh khác", defaultTitle: "Ảnh khác" },
];

export const IMAGE_CATEGORY_LABELS: Record<ImageCategory, string> = {
  cover: "Ảnh bìa lễ",
  reading: "Ảnh bài đọc",
  other: "Ảnh khác",
};

export const DEFAULT_IMAGE_TITLES = new Set(["Ảnh Thánh lễ", "Ảnh bìa lễ", "Ảnh bài đọc", "Ảnh khác"]);

export const SONG_CATEGORY_FILTERS = ["Tất cả", "Nhập lễ", "Đáp ca", "Dâng lễ", "Hiệp lễ", "Kết lễ"];

export type SongFilterScope = "all" | "mine" | "public";
