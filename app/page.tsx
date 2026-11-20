import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, BookHeart, CalendarDays, Clock, FolderOpen, Globe, Layers, Library, Lock, Music2, Presentation, type LucideIcon } from "lucide-react";

import AppHeader from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth";
import { listMySlides } from "@/lib/slides";
import { formatDateTimeVi, listSongs } from "@/lib/songs";
import { cn } from "@/lib/utils";

type QuickAction = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: string;
  ready: boolean;
};

const quickActions: QuickAction[] = [
  { href: "/editor", title: "Soạn Thánh lễ", description: "Ghép bài hát, kinh, hình ảnh và section theo trình tự, xem trước và xuất PowerPoint.", icon: Presentation, tone: "bg-violet-100 text-violet-700", ready: true },
  { href: "/slides", title: "Slide của tôi", description: "Quản lý, tìm kiếm, mở lại chỉnh sửa hoặc xóa các bài trình chiếu Thánh lễ đã lưu.", icon: FolderOpen, tone: "bg-indigo-100 text-indigo-700", ready: true },
  { href: "/songs", title: "Thư viện bài hát", description: "Xem các bài hát bạn đã tạo và các bài hát công khai trong thư viện.", icon: Library, tone: "bg-amber-100 text-amber-700", ready: true },
  { href: "/prayers", title: "Thư viện & Quản lý Kinh", description: "Xem và quản lý các kinh thường lặp lại trong Thánh lễ (Admin tạo kinh).", icon: BookHeart, tone: "bg-teal-100 text-teal-700", ready: true },
  { href: "/sections", title: "Section đã lưu", description: "Chỉnh sửa trực tiếp slide như PowerPoint và lưu section dùng riêng cá nhân.", icon: Layers, tone: "bg-sky-100 text-sky-700", ready: true },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-900">
      <AppHeader />

      <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
        <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(125deg,#172441,#334f77_55%,#182440)] px-7 py-9 text-white shadow-xl shadow-slate-300/60 sm:px-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(203,186,151,.45),transparent_40%)]" />
          <div className="relative max-w-2xl">
            <p className="text-sm font-semibold text-amber-200">
              <Suspense fallback="Bình an của Chúa!">
                <Greeting />
              </Suspense>
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Hôm nay bạn muốn chuẩn bị gì cho Thánh lễ?</h1>
            <p className="mt-3 text-sm leading-6 text-white/70">Xây dựng thư viện bài hát một lần, rồi ghép thành bài trình chiếu cho mỗi Thánh lễ chỉ trong vài phút.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/editor" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition hover:bg-amber-50">
                <Presentation className="size-4" /> Soạn Thánh lễ mới
              </Link>
              <Link href="/songs/new" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20">
                <Music2 className="size-4" /> Thêm bài hát
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-base font-bold">Bắt đầu nhanh</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {quickActions.map((action) => (
              <QuickActionCard key={action.href} action={action} />
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <Panel title="Thánh lễ gần đây" icon={CalendarDays}>
            <Suspense fallback={<RecentSongsSkeleton />}>
              <RecentSlides />
            </Suspense>
          </Panel>
          <Panel title="Bài hát mới cập nhật" icon={Clock}>
            <Suspense fallback={<RecentSongsSkeleton />}>
              <RecentSongs />
            </Suspense>
          </Panel>
        </section>
      </main>
    </div>
  );
}

async function Greeting() {
  const user = await getCurrentUser();
  return <>Bình an của Chúa, {user?.name ?? "bạn"}!</>;
}

function formatShortDateVi(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

async function RecentSlides() {
  const { slides } = await listMySlides(5);

  if (slides.length === 0) {
    return (
      <EmptyState
        icon={Presentation}
        title="Chưa có Thánh lễ nào được lưu"
        description="Các Thánh lễ bạn soạn sẽ hiện ở đây để mở lại và chỉnh sửa."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {slides.map((slide) => (
        <Link
          key={slide.id}
          href={`/editor?id=${encodeURIComponent(slide.id)}`}
          className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 transition hover:border-violet-300 hover:bg-white"
        >
          <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {slide.coverImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={slide.coverImageUrl} alt={slide.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-50 to-slate-100 text-violet-400">
                <Presentation className="size-4" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{slide.title}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              {slide.celebrationDate && <span>Ngày lễ: {formatShortDateVi(slide.celebrationDate)}</span>}
              <span>
                {slide.sectionCount} phần · {slide.slideCount} slide · {slide.aspectRatio}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Sửa lần cuối: {formatDateTimeVi(slide.updatedAt)}</p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-slate-400" />
        </Link>
      ))}
      <div className="pt-1 text-right">
        <Link href="/slides" className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 hover:text-violet-900">
          Quản lý tất cả slide <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

async function RecentSongs() {
  const { songs } = await listSongs(5);

  if (songs.length === 0) {
    return (
      <EmptyState
        icon={Music2}
        title="Thư viện của bạn đang trống"
        description="Hãy tạo bài hát đầu tiên để bắt đầu xây dựng thư viện riêng."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {songs.map((song) => {
        const categories = song.categories ?? [];
        const topics = song.topics ?? [];

        return (
          <div key={song.id} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 transition hover:border-violet-200 hover:bg-white">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{song.title}</p>
                {song.author && <p className="mt-0.5 text-xs text-slate-500">Tác giả: {song.author}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    song.isPublic !== false ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
                  )}
                >
                  {song.isPublic !== false ? <Globe className="size-3" /> : <Lock className="size-3" />}
                  {song.isPublic !== false ? "Công khai" : "Riêng tư"}
                </span>
                <span className="text-[11px] font-medium text-slate-400">{song.parts.length} phần</span>
              </div>
            </div>

            {(categories.length > 0 || topics.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-1">
                {categories.map((item) => (
                  <span key={`cat-${item}`} className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                    {item}
                  </span>
                ))}
                {topics.map((item) => (
                  <span key={`topic-${item}`} className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    {item}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-2 text-[11px] text-slate-500">
              <span>Thêm bởi: {song.createdByName || "Không rõ"}</span>
              <span>Sửa lần cuối: {formatDateTimeVi(song.updatedAt)}</span>
            </div>
          </div>
        );
      })}
      <div className="pt-1 text-right">
        <Link href="/songs" className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 hover:text-violet-900">
          Xem toàn bộ thư viện <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function RecentSongsSkeleton() {
  return (
    <div className="space-y-2.5">
      {[0, 1].map((idx) => (
        <div key={idx} className="h-20 animate-pulse rounded-xl border border-slate-100 bg-slate-50" />
      ))}
    </div>
  );
}

function QuickActionCard({ action }: { action: QuickAction }) {
  const Icon = action.icon;
  const content = (
    <>
      <div className="flex items-start justify-between">
        <span className={cn("flex size-11 items-center justify-center rounded-xl", action.tone)}><Icon className="size-5" /></span>
        {action.ready ? (
          <ArrowRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-600" />
        ) : (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">Sắp có</span>
        )}
      </div>
      <h3 className="mt-4 font-bold text-slate-900">{action.title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-slate-500">{action.description}</p>
    </>
  );

  const className = "group block rounded-2xl border border-slate-200 bg-white p-5 transition";
  if (!action.ready) return <div className={cn(className, "opacity-75")} aria-disabled>{content}</div>;
  return <Link href={action.href} className={cn(className, "hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-100/60")}>{content}</Link>;
}

function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold"><Icon className="size-4 text-violet-600" /> {title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon className="size-5" /></span>
      <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}
