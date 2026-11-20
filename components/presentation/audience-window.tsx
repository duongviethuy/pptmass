"use client";

import { Maximize2, Minimize2, MonitorPlay, Tv } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { PresentationSlideStage } from "@/components/presentation/presentation-slide-stage";
import {
  getPresentationChannelName,
  type PresentationDeck,
  type PresentationMessage,
} from "@/lib/presentation";
import { cn } from "@/lib/utils";

type ScreenDetailedLike = {
  isPrimary?: boolean;
  isInternal?: boolean;
};

type WindowWithScreenDetails = Window & {
  getScreenDetails?: () => Promise<{ screens: ScreenDetailedLike[] }>;
};

const subscribeScreenChange = () => () => {};
const getExtendedScreenSnapshot = () => {
  const screenAny = window.screen as Screen & { isExtended?: boolean };
  return Boolean(
    screenAny.isExtended && typeof (window as WindowWithScreenDetails).getScreenDetails === "function",
  );
};
const getExtendedScreenServerSnapshot = () => false;

export function AudienceWindow() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") ?? "";

  const [deck, setDeck] = useState<PresentationDeck | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isExtendedScreen = useSyncExternalStore(
    subscribeScreenChange,
    getExtendedScreenSnapshot,
    getExtendedScreenServerSnapshot,
  );
  const [chromeVisible, setChromeVisible] = useState(true);

  const channelRef = useRef<BroadcastChannel | null>(null);
  const deckLoadedRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendToPresenter = useCallback((msg: PresentationMessage) => {
    try {
      channelRef.current?.postMessage(msg);
    } catch {
      // ignore
    }
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(msg, window.location.origin);
      }
    } catch {
      // ignore
    }
  }, []);

  const wakeChrome = useCallback(() => {
    setChromeVisible(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setChromeVisible(false);
    }, 2200);
  }, []);

  useEffect(() => {
    const syncFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFs);
    return () => document.removeEventListener("fullscreenchange", syncFs);
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const channel = new BroadcastChannel(getPresentationChannelName(sessionId));
    channelRef.current = channel;

    const handleIncoming = (msg: PresentationMessage | null | undefined) => {
      if (!msg || typeof msg !== "object" || msg.sessionId !== sessionId) return;

      if (msg.type === "SYNC_DECK") {
        deckLoadedRef.current = true;
        setDeck(msg.deck);
        setCurrentIndex(msg.currentIndex);
        setSessionEnded(false);
        document.title = `Trình chiếu · ${msg.deck.title}`;
      } else if (msg.type === "SET_STATE") {
        setCurrentIndex(msg.currentIndex);
      } else if (msg.type === "END_SESSION") {
        setSessionEnded(true);
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => undefined);
        }
        window.close();
      }
    };

    channel.onmessage = (event: MessageEvent<PresentationMessage>) => handleIncoming(event.data);
    const onWindowMessage = (event: MessageEvent<PresentationMessage>) => {
      if (event.origin !== window.location.origin) return;
      handleIncoming(event.data);
    };
    window.addEventListener("message", onWindowMessage);

    // Gửi tín hiệu sẵn sàng liên tục cho tới khi nhận được bộ slide từ màn hình điều khiển
    const announceReady = () => {
      sendToPresenter({ type: "AUDIENCE_READY", sessionId });
    };
    announceReady();
    const retryTimer = setInterval(() => {
      if (deckLoadedRef.current) {
        clearInterval(retryTimer);
        return;
      }
      announceReady();
    }, 350);

    const onBeforeUnload = () => {
      sendToPresenter({ type: "AUDIENCE_CLOSED", sessionId });
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      clearInterval(retryTimer);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("message", onWindowMessage);
      channel.close();
      channelRef.current = null;
    };
  }, [sendToPresenter, sessionId]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // ignore user gesture or browser restriction
    }
  }, []);

  const openFullscreenOnProjector = useCallback(async () => {
    try {
      const winWithApi = window as WindowWithScreenDetails;
      if (typeof winWithApi.getScreenDetails === "function") {
        const details = await winWithApi.getScreenDetails();
        const externalScreen =
          details.screens.find((s) => s.isPrimary === false) ??
          details.screens.find((s) => s.isInternal === false);
        if (externalScreen) {
          await (
            document.documentElement.requestFullscreen as unknown as (opts?: {
              screen?: ScreenDetailedLike;
            }) => Promise<void>
          )({ screen: externalScreen });
          return;
        }
      }
      await document.documentElement.requestFullscreen();
    } catch {
      void toggleFullscreen();
    }
  }, [toggleFullscreen]);

  // Hỗ trợ điều khiển trực tiếp ngay trên cửa sổ chiếu nếu cần (tự đồng bộ ngược lại màn hình điều khiển)
  useEffect(() => {
    if (!sessionId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      wakeChrome();
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        void toggleFullscreen();
      } else if (
        event.key === "ArrowRight" ||
        event.key === "ArrowDown" ||
        event.key === " " ||
        event.key === "PageDown"
      ) {
        event.preventDefault();
        sendToPresenter({ type: "REQUEST_NAV", sessionId, delta: 1 });
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        sendToPresenter({ type: "REQUEST_NAV", sessionId, delta: -1 });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sendToPresenter, sessionId, toggleFullscreen, wakeChrome]);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  if (!sessionId) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 p-6 text-center text-slate-300">
        <MonitorPlay className="mb-3 size-10 text-violet-400" />
        <p className="text-sm font-bold text-white">Không tìm thấy phiên trình chiếu</p>
        <p className="mt-1 text-xs text-slate-400">Hãy mở cửa sổ này từ nút Trình chiếu trong trang Soạn Thánh lễ.</p>
      </div>
    );
  }

  if (sessionEnded) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-black p-6 text-center text-slate-300">
        <p className="text-base font-bold text-white">Đã kết thúc bài trình chiếu</p>
        <p className="mt-1 text-xs text-slate-400">Bạn có thể đóng cửa sổ này.</p>
      </div>
    );
  }

  const activeSlide = deck?.slides[currentIndex];

  return (
    <div
      onMouseMove={wakeChrome}
      onDoubleClick={() => void toggleFullscreen()}
      className={cn(
        "relative h-screen w-screen overflow-hidden bg-black",
        isFullscreen && !chromeVisible && "cursor-none",
      )}
    >
      {deck && activeSlide ? (
        <PresentationSlideStage slide={activeSlide} aspectRatio={deck.aspectRatio} fillViewport />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-slate-300">
          <MonitorPlay className="size-10 animate-pulse text-violet-400" />
          <p className="text-sm font-semibold">Đang đồng bộ bộ slide từ màn hình điều khiển...</p>
        </div>
      )}

      {/* Thanh hướng dẫn nổi: chỉ hiện khi chưa vào Fullscreen hoặc khi di chuột */}
      <div
        className={cn(
          "pointer-events-none fixed inset-x-0 top-4 z-30 flex justify-center px-4 transition-opacity duration-200",
          !isFullscreen || chromeVisible ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/15 bg-slate-950/85 px-3.5 py-2 text-xs text-white shadow-2xl backdrop-blur-md">
          {!isFullscreen && (
            <span className="text-slate-300">
              Kéo cửa sổ này sang màn hình máy chiếu rồi bấm <strong className="text-white">Toàn màn hình</strong> (hoặc nhấp đúp chuột)
            </span>
          )}

          {!isFullscreen && isExtendedScreen && (
            <button
              type="button"
              onClick={() => void openFullscreenOnProjector()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400"
            >
              <Tv className="size-3.5" /> Chiếu sang máy chiếu
            </button>
          )}

          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-violet-500"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="size-3.5" /> Thoát toàn màn hình (F)
              </>
            ) : (
              <>
                <Maximize2 className="size-3.5" /> Toàn màn hình (F)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
