"use client";

import { Image as ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { PresentationSlide } from "@/lib/presentation";
import type { SlideAspectRatio } from "@/lib/pptmass-types";
import {
  SLIDE_DPI,
  SLIDE_FONT_FAMILY,
  getSlideDimensions,
  getSlideFontOption,
  getSlideLayoutBoxes,
  resolveSlideTheme,
} from "@/lib/slide-utils";
import { cn } from "@/lib/utils";

/**
 * Hiển thị 1 slide trình chiếu đúng chuẩn tỉ lệ 1:1 PowerPoint (1280×720 hoặc 960×720):
 * - `fillViewport = true`: căn giữa trên nền đen toàn màn hình (tự động letterbox/pillarbox theo màn hình chiếu thật).
 * - `fillViewport = false`: vừa khít khung tỉ lệ 16:9 / 4:3 dùng cho khung xem trước LIVE, NEXT và thumbnail.
 */
export function PresentationSlideStage({
  slide,
  aspectRatio,
  fillViewport = false,
  className,
}: {
  slide?: PresentationSlide;
  aspectRatio: SlideAspectRatio;
  fillViewport?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dims = getSlideDimensions(aspectRatio);
  const [scale, setScale] = useState(fillViewport ? 1 : 0.25);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const computeScale = (width: number, height: number) => {
      if (width <= 0) return;
      if (fillViewport && height > 0) {
        setScale(Math.min(width / dims.widthPx, height / dims.heightPx));
      } else {
        setScale(width / dims.widthPx);
      }
    };

    computeScale(el.clientWidth, el.clientHeight);
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      computeScale(rect?.width ?? el.clientWidth, rect?.height ?? el.clientHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [dims.widthPx, dims.heightPx, fillViewport]);

  const resolvedTheme = slide ? resolveSlideTheme(slide.themeId, slide.customTheme) : resolveSlideTheme("pure-white");
  const preview = slide?.preview;
  const hasHeading = Boolean(preview?.heading);
  const hasBody = Boolean(preview?.body || preview?.bodyPrefix);
  const boxes = getSlideLayoutBoxes(aspectRatio, hasHeading, hasBody);

  const headingFont = getSlideFontOption(preview?.headingFont).cssFont;
  const headingPt = preview?.headingPt ?? 40;
  const headingLinePt = preview?.headingLinePt ?? Math.round(headingPt * 1.2);
  const headingAlign = preview?.headingAlign ?? "center";
  const headingColor = preview?.headingColor;

  const subheadingPt = Math.max(20, Math.round(headingPt * 0.65));
  const subheadingLinePt = Math.max(24, Math.round(subheadingPt * 1.2));

  const bodyFont = getSlideFontOption(preview?.bodyFont).cssFont;
  const bodyPt = preview?.bodyPt ?? 85;
  const bodyLinePt = preview?.bodyLinePt ?? 105;
  const bodyAlign = preview?.bodyAlign ?? "justify";
  const bodyColor = preview?.bodyColor;

  const scaledW = Math.round(dims.widthPx * scale);
  const scaledH = Math.round(dims.heightPx * scale);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden select-none",
        fillViewport
          ? "flex h-full w-full items-center justify-center bg-black"
          : cn("w-full bg-black", aspectRatio === "4:3" ? "aspect-[4/3]" : "aspect-video"),
        className,
      )}
    >
      {/* Vỏ bọc đúng kích thước sau scale giúp căn giữa chính xác trên mọi tỉ lệ màn hình */}
      <div
        style={{
          width: fillViewport ? scaledW : "100%",
          height: fillViewport ? scaledH : "100%",
        }}
        className="relative shrink-0 overflow-hidden"
      >
        <div
          style={{
            ...resolvedTheme.canvasStyle,
            width: dims.widthPx,
            height: dims.heightPx,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            fontFamily: SLIDE_FONT_FAMILY,
          }}
          className={cn("relative overflow-hidden", resolvedTheme.canvasClass, "border-0")}
        >
          {resolvedTheme.overlayClass && <div className={cn("absolute inset-0", resolvedTheme.overlayClass)} />}

          {preview?.backgroundImage?.url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={preview.backgroundImage.url}
              alt=""
              style={{ opacity: Math.min(1, Math.max(0, preview.backgroundImage.opacity / 100)) }}
              className={cn(
                "pointer-events-none absolute inset-0 h-full w-full",
                preview.backgroundImage.fit === "contain" ? "object-contain" : "object-cover",
              )}
            />
          )}

          {!preview ? null : preview.kind === "image" ? (
            preview.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={preview.imageUrl}
                alt={preview.heading ?? "Hình ảnh trình chiếu"}
                className={cn(
                  "absolute inset-0 h-full w-full",
                  (preview.imageFit ?? "cover") === "contain" ? "object-contain" : "object-cover",
                )}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400">
                <ImageIcon className="mb-4 size-24 opacity-40" />
                <p className="font-bold opacity-60" style={{ fontSize: "34pt", lineHeight: "42pt" }}>
                  {preview.heading || "Chưa có hình ảnh"}
                </p>
              </div>
            )
          ) : (
            <>
              {hasHeading && boxes.headingBox && (
                <div
                  style={{
                    left: boxes.headingBox.x * SLIDE_DPI,
                    top: boxes.headingBox.y * SLIDE_DPI,
                    width: boxes.headingBox.w * SLIDE_DPI,
                    height: boxes.headingBox.h * SLIDE_DPI,
                  }}
                  className="absolute flex flex-col items-center justify-center gap-3"
                >
                  <p
                    className={cn("w-full font-bold uppercase", !headingColor && resolvedTheme.titleClass)}
                    style={{
                      fontFamily: headingFont,
                      fontSize: `${headingPt}pt`,
                      lineHeight: `${headingLinePt}pt`,
                      textAlign: headingAlign,
                      ...(headingColor ? { color: headingColor } : {}),
                    }}
                  >
                    {preview.heading}
                  </p>
                  {preview.subheading && (
                    <p
                      className={cn("w-full font-bold", !bodyColor && resolvedTheme.bodyClass)}
                      style={{
                        fontFamily: headingFont,
                        fontSize: `${subheadingPt}pt`,
                        lineHeight: `${subheadingLinePt}pt`,
                        textAlign: headingAlign,
                        ...(bodyColor ? { color: bodyColor } : {}),
                      }}
                    >
                      {preview.subheading}
                    </p>
                  )}
                </div>
              )}

              {hasBody && boxes.bodyBox && (
                <div
                  style={{
                    left: boxes.bodyBox.x * SLIDE_DPI,
                    top: boxes.bodyBox.y * SLIDE_DPI,
                    width: boxes.bodyBox.w * SLIDE_DPI,
                    height: boxes.bodyBox.h * SLIDE_DPI,
                  }}
                  className="absolute flex items-center justify-center overflow-hidden"
                >
                  <p
                    className={cn(
                      "w-full break-words whitespace-pre-wrap font-bold",
                      !bodyColor && resolvedTheme.bodyClass,
                    )}
                    style={{
                      fontFamily: bodyFont,
                      fontSize: `${bodyPt}pt`,
                      lineHeight: `${bodyLinePt}pt`,
                      textAlign: bodyAlign,
                      ...(bodyColor ? { color: bodyColor } : {}),
                    }}
                  >
                    {preview.bodyPrefix && (
                      <span
                        className={cn(!headingColor && resolvedTheme.titleClass)}
                        style={headingColor ? { color: headingColor } : undefined}
                      >
                        {preview.bodyPrefix}{" "}
                      </span>
                    )}
                    {preview.body}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
