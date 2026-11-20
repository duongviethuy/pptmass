"use client";

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Minus,
  Palette,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { useState, type ReactNode, type RefObject } from "react";

import type {
  CustomSlideTheme,
  ImageCategory,
  ImageFitMode,
  MassSection,
  MassThemeId,
  SlideAspectRatio,
  SlideBackgroundImage,
  SlideFontFamily,
  SlideTextAlign,
} from "@/lib/pptmass-types";
import {
  PRESET_THEMES,
  SLIDE_FONT_OPTIONS,
  getCustomThemeBackgroundStyle,
  normalizeHexColor,
} from "@/lib/slide-utils";
import { cn } from "@/lib/utils";

const STUDIO_COLOR_SWATCHES = [
  { hex: "#0f172a", label: "Đen" },
  { hex: "#dc2626", label: "Đỏ" },
  { hex: "#b45309", label: "Vàng đồng" },
  { hex: "#1e3a8a", label: "Xanh đậm" },
  { hex: "#ffffff", label: "Trắng" },
];

const STUDIO_IMAGE_CATEGORIES: { value: ImageCategory; label: string }[] = [
  { value: "cover", label: "Ảnh bìa lễ" },
  { value: "reading", label: "Ảnh bài đọc" },
  { value: "other", label: "Ảnh khác" },
];

const ALIGN_BUTTONS: { value: SlideTextAlign; label: string; icon: typeof AlignJustify }[] = [
  { value: "justify", label: "Căn đều", icon: AlignJustify },
  { value: "center", label: "Căn giữa", icon: AlignCenter },
  { value: "left", label: "Căn trái", icon: AlignLeft },
];

export type SlideInspectorPanelProps = {
  section: MassSection;
  aspectRatio: SlideAspectRatio;
  readOnly: boolean;
  workspaceMode: boolean;
  effectiveTarget: "title" | "body";
  effectiveThemeId: MassThemeId;
  effectiveCustomTheme: CustomSlideTheme;
  activeBgImage?: SlideBackgroundImage;
  showBgUploader: boolean;
  onToggleBgUploader: () => void;
  ribbonFont: SlideFontFamily;
  ribbonPt: number;
  ribbonMinPt: number;
  ribbonMaxPt: number;
  ribbonLinePt: number;
  ribbonMinLinePt: number;
  ribbonMaxLinePt: number;
  ribbonAlign: SlideTextAlign;
  ribbonColor?: string;
  pickerColor: string;
  themeFeedback: string | null;
  allSettingsFeedback: string | null;
  isUploadingImage: boolean;
  uploadError: string | null;
  hasApplyThemeToAll: boolean;
  imageInspectorSlot?: ReactNode;
  imageFileInputRef: RefObject<HTMLInputElement | null>;
  bgFileInputRef: RefObject<HTMLInputElement | null>;
  onChangeSection: (nextSection: MassSection) => void;
  onAspectRatioChange?: (ratio: SlideAspectRatio) => void;
  onMainImageFile: (file: File) => void;
  onBgImageFile: (file: File) => void;
  onSelectTheme: (nextThemeId: MassThemeId) => void;
  onUpdateCustomTheme: (patch: Partial<CustomSlideTheme>) => void;
  onUpdateActiveBg: (patch: Partial<SlideBackgroundImage>) => void;
  onClearActiveBg: () => void;
  onApplyThemeToCurrentSection: () => void;
  onApplyThemeToAll: () => void;
  onUpdateFont: (font: SlideFontFamily) => void;
  onUpdatePt: (pt: number) => void;
  onUpdateLinePt: (pt: number) => void;
  onUpdateAlign: (align: SlideTextAlign) => void;
  onUpdateColor: (color: string | undefined) => void;
  onApplyAllSettingsToAllSlides: () => void;
};

/** Cột Inspector bên phải: Tên section, Giao diện & ảnh nền slide, Định dạng chữ hợp nhất, Áp dụng cho tất cả slide. */
export function SlideInspectorPanel({
  section,
  aspectRatio,
  readOnly,
  workspaceMode,
  effectiveTarget,
  effectiveThemeId,
  effectiveCustomTheme,
  activeBgImage,
  showBgUploader,
  onToggleBgUploader,
  ribbonFont,
  ribbonPt,
  ribbonMinPt,
  ribbonMaxPt,
  ribbonLinePt,
  ribbonMinLinePt,
  ribbonMaxLinePt,
  ribbonAlign,
  ribbonColor,
  pickerColor,
  themeFeedback,
  allSettingsFeedback,
  isUploadingImage,
  uploadError,
  hasApplyThemeToAll,
  imageInspectorSlot,
  imageFileInputRef,
  bgFileInputRef,
  onChangeSection,
  onAspectRatioChange,
  onMainImageFile,
  onBgImageFile,
  onSelectTheme,
  onUpdateCustomTheme,
  onUpdateActiveBg,
  onClearActiveBg,
  onApplyThemeToCurrentSection,
  onApplyThemeToAll,
  onUpdateFont,
  onUpdatePt,
  onUpdateLinePt,
  onUpdateAlign,
  onUpdateColor,
  onApplyAllSettingsToAllSlides,
}: SlideInspectorPanelProps) {
  const [showCustomThemePanel, setShowCustomThemePanel] = useState(false);
  const [showCustomColorPicker, setShowCustomColorPicker] = useState(false);

  const isCustomTextColor =
    Boolean(ribbonColor) && !STUDIO_COLOR_SWATCHES.some((s) => s.hex === ribbonColor?.toLowerCase());

  return (
    <aside
      className={cn(
        "flex flex-col bg-white",
        workspaceMode ? "p-4 lg:border-l lg:border-slate-200" : "rounded-2xl border border-slate-200 p-4 shadow-2xs",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-violet-600" />
          <h3 className="text-sm font-bold text-slate-900">
            {section.kind === "image" ? "Cài đặt Hình ảnh" : "Chỉnh sửa nội dung"}
          </h3>
        </div>
        {section.kind !== "image" && (
          <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">
            {effectiveTarget === "title" ? "Tiêu đề" : "Nội dung"}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* 1. Tên section */}
        <label className="block text-[11px] font-bold text-slate-500">
          Tên section
          <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-2 focus-within:border-violet-400 focus-within:bg-white">
            <Type className="size-3.5 shrink-0 text-violet-600" />
            <input
              value={section.title}
              disabled={readOnly}
              onChange={(event) => onChangeSection({ ...section, title: event.target.value })}
              placeholder="Đặt tên / tiêu đề section..."
              className="w-full bg-transparent text-xs font-bold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
            />
          </div>
        </label>

        {/* Tỉ lệ slide (chỉ hiển thị trên trang /sections) */}
        {onAspectRatioChange && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2">
            <span className="text-[11px] font-bold text-slate-500">Tỉ lệ slide</span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
              {(["16:9", "4:3"] as const).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => onAspectRatioChange(ratio)}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-bold transition",
                    aspectRatio === ratio ? "bg-violet-600 text-white" : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>
        )}

        {section.kind === "image" ? (
          imageInspectorSlot ? (
            imageInspectorSlot
          ) : (
            <div className="space-y-3.5">
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={readOnly || isUploadingImage}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onMainImageFile(file);
                }}
                className="hidden"
              />

              <div>
                <span className="mb-1.5 block text-[11px] font-bold text-slate-500">Loại hình ảnh</span>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
                  {STUDIO_IMAGE_CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      disabled={readOnly}
                      onClick={() => onChangeSection({ ...section, imageCategory: cat.value })}
                      className={cn(
                        "rounded-lg px-2 py-1.5 text-[11px] font-semibold transition",
                        (section.imageCategory ?? "cover") === cat.value
                          ? "bg-white text-violet-700 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900",
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-[11px] font-bold text-slate-500">Cách hiển thị ảnh</span>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                  {(
                    [
                      { value: "cover", label: "Phủ kín" },
                      { value: "contain", label: "Vừa khung" },
                    ] as const
                  ).map((fitOpt) => (
                    <button
                      key={fitOpt.value}
                      type="button"
                      disabled={readOnly}
                      onClick={() => onChangeSection({ ...section, imageFit: fitOpt.value as ImageFitMode })}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
                        (section.imageFit ?? "cover") === fitOpt.value
                          ? "bg-white text-violet-700 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900",
                      )}
                    >
                      {fitOpt.label}
                    </button>
                  ))}
                </div>
              </div>

              {!readOnly && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isUploadingImage}
                    onClick={() => imageFileInputRef.current?.click()}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-700 disabled:opacity-60"
                  >
                    {isUploadingImage ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                    {section.imageUrl ? "Đổi ảnh" : "Tải ảnh lên"}
                  </button>
                  {section.imageUrl && (
                    <button
                      type="button"
                      onClick={() => onChangeSection({ ...section, imageUrl: undefined })}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      <Trash2 className="size-3.5" /> Xóa
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        ) : (
          <>
            <input
              ref={bgFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={readOnly || isUploadingImage}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onBgImageFile(file);
              }}
              className="hidden"
            />

            {/* 2. Giao diện & ảnh nền slide */}
            <div className="space-y-2.5 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between">
                <span className="block text-[11px] font-bold text-slate-500">Giao diện &amp; ảnh nền slide</span>
                <span className="text-[10px] font-semibold text-slate-400">
                  {activeBgImage?.url
                    ? `Ảnh nền · ${activeBgImage.opacity}%`
                    : effectiveThemeId === "custom"
                      ? "Tự chọn nền"
                      : PRESET_THEMES[effectiveThemeId]?.label ?? "Nền mẫu"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {Object.values(PRESET_THEMES).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => {
                      onSelectTheme(item.id);
                      setShowCustomThemePanel(false);
                    }}
                    title={item.label}
                    aria-label={`Chọn giao diện ${item.label}`}
                    className={cn(
                      "size-6 rounded-full transition",
                      item.swatchClass,
                      effectiveThemeId === item.id
                        ? "ring-2 ring-violet-600 ring-offset-2"
                        : "opacity-75 hover:opacity-100",
                    )}
                  />
                ))}

                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    onSelectTheme("custom");
                    if (showBgUploader) onToggleBgUploader();
                    setShowCustomThemePanel((prev) => (effectiveThemeId === "custom" ? !prev : true));
                  }}
                  title="Tự chọn màu nền / Gradient / Mã HEX"
                  style={effectiveThemeId === "custom" ? getCustomThemeBackgroundStyle(effectiveCustomTheme) : undefined}
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-bold transition",
                    effectiveThemeId === "custom"
                      ? cn(
                          "border-violet-600 ring-2 ring-violet-600 ring-offset-1",
                          effectiveCustomTheme.textColor === "dark" ? "text-slate-900" : "text-white",
                        )
                      : "border-slate-300 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400 text-white opacity-90 hover:opacity-100",
                  )}
                >
                  <Palette className="size-3" /> Tự chọn
                </button>

                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => {
                    setShowCustomThemePanel(false);
                    onToggleBgUploader();
                  }}
                  title="Tải ảnh nền hoặc chỉnh độ mờ ảnh nền"
                  className={cn(
                    "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-bold transition",
                    showBgUploader || Boolean(activeBgImage?.url)
                      ? "border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-300"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-300 hover:bg-violet-50/70 hover:text-violet-700",
                  )}
                >
                  <ImagePlus className="size-3 text-violet-600" /> Ảnh nền
                </button>
              </div>

              {/* Bảng tùy chỉnh màu nền / Gradient */}
              {!readOnly && effectiveThemeId === "custom" && showCustomThemePanel && (
                <div className="space-y-2.5 rounded-xl border border-slate-200/90 bg-slate-50/80 p-2.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                      {(
                        [
                          { value: "solid", label: "Màu đơn" },
                          { value: "gradient", label: "Gradient" },
                        ] as const
                      ).map((modeOpt) => (
                        <button
                          key={modeOpt.value}
                          type="button"
                          onClick={() => onUpdateCustomTheme({ mode: modeOpt.value })}
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11px] font-semibold transition",
                            effectiveCustomTheme.mode === modeOpt.value
                              ? "bg-violet-600 text-white"
                              : "text-slate-600 hover:text-slate-900",
                          )}
                        >
                          {modeOpt.label}
                        </button>
                      ))}
                    </div>

                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                      {(
                        [
                          { value: "light", label: "Chữ sáng" },
                          { value: "dark", label: "Chữ tối" },
                        ] as const
                      ).map((textOpt) => (
                        <button
                          key={textOpt.value}
                          type="button"
                          onClick={() => onUpdateCustomTheme({ textColor: textOpt.value })}
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11px] font-semibold transition",
                            effectiveCustomTheme.textColor === textOpt.value
                              ? "bg-slate-900 text-white"
                              : "text-slate-600",
                          )}
                        >
                          {textOpt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] font-semibold text-slate-500">
                        {effectiveCustomTheme.mode === "gradient" ? "Màu 1" : "Màu nền"}
                      </span>
                      <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1">
                        <span
                          className="relative size-4 shrink-0 overflow-hidden rounded-full border border-slate-200"
                          style={{ backgroundColor: normalizeHexColor(effectiveCustomTheme.colorFrom, "#f8fafc") }}
                        >
                          <input
                            type="color"
                            value={normalizeHexColor(effectiveCustomTheme.colorFrom, "#f8fafc")}
                            onChange={(event) => onUpdateCustomTheme({ colorFrom: event.target.value })}
                            className="absolute inset-0 size-full cursor-pointer opacity-0"
                          />
                        </span>
                        <input
                          value={effectiveCustomTheme.colorFrom}
                          onChange={(event) => onUpdateCustomTheme({ colorFrom: event.target.value })}
                          onBlur={() =>
                            onUpdateCustomTheme({
                              colorFrom: normalizeHexColor(effectiveCustomTheme.colorFrom, "#f8fafc"),
                            })
                          }
                          maxLength={7}
                          className="w-full font-mono text-[11px] font-semibold text-slate-800 uppercase outline-none"
                        />
                      </div>
                    </div>

                    {effectiveCustomTheme.mode === "gradient" && (
                      <div>
                        <span className="block text-[10px] font-semibold text-slate-500">Màu 2</span>
                        <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1">
                          <span
                            className="relative size-4 shrink-0 overflow-hidden rounded-full border border-slate-200"
                            style={{ backgroundColor: normalizeHexColor(effectiveCustomTheme.colorTo, "#e2e8f0") }}
                          >
                            <input
                              type="color"
                              value={normalizeHexColor(effectiveCustomTheme.colorTo, "#e2e8f0")}
                              onChange={(event) => onUpdateCustomTheme({ colorTo: event.target.value })}
                              className="absolute inset-0 size-full cursor-pointer opacity-0"
                            />
                          </span>
                          <input
                            value={effectiveCustomTheme.colorTo}
                            onChange={(event) => onUpdateCustomTheme({ colorTo: event.target.value })}
                            onBlur={() =>
                              onUpdateCustomTheme({
                                colorTo: normalizeHexColor(effectiveCustomTheme.colorTo, "#e2e8f0"),
                              })
                            }
                            maxLength={7}
                            className="w-full font-mono text-[11px] font-semibold text-slate-800 uppercase outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {effectiveCustomTheme.mode === "gradient" && (
                    <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                      <span className="shrink-0">Góc ({effectiveCustomTheme.angle}°):</span>
                      <input
                        type="range"
                        min={0}
                        max={360}
                        value={effectiveCustomTheme.angle}
                        onChange={(event) => onUpdateCustomTheme({ angle: Number(event.target.value) })}
                        className="h-1.5 flex-1 cursor-pointer accent-violet-600"
                      />
                    </label>
                  )}
                </div>
              )}

              {/* Khung tải Ảnh nền tinh tế -> khi đã tải ảnh lên thì hiện thanh chỉnh Độ mờ / Độ rõ */}
              {!readOnly && (showBgUploader || Boolean(activeBgImage?.url)) && (
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-2.5">
                  {!activeBgImage?.url ? (
                    <button
                      type="button"
                      disabled={isUploadingImage}
                      onClick={() => bgFileInputRef.current?.click()}
                      className="group flex w-full items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-left shadow-2xs transition hover:border-violet-300 hover:bg-violet-50/40 disabled:opacity-60"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 transition group-hover:bg-violet-100">
                        {isUploadingImage ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 group-hover:text-violet-700">
                          {isUploadingImage ? "Đang tải ảnh nền..." : "Tải ảnh nền từ máy tính"}
                        </p>
                        <p className="truncate text-[10px] text-slate-400">JPG, PNG, WebP, GIF · Tối đa 10MB</p>
                      </div>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isUploadingImage}
                          onClick={() => bgFileInputRef.current?.click()}
                          title="Bấm để đổi ảnh nền khác"
                          className="relative h-9 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={activeBgImage.url}
                            alt="Ảnh nền slide"
                            style={{ opacity: activeBgImage.opacity / 100 }}
                            className={cn(
                              "h-full w-full",
                              activeBgImage.fit === "contain" ? "object-contain" : "object-cover",
                            )}
                          />
                        </button>

                        <div className="grid flex-1 grid-cols-2 gap-1 rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
                          {(
                            [
                              { value: "cover", label: "Phủ kín" },
                              { value: "contain", label: "Vừa khung" },
                            ] as const
                          ).map((fitOpt) => (
                            <button
                              key={fitOpt.value}
                              type="button"
                              disabled={readOnly}
                              onClick={() => onUpdateActiveBg({ fit: fitOpt.value as ImageFitMode })}
                              className={cn(
                                "rounded-md py-1 text-[11px] font-semibold transition",
                                (activeBgImage.fit ?? "cover") === fitOpt.value
                                  ? "bg-violet-600 text-white"
                                  : "text-slate-600 hover:text-slate-900",
                              )}
                            >
                              {fitOpt.label}
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          disabled={isUploadingImage}
                          onClick={() => bgFileInputRef.current?.click()}
                          title="Đổi ảnh nền"
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                        >
                          {isUploadingImage ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={onClearActiveBg}
                          title="Xóa ảnh nền slide này"
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition hover:bg-rose-50"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>

                      <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                        <span className="shrink-0">Độ mờ / Độ rõ ({activeBgImage.opacity}%):</span>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          step={5}
                          disabled={readOnly}
                          value={activeBgImage.opacity}
                          onChange={(event) => onUpdateActiveBg({ opacity: Number(event.target.value) })}
                          className="h-1.5 flex-1 cursor-pointer accent-violet-600"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {!readOnly && (
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={onApplyThemeToCurrentSection}
                    title="Áp dụng giao diện & ảnh nền cho tất cả slide trong section này"
                    className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold whitespace-nowrap text-slate-700 shadow-2xs transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                  >
                    Cho section này
                  </button>
                  {hasApplyThemeToAll && (
                    <button
                      type="button"
                      onClick={onApplyThemeToAll}
                      title="Áp dụng giao diện & ảnh nền cho toàn bộ bài trình chiếu"
                      className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-bold whitespace-nowrap text-slate-700 shadow-2xs transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                    >
                      Toàn bộ trình chiếu
                    </button>
                  )}
                </div>
              )}

              {themeFeedback && (
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <CheckCircle2 className="size-3.5 shrink-0" /> {themeFeedback}
                </p>
              )}
            </div>

            {/* 3. Định dạng chữ hợp nhất (Phông chữ, Cỡ chữ, Giãn dòng, Căn lề & Màu chữ) */}
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between">
                <span className="block text-[11px] font-bold text-slate-500">
                  Định dạng chữ ({effectiveTarget === "title" ? "Tiêu đề" : "Nội dung"})
                </span>
                <span className="text-[10px] font-semibold text-slate-400">
                  {ribbonFont} · {ribbonPt}pt
                </span>
              </div>

              <select
                value={ribbonFont}
                disabled={readOnly}
                onChange={(event) => onUpdateFont(event.target.value as SlideFontFamily)}
                aria-label="Chọn font chữ"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-violet-400 focus:bg-white"
              >
                {SLIDE_FONT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="mb-1 block text-[10px] font-semibold text-slate-400">Cỡ chữ</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={readOnly || ribbonPt <= ribbonMinPt}
                      onClick={() => onUpdatePt(ribbonPt - 2)}
                      aria-label="Giảm cỡ chữ"
                      className="flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-violet-300 hover:text-violet-700 disabled:opacity-40"
                    >
                      <Minus className="size-3" />
                    </button>
                    <div className="relative">
                      <input
                        type="number"
                        min={ribbonMinPt}
                        max={ribbonMaxPt}
                        step={2}
                        disabled={readOnly}
                        value={ribbonPt}
                        onChange={(event) => {
                          const parsed = Number(event.target.value);
                          if (Number.isFinite(parsed)) onUpdatePt(parsed);
                        }}
                        aria-label="Cỡ chữ theo pt"
                        className="w-15 [appearance:textfield] rounded-lg border border-slate-200 bg-white py-1 pr-5 pl-1.5 text-center text-xs font-bold text-slate-800 outline-none focus:border-violet-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-[10px] font-semibold text-slate-400">
                        pt
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={readOnly || ribbonPt >= ribbonMaxPt}
                      onClick={() => onUpdatePt(ribbonPt + 2)}
                      aria-label="Tăng cỡ chữ"
                      className="flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-violet-300 hover:text-violet-700 disabled:opacity-40"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="mb-1 block text-[10px] font-semibold text-slate-400">Giãn dòng (Spacing)</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={readOnly || ribbonLinePt <= ribbonMinLinePt}
                      onClick={() => onUpdateLinePt(ribbonLinePt - 2)}
                      aria-label="Giảm khoảng cách dòng"
                      title="Giảm khoảng cách dòng (Spacing)"
                      className="flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-violet-300 hover:text-violet-700 disabled:opacity-40"
                    >
                      <Minus className="size-3" />
                    </button>
                    <div className="relative">
                      <input
                        type="number"
                        min={ribbonMinLinePt}
                        max={ribbonMaxLinePt}
                        step={2}
                        disabled={readOnly}
                        value={ribbonLinePt}
                        onChange={(event) => {
                          const parsed = Number(event.target.value);
                          if (Number.isFinite(parsed)) onUpdateLinePt(parsed);
                        }}
                        aria-label="Khoảng cách dòng theo pt"
                        className="w-15 [appearance:textfield] rounded-lg border border-slate-200 bg-white py-1 pr-5 pl-1.5 text-center text-xs font-bold text-slate-800 outline-none focus:border-violet-400 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-[10px] font-semibold text-slate-400">
                        pt
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={readOnly || ribbonLinePt >= ribbonMaxLinePt}
                      onClick={() => onUpdateLinePt(ribbonLinePt + 2)}
                      aria-label="Tăng khoảng cách dòng"
                      title="Tăng khoảng cách dòng (Spacing)"
                      className="flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-violet-300 hover:text-violet-700 disabled:opacity-40"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400">Căn lề</span>
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                  {ALIGN_BUTTONS.map((btn) => {
                    const Icon = btn.icon;
                    return (
                      <button
                        key={btn.value}
                        type="button"
                        disabled={readOnly}
                        onClick={() => onUpdateAlign(btn.value)}
                        title={btn.label}
                        aria-label={btn.label}
                        className={cn(
                          "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition",
                          ribbonAlign === btn.value
                            ? "bg-white text-violet-700 shadow-2xs"
                            : "text-slate-500 hover:text-slate-900",
                        )}
                      >
                        <Icon className="size-3.5" /> {btn.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-slate-400">Màu chữ</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => {
                        onUpdateColor(undefined);
                        setShowCustomColorPicker(false);
                      }}
                      className={cn(
                        "h-6 rounded-full px-2 text-[11px] font-bold transition",
                        !ribbonColor
                          ? "bg-violet-50 text-violet-700 ring-1 ring-violet-200"
                          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                      )}
                    >
                      Mặc định
                    </button>
                    {STUDIO_COLOR_SWATCHES.map((swatch) => {
                      const active = ribbonColor?.toLowerCase() === swatch.hex;
                      return (
                        <button
                          key={swatch.hex}
                          type="button"
                          disabled={readOnly}
                          onClick={() => {
                            onUpdateColor(swatch.hex);
                            setShowCustomColorPicker(false);
                          }}
                          title={swatch.label}
                          style={{ backgroundColor: swatch.hex }}
                          className={cn(
                            "size-6 rounded-full border border-slate-300/80 transition hover:scale-110",
                            active && "ring-2 ring-violet-600 ring-offset-1",
                          )}
                        />
                      );
                    })}

                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => setShowCustomColorPicker((prev) => !prev)}
                      title="Tự chọn màu chữ tùy ý"
                      aria-label="Tự chọn màu chữ tùy ý"
                      style={{
                        background: isCustomTextColor
                          ? pickerColor
                          : "conic-gradient(from 90deg, #ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ec4899, #ef4444)",
                      }}
                      className={cn(
                        "size-6 rounded-full border border-slate-300/80 shadow-2xs transition duration-200 hover:scale-115 hover:rotate-45 hover:shadow-md",
                        (showCustomColorPicker || isCustomTextColor) && "ring-2 ring-violet-600 ring-offset-1",
                      )}
                    />
                  </div>
                </div>

                {!readOnly && showCustomColorPicker && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 px-2.5 py-2">
                    <span className="text-[11px] font-semibold text-slate-600">Mã màu chữ</span>
                    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 shadow-2xs">
                      <span
                        className="relative size-4 shrink-0 overflow-hidden rounded-full border border-slate-200"
                        style={{ backgroundColor: pickerColor }}
                      >
                        <input
                          type="color"
                          value={pickerColor}
                          disabled={readOnly}
                          onChange={(event) => onUpdateColor(event.target.value)}
                          aria-label="Chọn màu chữ tùy ý"
                          className="absolute inset-0 size-full cursor-pointer opacity-0"
                        />
                      </span>
                      <input
                        value={ribbonColor ?? pickerColor}
                        disabled={readOnly}
                        onChange={(event) => onUpdateColor(event.target.value || undefined)}
                        onBlur={() => {
                          if (ribbonColor) onUpdateColor(normalizeHexColor(ribbonColor, pickerColor));
                        }}
                        placeholder="#000000"
                        maxLength={7}
                        className="w-16 font-mono text-[11px] font-bold text-slate-800 uppercase outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Nút áp dụng cài đặt này cho tất cả slide */}
            {!readOnly && (
              <div className="space-y-2 border-t border-slate-100 pt-3.5">
                <button
                  type="button"
                  onClick={onApplyAllSettingsToAllSlides}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-violet-700"
                >
                  <Sparkles className="size-3.5" /> Áp dụng cài đặt này cho tất cả slide
                </button>

                {allSettingsFeedback && (
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                    <CheckCircle2 className="size-3.5 shrink-0" /> {allSettingsFeedback}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {uploadError && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
            {uploadError}
          </p>
        )}
      </div>
    </aside>
  );
}
