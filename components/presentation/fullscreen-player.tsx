"use client";

import { ChevronLeft, ChevronRight, LayoutGrid, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { PresentationSlideStage } from "@/components/presentation/presentation-slide-stage";
import type { PresentationDeck } from "@/lib/presentation";
import { cn } from "@/lib/utils";

export function FullscreenPlayer({
  deck,
  initialIndex,
  onExit,
}: {
  deck: PresentationDeck;
  initialIndex: number;
  onExit: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, deck.slides.length - 1)),
  );
  const [showGrid, setShowGrid] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const hadFullscreenRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalSlides = deck.slides.length;
  const activeSlide = deck.slides[currentIndex];

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, Math.max(0, totalSlides - 1)));
  }, [totalSlides]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const exitPresentation = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
    onExit();
  }, [onExit]);

  const wakeControls = useCallback(() => {
    setControlsVisible(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 2200);
  }, []);

  useEffect(() => {
    const syncFs = () => {
      const nowFs = Boolean(document.fullscreenElement);
      if (nowFs) {
        hadFullscreenRef.current = true;
      } else if (hadFullscreenRef.current) {
        // Khi thoát Fullscreen (Esc) -> thoát luôn chế độ trình chiếu
        onExit();
      }
    };

    syncFs();
    document.addEventListener("fullscreenchange", syncFs);
    return () => document.removeEventListener("fullscreenchange", syncFs);
  }, [onExit]);

  useEffect(() => {
    idleTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 2200);
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      wakeControls();
      if (event.key === "Escape") {
        event.preventDefault();
        if (showGrid) {
          setShowGrid(false);
        } else {
          exitPresentation();
        }
        return;
      }
      if (event.key === "g" || event.key === "G") {
        event.preventDefault();
        setShowGrid((prev) => !prev);
        return;
      }
      if (showGrid) return;

      if (
        event.key === "ArrowRight" ||
        event.key === "ArrowDown" ||
        event.key === " " ||
        event.key === "PageDown" ||
        event.key === "Enter"
      ) {
        event.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
        goNext();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur?.();
        goPrev();
      } else if (event.key === "Home") {
        event.preventDefault();
        setCurrentIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setCurrentIndex(Math.max(0, totalSlides - 1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [wakeControls, showGrid, exitPresentation, goNext, goPrev, totalSlides]);

  return (
    <div
      onMouseMove={wakeControls}
      className={cn(
        "fixed inset-0 z-[100] flex flex-col bg-black",
        !controlsVisible && !showGrid && "cursor-none",
      )}
    >
      {/* Vùng chiếu 1:1 PowerPoint */}
      <div
        className="relative flex-1 overflow-hidden"
        onClick={(event) => {
          if (showGrid) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const relX = (event.clientX - rect.left) / rect.width;
          if (relX < 0.25) {
            goPrev();
          } else {
            goNext();
          }
        }}
      >
        <PresentationSlideStage slide={activeSlide} aspectRatio={deck.aspectRatio} fillViewport />
      </div>

      {/* Thanh điều khiển siêu gọn, tự ẩn khi không di chuột */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-3 z-30 flex justify-center px-3 transition-opacity duration-200",
          controlsVisible || showGrid ? "opacity-100" : "opacity-0",
        )}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          className="pointer-events-auto inline-flex items-center gap-0.5 rounded-full border border-white/15 bg-slate-950/80 px-1.5 py-1 text-white shadow-xl backdrop-blur-md"
        >
          <button
            type="button"
            disabled={currentIndex <= 0}
            onClick={goPrev}
            title="Trang trước (←)"
            aria-label="Trang trước"
            className="flex size-7 items-center justify-center rounded-full transition hover:bg-white/15 disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>

          <span
            title={activeSlide?.sectionTitle}
            className="min-w-10 px-1.5 text-center font-mono text-[11px] font-bold tabular-nums text-slate-100"
          >
            {currentIndex + 1}/{totalSlides}
          </span>

          <button
            type="button"
            disabled={currentIndex >= totalSlides - 1}
            onClick={goNext}
            title="Trang kế tiếp (→ / Space)"
            aria-label="Trang kế tiếp"
            className="flex size-7 items-center justify-center rounded-full transition hover:bg-white/15 disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>

          <div className="mx-1 h-4 w-px bg-white/15" />

          <button
            type="button"
            onClick={() => setShowGrid((prev) => !prev)}
            title="Danh sách trang (G)"
            aria-label="Danh sách trang"
            className={cn(
              "flex size-7 items-center justify-center rounded-full transition",
              showGrid ? "bg-violet-600 text-white" : "text-slate-200 hover:bg-white/15",
            )}
          >
            <LayoutGrid className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={exitPresentation}
            title="Thoát trình chiếu (Esc)"
            aria-label="Thoát trình chiếu"
            className="flex size-7 items-center justify-center rounded-full bg-rose-600/90 text-white transition hover:bg-rose-500"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Bảng lưới chọn nhanh bất kỳ trang nào (phím G) */}
      {showGrid && (
        <div
          onClick={(event) => event.stopPropagation()}
          className="fixed inset-0 z-40 flex flex-col bg-slate-950/92 p-5 text-white backdrop-blur-md"
        >
          <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-bold">Chọn nhanh trang trình chiếu</h3>
              <p className="text-xs text-slate-400">Bấm vào bất kỳ slide nào để nhảy tới ngay lập tức</p>
            </div>
            <button
              type="button"
              onClick={() => setShowGrid(false)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
            >
              <X className="size-3.5" /> Đóng (G)
            </button>
          </div>

          <div className="scrollbar-dark flex-1 space-y-5 overflow-y-auto pr-1 pb-20">
            {deck.sections.map((sec) => {
              const secSlides = deck.slides.slice(sec.startIndex, sec.startIndex + sec.slideCount);
              return (
                <div key={sec.sectionId}>
                  <h4 className="mb-2.5 text-xs font-bold tracking-wide text-violet-300 uppercase">
                    {sec.title} ({sec.slideCount} slide)
                  </h4>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {secSlides.map((slide) => {
                      const isCurrent = slide.globalIndex === currentIndex;
                      return (
                        <button
                          key={slide.id}
                          type="button"
                          onClick={() => {
                            setCurrentIndex(slide.globalIndex);
                            setShowGrid(false);
                          }}
                          className={cn(
                            "group overflow-hidden rounded-xl border-2 bg-slate-900 p-1 text-left transition",
                            isCurrent
                              ? "border-violet-400 ring-2 ring-violet-500/40"
                              : "border-white/10 hover:border-white/40",
                          )}
                        >
                          <PresentationSlideStage
                            slide={slide}
                            aspectRatio={deck.aspectRatio}
                            className="rounded-lg"
                          />
                          <div className="mt-1.5 flex items-center justify-between px-1">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-bold",
                                isCurrent ? "bg-violet-600 text-white" : "bg-white/10 text-slate-300",
                              )}
                            >
                              Slide {slide.globalIndex + 1}
                            </span>
                            {slide.sectionSlideCount > 1 && (
                              <span className="text-[10px] text-slate-400">
                                {slide.slideIndexInSection + 1}/{slide.sectionSlideCount}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
