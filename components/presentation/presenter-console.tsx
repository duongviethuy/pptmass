"use client";

import {
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  MonitorCheck,
  MonitorOff,
  RotateCcw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { SECTION_META } from "@/components/editor/section-meta";
import { PresentationSlideStage } from "@/components/presentation/presentation-slide-stage";
import {
  getPresentationChannelName,
  type PresentationDeck,
  type PresentationMessage,
} from "@/lib/presentation";
import { cn } from "@/lib/utils";

function formatElapsed(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");
  return hrs > 0 ? `${String(hrs).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function PresenterConsole({
  sessionId,
  deck,
  initialIndex,
  initialAudienceWindow,
  onExit,
}: {
  sessionId: string;
  deck: PresentationDeck;
  initialIndex: number;
  initialAudienceWindow: Window | null;
  onExit: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, deck.slides.length - 1)),
  );
  const [audienceConnected, setAudienceConnected] = useState(false);
  const [popupClosed, setPopupClosed] = useState(!initialAudienceWindow);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [clockText, setClockText] = useState(() =>
    new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  );

  const audienceWinRef = useRef<Window | null>(initialAudienceWindow);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const currentIndexRef = useRef(currentIndex);
  const thumbRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const totalSlides = deck.slides.length;
  const activeSlide = deck.slides[currentIndex];
  const nextSlide = currentIndex + 1 < totalSlides ? deck.slides[currentIndex + 1] : undefined;

  const postToAudience = useCallback((message: PresentationMessage) => {
    try {
      channelRef.current?.postMessage(message);
    } catch {
      // ignore closed channel
    }
    try {
      const win = audienceWinRef.current;
      if (win && !win.closed) {
        win.postMessage(message, window.location.origin);
      }
    } catch {
      // ignore cross-window race
    }
  }, []);

  const pushFullSync = useCallback(() => {
    postToAudience({
      type: "SYNC_DECK",
      sessionId,
      deck,
      currentIndex: currentIndexRef.current,
    });
  }, [deck, postToAudience, sessionId]);

  // Thiết lập kênh BroadcastChannel + postMessage dự phòng đồng bộ tức thì (<1ms) với cửa sổ máy chiếu
  useEffect(() => {
    const channel = new BroadcastChannel(getPresentationChannelName(sessionId));
    channelRef.current = channel;

    const handleIncoming = (msg: PresentationMessage | null | undefined) => {
      if (!msg || typeof msg !== "object" || msg.sessionId !== sessionId) return;

      if (msg.type === "AUDIENCE_READY") {
        setAudienceConnected(true);
        setPopupClosed(false);
        pushFullSync();
      } else if (msg.type === "AUDIENCE_CLOSED") {
        setAudienceConnected(false);
        setPopupClosed(true);
      } else if (msg.type === "REQUEST_NAV") {
        setCurrentIndex((prev) => Math.min(Math.max(0, prev + msg.delta), Math.max(0, totalSlides - 1)));
      } else if (msg.type === "REQUEST_GOTO") {
        setCurrentIndex(Math.min(Math.max(0, msg.index), Math.max(0, totalSlides - 1)));
      }
    };

    channel.onmessage = (event: MessageEvent<PresentationMessage>) => handleIncoming(event.data);
    const onWindowMessage = (event: MessageEvent<PresentationMessage>) => {
      if (event.origin !== window.location.origin) return;
      handleIncoming(event.data);
    };
    window.addEventListener("message", onWindowMessage);

    return () => {
      window.removeEventListener("message", onWindowMessage);
      channel.close();
      channelRef.current = null;
    };
  }, [pushFullSync, sessionId, totalSlides]);

  // Gửi trạng thái mới sang cửa sổ máy chiếu ngay lập tức mỗi khi đổi slide
  useEffect(() => {
    postToAudience({
      type: "SET_STATE",
      sessionId,
      currentIndex,
    });
  }, [currentIndex, postToAudience, sessionId]);

  // Theo dõi trạng thái cửa sổ máy chiếu (nếu người dùng tự đóng cửa sổ popup)
  useEffect(() => {
    const timer = setInterval(() => {
      const win = audienceWinRef.current;
      if (!win || win.closed) {
        setPopupClosed(true);
        setAudienceConnected(false);
      }
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  // Đồng hồ thực & bộ đếm thời gian trình chiếu (giống MS PowerPoint Presenter View)
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
      setClockText(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Tự cuộn danh sách trang về đúng slide đang chiếu
  useEffect(() => {
    const btn = thumbRefs.current.get(currentIndex);
    btn?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentIndex]);

  const reopenAudienceWindow = useCallback(() => {
    const existing = audienceWinRef.current;
    if (existing && !existing.closed) {
      existing.focus();
      pushFullSync();
      return;
    }
    const url = `/present?session=${encodeURIComponent(sessionId)}`;
    const win = window.open(
      url,
      "pptmass-audience-screen",
      "popup=yes,width=1280,height=720,menubar=no,toolbar=no,location=no,status=no",
    );
    audienceWinRef.current = win;
    setPopupClosed(!win);
  }, [pushFullSync, sessionId]);

  const handleExit = useCallback(() => {
    postToAudience({ type: "END_SESSION", sessionId });
    try {
      const win = audienceWinRef.current;
      if (win && !win.closed) win.close();
    } catch {
      // ignore
    }
    onExit();
  }, [onExit, postToAudience, sessionId]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, Math.max(0, totalSlides - 1)));
  }, [totalSlides]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const jumpToSlide = useCallback(
    (idx: number) => {
      setCurrentIndex(Math.min(Math.max(0, idx), Math.max(0, totalSlides - 1)));
    },
    [totalSlides],
  );

  // Phím tắt điều khiển nhanh chuẩn PowerPoint
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleExit();
      } else if (
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
        jumpToSlide(0);
      } else if (event.key === "End") {
        event.preventDefault();
        jumpToSlide(totalSlides - 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, handleExit, jumpToSlide, totalSlides]);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#0b1020] text-slate-100">
      {/* Thanh trên cùng: Trạng thái máy chiếu, Đồng hồ, Phím tắt màn hình đen/trắng, Thoát */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950/90 px-4 py-2.5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
              audienceConnected
                ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/35"
                : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/35",
            )}
          >
            {audienceConnected ? (
              <>
                <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
                <MonitorCheck className="size-3.5" /> Đang kết nối máy chiếu
              </>
            ) : (
              <>
                <MonitorOff className="size-3.5" /> {popupClosed ? "Cửa sổ chiếu chưa mở" : "Đang chờ cửa sổ chiếu..."}
              </>
            )}
          </span>

          <div className="hidden min-w-0 sm:block">
            <h1 className="truncate text-sm font-bold text-white">{deck.title}</h1>
          </div>

          <button
            type="button"
            onClick={reopenAudienceWindow}
            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/35 bg-violet-500/15 px-3 py-1.5 text-xs font-bold text-violet-200 transition hover:bg-violet-500/25"
          >
            <ExternalLink className="size-3.5" />
            {popupClosed ? "Mở cửa sổ máy chiếu" : "Đưa cửa sổ chiếu lên trước"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Đồng hồ & thời gian đã chiếu */}
          <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-mono text-slate-300 md:flex">
            <Clock className="size-3.5 text-violet-400" />
            <span>{clockText}</span>
            <span className="text-white/25">|</span>
            <span className="font-bold text-white">{formatElapsed(elapsedSeconds)}</span>
            <button
              type="button"
              onClick={() => setElapsedSeconds(0)}
              title="Đặt lại bộ đếm thời gian"
              className="rounded p-0.5 text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="size-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleExit}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-rose-500"
          >
            <X className="size-4" /> Kết thúc
          </button>
        </div>
      </header>

      {/* Hướng dẫn nhanh nếu trình duyệt chặn popup */}
      {popupClosed && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/15 px-5 py-2 text-xs text-amber-200">
          <span>
            Cửa sổ trình chiếu đang đóng hoặc bị trình duyệt chặn popup. Bấm{" "}
            <strong className="text-white">&ldquo;Mở cửa sổ máy chiếu&rdquo;</strong>, sau đó kéo cửa sổ đó sang màn hình máy chiếu và bật Toàn màn hình.
          </span>
          <button
            type="button"
            onClick={reopenAudienceWindow}
            className="rounded-lg bg-amber-400 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-amber-300"
          >
            Mở ngay
          </button>
        </div>
      )}

      {/* Không gian điều khiển chính 2 cột kiểu MS PowerPoint Presenter View */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.95fr)]">
        {/* Cột trái: Slide ĐANG CHIẾU (LIVE) + Nút điều khiển lớn + Slide TIẾP THEO (NEXT) */}
        <section className="scrollbar-dark flex min-h-0 flex-col justify-between gap-4 overflow-y-auto border-b border-white/10 p-4 lg:border-r lg:border-b-0 lg:p-6">
          {/* 1. Khung LIVE */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-extrabold tracking-wide text-white uppercase">
                  <span className="size-1.5 animate-pulse rounded-full bg-white" /> LIVE
                </span>
                <span className="text-xs font-bold text-slate-200">
                  Đang chiếu — Slide {currentIndex + 1} / {totalSlides}
                </span>
              </div>
              {activeSlide && (
                <span className="truncate rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-violet-200">
                  {activeSlide.sectionTitle}
                  {activeSlide.sectionSlideCount > 1
                    ? ` (${activeSlide.slideIndexInSection + 1}/${activeSlide.sectionSlideCount})`
                    : ""}
                </span>
              )}
            </div>

            <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-rose-500/70 bg-black shadow-2xl shadow-black/60">
              <PresentationSlideStage slide={activeSlide} aspectRatio={deck.aspectRatio} />
            </div>
          </div>

          {/* 2. Cụm nút nhấn qua trang lớn + Slide tiếp theo (NEXT) */}
          <div className="mx-auto grid w-full max-w-2xl grid-cols-1 items-stretch gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={currentIndex <= 0}
                  onClick={goPrev}
                  className="flex h-14 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 text-sm font-bold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ChevronLeft className="size-5" /> Trang trước
                </button>
                <button
                  type="button"
                  disabled={currentIndex >= totalSlides - 1}
                  onClick={goNext}
                  className="flex h-14 items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-bold text-white shadow-lg shadow-violet-950/50 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Trang tiếp <ChevronRight className="size-5" />
                </button>
              </div>
              <p className="text-center text-[11px] text-slate-400">
                Phím tắt: <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200">←</kbd>{" "}
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200">→</kbd>{" "}
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200">Space</kbd> chuyển trang ·{" "}
                <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200">Esc</kbd> thoát
              </p>
            </div>

            {/* Khung xem trước SLIDE TIẾP THEO (NEXT) — bấm vào để chuyển luôn! */}
            <button
              type="button"
              disabled={!nextSlide}
              onClick={goNext}
              className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-left transition hover:border-violet-400/60 hover:bg-white/[0.08] disabled:cursor-default disabled:opacity-50"
            >
              <div className="mb-1.5 flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">Tiếp theo (NEXT)</span>
                {nextSlide && (
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-200">
                    #{nextSlide.globalIndex + 1}
                  </span>
                )}
              </div>
              {nextSlide ? (
                <div className="overflow-hidden rounded-lg border border-white/10">
                  <PresentationSlideStage slide={nextSlide} aspectRatio={deck.aspectRatio} />
                </div>
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-white/15 text-[11px] text-slate-500">
                  Hết bài trình chiếu
                </div>
              )}
            </button>
          </div>
        </section>

        {/* Cột phải: Thanh nhảy nhanh theo Section + Danh sách toàn bộ trang (bấm là chiếu ngay lập tức!) */}
        <aside className="flex min-h-0 flex-col bg-slate-950/60">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold tracking-wide text-slate-200 uppercase">
                Danh sách trang ({totalSlides} slide)
              </h2>
              <span className="text-[11px] text-slate-400">Bấm vào trang bất kỳ để chiếu ngay</span>
            </div>

            {/* Nhảy nhanh theo từng Section */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {deck.sections.map((sec) => {
                const isActiveSec = activeSlide?.sectionId === sec.sectionId;
                return (
                  <button
                    key={sec.sectionId}
                    type="button"
                    onClick={() => jumpToSlide(sec.startIndex)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[11px] font-bold transition",
                      isActiveSec
                        ? "border-violet-400 bg-violet-600 text-white"
                        : "border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {sec.title}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lưới toàn bộ slide chia theo từng section */}
          <div className="scrollbar-dark min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {deck.sections.map((sec) => {
              const secSlides = deck.slides.slice(sec.startIndex, sec.startIndex + sec.slideCount);
              const meta = SECTION_META[sec.kind];
              const Icon = meta.icon;

              return (
                <div key={sec.sectionId} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("flex size-5 items-center justify-center rounded-md", meta.color)}>
                      <Icon className="size-3" />
                    </span>
                    <h3 className="truncate text-xs font-bold text-slate-200">{sec.title}</h3>
                    <span className="text-[10px] text-slate-500">({sec.slideCount} trang)</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-3">
                    {secSlides.map((slide) => {
                      const isLive = slide.globalIndex === currentIndex;
                      return (
                        <button
                          key={slide.id}
                          ref={(node) => {
                            if (node) {
                              thumbRefs.current.set(slide.globalIndex, node);
                            } else {
                              thumbRefs.current.delete(slide.globalIndex);
                            }
                          }}
                          type="button"
                          onClick={() => jumpToSlide(slide.globalIndex)}
                          className={cn(
                            "group relative overflow-hidden rounded-xl border-2 bg-slate-900 p-1 text-left transition",
                            isLive
                              ? "border-rose-500 ring-2 ring-rose-500/40"
                              : "border-white/10 hover:border-violet-400/70",
                          )}
                        >
                          <PresentationSlideStage
                            slide={slide}
                            aspectRatio={deck.aspectRatio}
                            className="rounded-lg"
                          />
                          <div className="mt-1 flex items-center justify-between px-1">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-extrabold",
                                isLive ? "bg-rose-600 text-white" : "bg-white/10 text-slate-300",
                              )}
                            >
                              {slide.globalIndex + 1}
                            </span>
                            {isLive && (
                              <span className="text-[10px] font-bold text-rose-400">ĐANG CHIẾU</span>
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
        </aside>
      </div>
    </div>
  );
}
